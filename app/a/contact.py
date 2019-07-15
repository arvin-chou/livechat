from flask import (
    g,
    abort,
    flash,
    make_response,
    redirect,
    request,
    send_file,
    session,
    url_for
)
import datetime

from werkzeug.utils import secure_filename

from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import protect
from flask_appbuilder import ModelView, ModelRestApi
from flask_appbuilder.api import expose
from flask_appbuilder.api import safe
from flask_appbuilder.filemanager import ImageManager
from flask_appbuilder.models.sqla.filters import FilterEqual 
from flask_login import current_user
from app import appbuilder, db
from app.m.contact import Contact, ContactGroup
from app.m.quickfiles import Project, ProjectFiles
from app.v.contact import ContactModelView, ContactGroupModelView

import logging
log = logging.getLogger(__name__)

class ContactModelApi(ModelRestApi):
    #projectmodelview = ProjectModelView()
    datamodel = SQLAInterface(Contact)
    #resource_name = "projectmodelview"
    version = "1.0"

    @expose('/get/<pk>')
    @protect()
    def get(self, pk=None):
        item = self.datamodel.get(pk)
        #setattr(self.projectmodelview, '_related_views', [ProjectFilesModelView])
        out = {}
        col = self.datamodel.get_columns_list()
        col = ['name']
        #_out = iter(self.datamodel.get_values_item(item, self.datamodel.get_columns_list()))
        _out = iter(self.datamodel.get_values_item(item, col))
        for c in col:
            out[c] = next(_out) 
        #log.warning(out, "XX")
        widgets = self.projectmodelview.api_get(pk)
        #log.warning(widgets.get('show').__dict__, "BB", widgets.get('related_views')[0].get('value_columns'), self.datamodel.get_values(item))
        lst = widgets.get('related_views')[0]
        #log.info(getattr(lst, 'template'))
        #setattr(lst, 'template', 'list_for_json.html')
        for item in getattr(lst, 'template_args')['value_columns']:
            for key, value in item.items():
                #log.warning(item, "XXX")
                out[key] = value

        #log.warning(lst(pk = 1), lst)
        #log.warning(getattr(widgets.get('related_views')[0], 'template_args')['value_columns']())
        #[admin user, admin user, datetime.datetime(2019, 6, 4, 8, 38, 12, 583318), datetime.datetime(2019, 6, 4, 14, 10, 8, 906914), 'admin', False]
        return self.response(200, **out)

    @expose('/add', methods=["POST"])
    @protect()
    def add(self):
        if not request.is_json:
            return self.response_400(message="Request payload is not JSON")
        action = request.json.get('action', 'add_chats')

        if action == "add_chats":
            return self.add_chats()
        elif action == "update_group":
            return self.update_group()
        elif action == "update_user":
            return self.update_user()
        elif action == "update_friend_icon":
            return self.update_friend_icon()

        return self.response_400(message="not support")

    def add_chats(self):
        ## post with json
        #{
        #   "len":7,
        #   "rid":,
        #   "chat":[
        #      {  },
        #      {  },
        #      {  },
        #      {
        #         "id":"u4ddf1308a8747a3f815cb2959c068ebf",
        #         "me_id": xxx
        #         "icon_base64": xxx,
        #         "title":[
        #            "5/6/2019,周小艾,9:21 PM"
        #         ],
        #         "chat":[
        #            {
        #               "title":"周小艾",
        #               "chat":"五次",
        #               "t":"9:21 PM",
        #               "time":1559740894260
        #               "icon_base64":
        #            },
        if not request.is_json:
            return self.response_400(message="Request payload is not JSON")
        chat_len = request.json.get('len', None)
        chats = request.json.get('chat', None)
        rid = request.json.get('rid', None)

        if not chat_len or not chats or not rid:
            return self.response_400(message="Missing required parameter")

        s = self.datamodel.session

        #_datamodel = SQLAInterface(Project)
        _datamodel = SQLAInterface(ProjectFiles)
        _datamodel.session = s
        filters = _datamodel.get_filters()
        filters.add_filter('name', FilterEqual, str(rid))
        count, item = _datamodel.query(filters=filters, page_size=1)

        if count is 0:
            return self.response_400(message=("Missing required parameter, rid %s" % rid))

        uid = item[0].project.user_id

        for cs in chats:
            if cs.get('id', None) is None:
                log.warning('id not found, current is', cs)
                continue

            _datamodel = SQLAInterface(ContactGroup)
            _datamodel.session = s
            filters = _datamodel.get_filters()
            filters.add_filter('line_id', FilterEqual, cs['id']) # to
            filters.add_filter('projectfiles_name', FilterEqual, rid)
            filters.add_filter('me_id', FilterEqual, cs['me_id'])
            filters.add_filter('user_id', FilterEqual, uid)
            count, item = _datamodel.query(filters=filters, page_size=0)

            id = -1;
            if count:
                group = item[0]
                id = group.id
            else:
                group = ContactGroup()
                group.line_id = cs['id']
                group.projectfiles_name = rid
                group.name = cs['title']
                group.me_id = cs['me_id']
                group.user_id = uid
                group.icon_base64 = cs.get('icon_base64', cs['chat'][0]['icon_base64'])
                _datamodel.add(group)
                id = group.id

            is_updated = False
            latest_update = None

            for c in cs['chat']:
                _datamodel = SQLAInterface(Contact)
                _datamodel.session = s
                filters = _datamodel.get_filters()
                filters.add_filter('updated', FilterEqual, datetime.datetime.fromtimestamp(int(c['time']) / 1000))
                filters.add_filter('contact_group_id', FilterEqual, id)
                filters.add_filter('line_id', FilterEqual, cs['id']) # to
                filters.add_filter('from_id', FilterEqual, c['from'])
                filters.add_filter('me_id', FilterEqual, cs['me_id']) # could remove?
                count, item = _datamodel.query(filters=filters, page_size=0)

                if count > 0:
                    # update 
                    is_dirty = False
                    item = item[0]
                    if item.from_display_name == "" and c['from_display_name'] != "":
                        item.from_display_name = c['from_display_name']
                        is_dirty = True

                    if item.icon_base64 == "" and c['icon_base64'] != "":
                        item.icon_base64 = c['icon_base64']
                        is_dirty = True

                    if is_dirty:
                        s.add(item)

                else:
                    is_updated = True
                    item = Contact()
                    #d = datetime()
                    #d = datetime.datetime.fromtimestamp
                    item.name = c['title'] 
                    item.msg = c['chat'] 
                    t = int(c['time']) / 1000
                    item.updated = datetime.datetime.fromtimestamp(t)
                    if latest_update:
                        if item.updated > latest_update:
                            latest_update = item.updated 
                    else:
                        latest_update = item.updated

                    item.line_id = cs['id']
                    #item.t = c['t']
                    item.user_id = uid
                    item.contact_group_id = id
                    item.from_display_name = c['from_display_name']
                    item.me_id =  cs['me_id']
                    item.from_id = c['from']
                    item.icon_base64 = c['icon_base64']
                    item.c_type= c.get('type', 1)

                    s.add(item)

            if is_updated:
                if group.updated is None or latest_update > group.updated:
                    group.updated = latest_update 
                    s.add(group)


        message = "warning"
        try:
            s.commit()
            message = "success"
        except IntegrityError as e:
            message = "warning"
            log.warning(LOGMSG_WAR_DBI_ADD_INTEGRITY.format(str(e)))
            s.rollback()
            if raise_exception:
                raise e
        except Exception as e:
            message = str(sys.exc_info()[0]) + "danger"
            log.exception(LOGMSG_ERR_DBI_ADD_GENERIC.format(str(e)))
            s.rollback()
            if raise_exception:
                raise e

        return self.response(200, message=message)

    def update_group(self):
        ## post with json
        #{
        #   "len":7,
        #   "rid": xx,
        #   "action": "update_group",
        #   "groups":[
        #      {  },
        #      {
        #         "id":"u4ddf1308a8747a3f815cb2959c068ebf",
        #         "name": XX,
        #         "icon_base64":
        #         "me_id":
        if not request.is_json:
            return self.response_400(message="Request payload is not JSON")

        group_len = request.json.get('len', None)
        groups = request.json.get('groups', None)
        rid = request.json.get('rid', None)

        if not group_len or not groups or not rid:
            return self.response_400(message="Missing required parameter")

        s = self.datamodel.session
        _datamodel = SQLAInterface(ProjectFiles)
        _datamodel.session = s
        filters = _datamodel.get_filters()
        filters.add_filter('name', FilterEqual, str(rid))
        count, item = _datamodel.query(filters=filters, page_size=1)

        if count is 0:
            return self.response_400(message=("Missing required parameter, rid %s" % rid))

        uid = item[0].project.user_id

        for cs in groups:
            if cs.get('id', None) is None:
                log.warning('id not found, current is', cs)
                continue

            _datamodel = SQLAInterface(ContactGroup)
            _datamodel.session = s
            filters = _datamodel.get_filters()
            filters.add_filter('line_id', FilterEqual, cs['id']) # to
            filters.add_filter('projectfiles_name', FilterEqual, rid)
            filters.add_filter('me_id', FilterEqual, cs['me_id'])
            filters.add_filter('user_id', FilterEqual, uid)
            count, item = _datamodel.query(filters=filters, page_size=0)

            id = -1;
            if count:
                group = item[0]
            else:
                group = ContactGroup()

            group.line_id = cs['id'] # to
            group.projectfiles_name = rid
            group.user_id = uid
            group.name = cs['name']
            group.icon_base64 = cs['icon_base64']
            group.me_id  = cs['me_id']
            _datamodel.add(group)

        message = "warning"

        try:
            s.commit()
            message = "success"
        except IntegrityError as e:
            message = "warning"
            log.warning(LOGMSG_WAR_DBI_ADD_INTEGRITY.format(str(e)))
            s.rollback()
            if raise_exception:
                raise e
        except Exception as e:
            message = str(sys.exc_info()[0]) + "danger"
            log.exception(LOGMSG_ERR_DBI_ADD_GENERIC.format(str(e)))
            s.rollback()
            if raise_exception:
                raise e

        return self.response(200, message=message)

    def update_user(self):
        ## post with json
        #{
        #   "rid": xx,
        #   "action": "update_user",
        #   "user":
        #      {
        #         "name": XX,
        #         "icon_base64":
        #         "me": xx
        if not request.is_json:
            return self.response_400(message="Request payload is not JSON")

        user = request.json.get('user', None)
        rid = request.json.get('rid', None)

        if not user or not rid:
            return self.response_400(message="Missing required parameter")

        s = self.datamodel.session
        _datamodel = SQLAInterface(ProjectFiles)
        _datamodel.session = s
        filters = _datamodel.get_filters()
        filters.add_filter('name', FilterEqual, str(rid))
        count, item = _datamodel.query(filters=filters, page_size=1)

        if count is 0:
            return self.response_400(message=("Missing required parameter, rid %s" % rid))

        item = item[0]
        item.user_name = user['name']
        item.icon_base64 = user['icon_base64']
        item.me_id = user['me_id']

        _datamodel.add(item)

        message = "warning"

        try:
            s.commit()
            message = "success"
        except IntegrityError as e:
            message = "warning"
            log.warning(LOGMSG_WAR_DBI_ADD_INTEGRITY.format(str(e)))
            s.rollback()
            if raise_exception:
                raise e
        except Exception as e:
            message = str(sys.exc_info()[0]) + "danger"
            log.exception(LOGMSG_ERR_DBI_ADD_GENERIC.format(str(e)))
            s.rollback()
            if raise_exception:
                raise e

        return self.response(200, message=message)

    def update_friend_icon(self):
        ## post with json
        #{
        #   "len":7,
        #   "rid": xx,
        #   "action": "update_friend_icon",
        #   "me_id":,
        #   "friends":
        #      {
        #         "xx":"xx",
        if not request.is_json:
            return self.response_400(message="Request payload is not JSON")

        friends_len = request.json.get('len', None)
        friends = request.json.get('friends', None)
        me_id = request.json.get('me_id', None)
        rid = request.json.get('rid', None)

        if not friends_len or not friends or not rid or not me_id:
            return self.response_400(message="Missing required parameter")

        s = self.datamodel.session
        _datamodel = SQLAInterface(ProjectFiles)
        _datamodel.session = s
        filters = _datamodel.get_filters()
        filters.add_filter('name', FilterEqual, str(rid))
        count, item = _datamodel.query(filters=filters, page_size=1)

        if count is 0:
            return self.response_400(message=("Missing required parameter, rid %s" % rid))

        uid = item[0].project.user_id

        for k in friends:
            _datamodel = SQLAInterface(Contact)
            _datamodel.session = s
            filters = _datamodel.get_filters()
            filters.add_filter('name', FilterEqual, rid)
            filters.add_filter('from_id', FilterEqual, k)
            filters.add_filter('me_id', FilterEqual, me_id)
            count, item = _datamodel.query(filters=filters, page_size=0)

            id = -1;
            if count:
                item = item[0]
                item.icon_base64 = friends[k]
                _datamodel.add(item)

        message = "warning"

        try:
            s.commit()
            message = "success"
        except IntegrityError as e:
            message = "warning"
            log.warning(LOGMSG_WAR_DBI_ADD_INTEGRITY.format(str(e)))
            s.rollback()
            if raise_exception:
                raise e
        except Exception as e:
            message = str(sys.exc_info()[0]) + "danger"
            log.exception(LOGMSG_ERR_DBI_ADD_GENERIC.format(str(e)))
            s.rollback()
            if raise_exception:
                raise e

        return self.response(200, message=message)


appbuilder.add_api(ContactModelApi)
