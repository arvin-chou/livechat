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
from app.m.quickfiles import Project
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
        ## post with json
        #{
        #   "len":7,
        #   "chat":[
        #      {  },
        #      {  },
        #      {  },
        #      {
        #         "id":"u4ddf1308a8747a3f815cb2959c068ebf",
        #         "title":[
        #            "5/6/2019,周小艾,9:21 PM"
        #         ],
        #         "chat":[
        #            {
        #               "title":"周小艾",
        #               "chat":"五次",
        #               "t":"9:21 PM",
        #               "time":1559740894260
        #            },
        if not request.is_json:
            return self.response_400(message="Request payload is not JSON")
        chat_len = request.json.get('len', None)
        chats = request.json.get('chat', None)
        rid = request.json.get('rid', None)

        if not chat_len or not chats or not rid:
            return self.response_400(message="Missing required parameter")

        s = self.datamodel.session

        _datamodel = SQLAInterface(Project)
        _datamodel.session = s
        filters = _datamodel.get_filters()
        filters.add_filter('name', FilterEqual, str(rid))
        count, item = _datamodel.query(filters=filters, page_size=1)

        if count is 0:
            return self.response_400(message=("Missing required parameter, rid %s" % rid))

        uid = item[0].user_id

        for cs in chats:
            if cs.get('id', None) is None:
                log.warning('id not found, current is', cs)
                continue
            _datamodel = SQLAInterface(ContactGroup)
            _datamodel.session = s
            filters = _datamodel.get_filters()
            filters.add_filter('line_id', FilterEqual, cs['id'])
            count, item = _datamodel.query(filters=filters, page_size=1)

            id = -1;
            if count:
                group = item[0]
                id = group.id
            else:
                group = ContactGroup()
                group.line_id = cs['id']
                #group.name = cs['title'][0]
                group.name = cs['title']
                group.user_id = uid
                _datamodel.add(group)
                id = group.id

            for c in cs['chat']:
                item = Contact()
                #d = datetime()
                #d = datetime.datetime.fromtimestamp
                item.name = c['title'] 
                item.msg = c['chat'] 
                item.updated = datetime.datetime.fromtimestamp(int(c['time']) / 1000)
                item.line_id = cs['id']
                #item.t = c['t']
                item.user_id = uid
                item.contact_group_id = id
                item.from_display_name = c['from_display_name']
                item.from_id = c['from']
                item.me_id = c['me']

                s.add(item)

            updated = item.updated 
            group.updated = updated
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

appbuilder.add_api(ContactModelApi)
