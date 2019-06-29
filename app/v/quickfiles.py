from flask_login import current_user
from flask import (
    request,
    redirect,
    url_for
)
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.views import ModelView, CompactCRUDMixin
from flask_appbuilder.actions import action
from app.m.quickfiles import Project, ProjectFiles, LindFriend
from app import appbuilder, db, socketio
from flask_appbuilder import AppBuilder,expose,BaseView,has_access
from flask_appbuilder.urltools import get_filter_args, get_order_args, get_page_args, get_page_size_args
from flask_appbuilder.widgets import RenderTemplateWidget
from flask_appbuilder.models.sqla.filters import FilterEqual, FilterGreater, FilterEqualFunction
from flask_appbuilder.models.filters import Filters
from flask_appbuilder.baseviews import BaseCRUDView
import json
import time

import logging
log = logging.getLogger(__name__)

class ProjectFilesModelView(ModelView):
    datamodel = SQLAInterface(ProjectFiles)

    label_columns = {"file_name": "File Name", "download": "Download"}
    add_columns = ["file", "description", "project"]
    edit_columns = ["file", "description", "project_id", "validate_time"]
    list_columns = ["id", "username", "project_id", "name", "validate_time"]
    show_columns = ["project_id", "qrcode", "name"]

class ProjectFile(ModelView):
    datamodel = SQLAInterface(ProjectFiles)

    label_columns = {"download": "Download"}
    #show_columns = ["download"]
    show_columns = ["qrcode"]

    @expose("/show/<pk>")
    @expose("/show/")
    @has_access
    def list(self, pk=-1):
        #self._base_filters = Project.is_used.is_(False)
        s = self.datamodel.session
        _datamodel = SQLAInterface(Project)
        _datamodel.session = s
        filters = _datamodel.get_filters()
        filters.add_filter('user_id', FilterEqual, current_user.id)
        #filters.add_filter('limit_qrcode', FilterGreater, 'current')
        count, item = _datamodel.query(filters=filters, page_size=1)
        if count:
            first_unused = item[0]
            pk = first_unused.id
        else:
            filters = _datamodel.get_filters()
            filters.add_filter('user_id', FilterEqual, None)
            item = _datamodel.query(filters=filters, page_size=1)
            #log.info(item[1][0].__dict__)
            if len(item[1]) is 0:
                pk = -1;
            else:
                first_unused = item[1][0]
                pk = first_unused.id
                first_unused.user_id = current_user.id
                _datamodel.edit(first_unused)

        filters = self.datamodel.get_filters()
        filters.add_filter('project_id', FilterEqual, pk)
        count, item = self.datamodel.query(filters=filters, page_size=1)
        if count:
            pk = item[0].id
        else:
            pk = -1
        widgets = self._show(pk)
        widgets['show'].template = "show_line.html"
        show_template = "quickfiles.html"
        return self.render_template(
            show_template,
            pk=pk,
            title=self.show_title,
            widgets=widgets,
            related_views=self._related_views,
        )

    #@expose("/list")
    #@expose("/list/")
    #@has_access
    #def list(self):
    #    datamodel = SQLAInterface(ProjectFiles)
    #    #self._base_filters = Project.is_used.is_(False)
    #    self.list_columns = ["qrcode"]
    #    self._base_filters.clear_filters()
    #    self._base_filters.add_filter('user_id', FilterEqual, current_user.id)
    #    widgets = self._list()
    #    #widgets['show'].template = "show_line.html"
    #    #show_template = "quickfiles.html"
    #    log.error("VV")
    #    return self.render_template(
    #        self.list_template,
    #        title=self.list_title,
    #        widgets=widgets,
    #        related_views=self._related_views,
    #    )



class ProjectModelView(CompactCRUDMixin, ModelView):
    datamodel = SQLAInterface(Project)
    related_views = [ProjectFilesModelView]
    _related_views = [ProjectFilesModelView()]

    def api_get(self, pk=1):
        widgets = self._show(pk)
        return widgets

    #show_template = "quickfiles.html"
    show_template = "appbuilder/general/model/show_cascade.html"
    edit_template = "appbuilder/general/model/edit_cascade.html"

    add_columns = ["name", "user_id"]
    edit_columns = ['user_id', 'limit_qrcode']
    list_columns = ["user", "created_by", "created_on", "changed_by", "changed_on", "limit_qrcode"]
    show_fieldsets = [
        ("Info", {"fields": ["name", "user_id"]}),
        (
            "Audit",
            {
                "fields": ["created_by", "created_on", "changed_by", "changed_on"],
                "expanded": False,
            },
        ),
    ]

class ShowProjectFilesByUser(ModelView):
    datamodel = SQLAInterface(ProjectFiles)

    label_columns = {"qrcode": "qrcode", "active": "active", "add": "add friend"}
    include_columns = ["qrcode"]
    #def __init__ (self, s):
    #    self.datamodel = SQLAInterface(ProjectFiles, s)
    #add_columns = ["file", "description", "project"]
    #edit_columns = ["file", "description", "project"]
    edit_columns = ["file", "description"]
    #list_columns = ["active", "logout", "add", "download"]
    list_columns = ["active", "showchat", "logout", "download"]
    show_columns = ["qrcode"]

    @has_access
    #@action("showchat","show caht","Do you really want to?","fa-rocket")
    #def showchat(self, item):
    #    """
    #        do something with the item record
    #    """
    #    return redirect(self.get_redirect())

    @expose("/show/<pk>")
    @expose("/show/")
    @has_access
    def list(self, pk=-1):
        #self._base_filters = Project.is_used.is_(False)
        s = self.datamodel.session
        _datamodel = SQLAInterface(Project)
        _datamodel.session = s
        filters = _datamodel.get_filters()
        filters.add_filter('user_id', FilterEqual, current_user.id)
        #filters.add_filter('limit_qrcode', FilterGreater, 'current')
        count, item = _datamodel.query(filters=filters, page_size=1)
        ppk = -1
        if count:
            first_unused = item[0]
            ppk = first_unused.id

        filters = self.datamodel.get_filters()
        filters.add_filter('project_id', FilterEqual, ppk)
        filters.add_filter('id', FilterEqual, pk)
        count, item = self.datamodel.query(filters=filters, page_size=1)
        self.show_columns = ["qrcode"]
        if count:
            pk = item[0].id
            if item[0].status:
                self.show_columns = ["add_friend"]
        else:
            pk = -1

        widgets = self._show(pk)
        widgets['show'].template = "show_line.html"


        show_template = "quickfiles.html"
        return self.render_template(
            show_template,
            pk=pk,
            title=self.show_title,
            widgets=widgets,
        )


class ProjectFilesByUser(CompactCRUDMixin, ModelView):
    related_views = [ShowProjectFilesByUser]
    #_related_views = [ShowProjectFilesByUser()]
    datamodel = SQLAInterface(Project)

    show_fieldsets = [
        ("Info", {"fields": ["user", "limit_qrcode"]}),
        #(
        #    "Audit",
        #    {
        #        "fields": ["qrcode"],
        #        "expanded": False,
        #    },
        #),
    ]
    show_columns = ["qrcode", "active"]
    list_columns = ["user"]

    def get_current_user_id():
        return current_user.id

    #base_filters = [['user_id', FilterEqualFunction, get_current_user_id]]

    @expose("/list")
    @has_access
    def list(self):
        filters = self.datamodel.get_filters()
        filters.add_filter('user_id', FilterEqual, current_user.id)
        count, item = self.datamodel.query(filters=filters, page_size=1)
        ppk = -1
        limit_qrcode = -1
        if count:
            first_unused = item[0]
            ppk = first_unused.id
            limit_qrcode = first_unused.limit_qrcode
        else:
            item = self.datamodel.obj()
            item.created_by_fk = 1
            item.changed_by_fk = 1
            self.datamodel.add(item)
            ppk = item.id
            limit_qrcode = item.limit_qrcode


        _datamodel = SQLAInterface(ProjectFiles, self.datamodel.session)
        filters = _datamodel.get_filters()
        filters.add_filter('project_id', FilterEqual, ppk)
        count, item = _datamodel.query(filters=filters, order_column='id', order_direction='desc', page_size=-1)

        if count < limit_qrcode:
            filters.clear_filters()
            filters.add_filter('project_id', FilterEqual, None)
            _count, item = _datamodel.query(filters=filters, page_size=-1)
            for i in range(count, limit_qrcode):
                j = i - count
                item[j].project_id = ppk
                _datamodel.add(item[j])

        elif count > limit_qrcode:
            for i in range(limit_qrcode, count):
                j = i - limit_qrcode
                item[j].project_id = -1
                _datamodel.add(item[j])

        _datamodel = SQLAInterface(ProjectFiles, self.datamodel.session)
        filters = _datamodel.get_filters()
        filters.add_filter('project_id', FilterEqual, ppk)
        count, item = _datamodel.query(filters=filters, order_column='id', order_direction='desc', page_size=-1)
        for i in item:
            i.status = 0
            _datamodel.add(i)
            if i.name:
                socketio.emit('message', {'action': 'heartbeat', 'p': ''}, namespace='/canary', room=i.name)


        #self._base_filters = Project.is_used.is_(False)
        self._base_filters.clear_filters()
        self._base_filters.add_filter('user_id', FilterEqual, current_user.id)
        widgets = self._list()
        #show_template = "quickfiles.html"
        return self.render_template(
            self.list_template,
            title=self.list_title,
            widgets=widgets,
            #related_views=self._related_views,
        )



def get_line_id_by_current_user(s):
    _datamodel = SQLAInterface(Project)
    _datamodel.session = s
    filters = _datamodel.get_filters()
    filters.add_filter('user_id', FilterEqual, current_user.id)
    count, item = _datamodel.query(filters=filters, page_size=1)
    project = item[0]
    line_id = project.name

    return line_id

def resp(json):
    print('received my event: ' + str(json) + json['action'])
    if json['action'] == "heartbeat":
        #print('received my event: ' + str(json) + json['action'])
        _datamodel = SQLAInterface(ProjectFiles, db.session)
        filters = _datamodel.get_filters()
        filters.add_filter('name', FilterEqual, json['rid'])
        count, item = _datamodel.query(filters=filters, order_column='id', order_direction='desc', page_size=-1)
        item = item[0]
        item.status = json['p']['is_alive']
        _datamodel.add(item)

socketio.on_event('resp', resp, namespace='/canary')

def line_background_stuff():
     """ python code in main.py """
     print('In background_stuff')
     while True:
         t = str(time.clock())
         #LineFuncuntionView._heartbeat('cohdjlnickbddofkgnnmkjlcehfeedld')
         print('In background_stuff', t)
         time.sleep(10)


class LineFuncuntionView(ModelView):
    datamodel = SQLAInterface(LindFriend)
    route_base = '/linefuncuntion'
    default_view = 'add_form'
    add_columns = ["line_id"]
    list_columns = ["line_id", "updated"]
    show_fieldsets = [
        ("Info", {"fields": ["line_id", "updated"]}),
    ]

    @expose("/add", methods=['GET'])
    @has_access
    def add_form(self, name = -1):
        widgets = self._list()
        return self.render_template(
            self.list_template, 
            title=self.list_title, widgets=widgets)

    @expose("/add/<name>", methods=['POST', 'GET'])
    @has_access
    def add(self, name =- 1):
        self._base_filters.clear_filters()
        self._base_filters.add_filter('name', FilterEqual, name)
        if request.method == 'POST':
            resp={'status': 1, 'msg': ''};
            form = self.add_form.refresh()
            item = self.datamodel.obj()
            form.populate_obj(item)
            item.user_id = current_user.id
            line_id = item.line_id
            self.datamodel.add(item)


            s = self.datamodel.session
            _datamodel = SQLAInterface(Project)
            _datamodel.session = s
            filters = self.datamodel.get_filters()
            filters.add_filter('user_id', FilterEqual, current_user.id)
            count, item = _datamodel.query(filters=filters, page_size=1)
            project = item[0]

            socketio.emit('message', {'action': 'add_friend', 'p': line_id}, namespace='/canary', room=name)

            widgets = self._list()
            return self.render_template(
                #self.list_template, 
                'line_function.html',
                title=self.list_title, widgets=widgets, resp=resp)

        else:
            widgets = self._add()
            return self.render_template(
                self.add_template,
                widgets=widgets,
            )

    @staticmethod
    def _heartbeat(name = -1):
        resp={'status': 0, 'msg': ''}; # fail
        if name and name is not -1:
            line_id = name
            socketio.emit('message', {'action': 'heartbeat', 'p': ''}, namespace='/canary', room=name)
            #socketio.send({'action': 'heartbeat', 'p': ''}, room=name)
            resp = {'status': 1, 'msg': ''}; # success

        return json.dumps(resp, ensure_ascii=False)


    @expose('/heartbeat/<name>', methods=['POST', 'GET'])
    @has_access
    def heartbeat(self, name = -1):
        _heartbeat(name)
        #resp={'status': 0, 'msg': ''}; # fail
        #if name and name is not -1:
        #    line_id = name
        #    socketio.emit('message', {'action': 'heartbeat', 'p': ''}, namespace='/canary', room=name)
        #    #socketio.send({'action': 'heartbeat', 'p': ''}, room=name)
        #    resp = {'status': 1, 'msg': ''}; # success

        #return json.dumps(resp, ensure_ascii=False)

    @expose('/logout/<name>', methods=['POST', 'GET'])
    @has_access
    def logout(self, name = -1):
        resp={'status': 1, 'msg': ''};
        if request.method == 'POST':
            if name and name != -1:
                line_id = name
            else:
                line_id = get_line_id_by_current_user(self.datamodel.session)
            socketio.emit('message', {'action': 'logout', 'p': ''}, namespace='/canary', room=name)
            resp={'status': 0, 'msg': 'logout success'};
            #return redirect(self.route_base)

        widgets = self._list()
        return self.render_template(
            'line_function.html',
            title=self.list_title, widgets=widgets, is_logout=True, resp=resp)


appbuilder.add_view(LineFuncuntionView, 'add friend', icon="fa-user-plus", category='Line',
                    category_icon = "fa fa-user-o")
appbuilder.add_link('logout',href='/linefuncuntion/logout', icon="fa-sign-out", category='Line')

appbuilder.add_view(ProjectFile, "Add line monitor", icon="fa fa-qrcode", category="Line")
appbuilder.add_view(ProjectFilesByUser, "Add line monitor", icon="fa fa-qrcode", category="Line",
                    category_icon = "fa-envelope")
#appbuilder.add_view(
#    ProjectFilesModelView, "List all", icon="fa-table", category="Projects"
#)
#appbuilder.add_link('Add line monitor', icon="fa-table", href='/index/hello', category='Projects')
appbuilder.add_view(ProjectModelView, "List All Qrcode group", icon="fa-table", category="Line")
appbuilder.add_view(ProjectFilesModelView, "List All Qrcode", icon="fa-table", category="Line")
appbuilder.add_view_no_menu(ProjectFilesModelView)
appbuilder.add_view_no_menu(ShowProjectFilesByUser)

db.create_all()
