from flask_babel import lazy_gettext as _
from flask_login import current_user
from flask import (
    request,
    redirect,
    url_for
)
#from flask import g
from flask import session
from flask import json as flask_json
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder import ModelRestApi
from flask_appbuilder.views import ModelView, CompactCRUDMixin
from flask import jsonify

from flask_appbuilder.actions import action
from app.m.quickfiles import Project, ProjectFiles, LindFriend
from app import appbuilder, db, socketio, app
from flask_appbuilder import AppBuilder,expose,BaseView,has_access
from flask_appbuilder.urltools import get_filter_args, get_order_args, get_page_args, get_page_size_args
from flask_appbuilder.widgets import RenderTemplateWidget
from flask_appbuilder.models.sqla.filters import FilterEqual, FilterGreater, FilterEqualFunction
from flask_appbuilder.models.filters import Filters
from flask_appbuilder.baseviews import BaseCRUDView
import json
import time
import platform
from subprocess import check_output

import logging
log = logging.getLogger(__name__)
g = {}
g['status'] = {}
g['is_logout'] = {}

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

    label_columns = {"qrcode": "qrcode", 
            "active": _("account active status"), 
            "add": "add friend",
            "description" : _("your line id"), 
            "logout": _("line logout"),
            "showchat": _("line monitor user")}
    include_columns = ["qrcode"]
    #def __init__ (self, s):
    #    self.datamodel = SQLAInterface(ProjectFiles, s)
    #add_columns = ["file", "description", "project"]
    #edit_columns = ["file", "description", "project"]
    edit_columns = ["description"]
    #list_columns = ["active", "logout", "add", "download"]
    list_columns = ["active", "showchat", "logout", "description"]
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
                pass
                #self.show_columns = ["add_friend"]
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
    default_view = 'show'

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
    @expose("/show")
    @has_access
    def show(self):
        pk = -1
        filters = self.datamodel.get_filters()
        filters.add_filter('user_id', FilterEqual, current_user.id)
        count, item = self.datamodel.query(filters=filters, page_size=1)
        if count:
            pk = item[0].id

        widgets = self._show(pk)
        return self.render_template(
            'show_for_projectfilesbyuser.html',
            pk=pk,
            title="",
            widgets=widgets,
            related_views=self._related_views,
        )

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

class s(CompactCRUDMixin, ModelView):
    # show / get qrcode for shortend url
    datamodel = SQLAInterface(Project)

    @expose("/s/<pid>")
    def s(self):
        # set shortend url, only work for status = 0 and active
        filters = self.datamodel.get_filters()
        filters.add_filter('user_id', FilterEqual, current_user.id)
        filters.add_filter('id', FilterEqual, pid)
        count, item = self.datamodel.query(filters=filters, page_size=1)
        if count:
            item = item[0]
            if item.is_offline() and item.is_active():
                # gen image with base64 and with timestamp without permission
                qr = qrcode.QRCode(
                        version=1,
                        error_correction=qrcode.constants.ERROR_CORRECT_L,
                        box_size=10,
                        border=4,
                        )
                qr.add_data(url_for("s.s", t=str(datetime.datetime.now().timestamp())))
                qr.make(fit=True)
                img = qr.make_image()

                buffered = BytesIO()
                img.save(buffered, format="PNG")
                img_str = base64.b64encode(buffered.getvalue())
                return "data:image/png;base64," + img_str

        return ""

    @expose("/g/<pid>")
    def g(self):
        filters = self.datamodel.get_filters()
        filters.add_filter('user_id', FilterEqual, current_user.id)
        filters.add_filter('id', FilterEqual, pid)
        count, item = self.datamodel.query(filters=filters, page_size=1)
        if count:
            pass

        return ""



def get_line_id_by_current_user(s):
    _datamodel = SQLAInterface(Project)
    _datamodel.session = s
    filters = _datamodel.get_filters()
    filters.add_filter('user_id', FilterEqual, current_user.id)
    count, item = _datamodel.query(filters=filters, page_size=1)
    project = item[0]
    line_id = project.name

    return line_id

import threading
def processLine(cmd):
    print("cmd is ", cmd)
    time.sleep(5)
    msg = check_output(cmd, shell=True).decode()
    #msg = check_output("%s --app chrome-extension://%s/index.html#popou" % (pythin_bin, json['rid']), shell=True).decode()
    print("reload2:msg:", msg)


def do_reload(name):
    s = platform.system()
    if s == "Windows":
        pythin_bin = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
        cmd = '"%s" --app chrome-extension://%s/index.html#popou' % (pythin_bin, name)
    elif s == "Darwin":
        pythin_bin = "/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome"
        cmd = '%s --app chrome-extension://%s/index.html#popou' % (pythin_bin, name)
    #print("reload", json, cmd);
    #msg = check_output(cmd, shell=True).decode()
    #print("reload", msg);
    processThread = threading.Thread(target=processLine, args=(cmd,));
    processThread.start();
    #time.sleep(5)
    #msg = check_output(cmd, shell=True).decode()
    ##msg = check_output("%s --app chrome-extension://%s/index.html#popou" % (pythin_bin, json['rid']), shell=True).decode()
    #print("reload:msg:", msg)
    print("cmd:", cmd)


def resp(json):
    print('== received from js [%s] %s' % (json['action'], str(json)))
    if json['action'] == "heartbeat":
        #print('received my event: ' + str(json) + json['action'])
        _datamodel = SQLAInterface(ProjectFiles, db.session)
        filters = _datamodel.get_filters()
        filters.add_filter('name', FilterEqual, json['rid'])
        count, item = _datamodel.query(filters=filters, order_column='id', order_direction='desc', page_size=-1)
        item = item[0]
        item.status = json['p']['is_alive']
        _datamodel.add(item)
        if item.status is 1:
            print('emit add friend %s from %s' % (item.description, item.name)) 
            socketio.emit('message', {'action': 'add_friend', 'p': item.description}, namespace='/canary', room=item.name)

    elif json['action'] == "sync_status":
        global g
        me_id = json.get('me_id', -1)
        rid = json.get('rid', -1)
        if me_id not in g['status']:
            g['status'][me_id] = {}

        if me_id in g['status'] and rid != -1:
            g['status'][me_id][rid] = {}
            g['status'][me_id][rid]['status'] = json['p'].get('status', "")
            g['status'][me_id][rid]['info'] = json['p'].get('info', "")

        #if json['p'].get('status', "") == -2:
        #    for i in g['status'].keys():
        #        for j in g['status'][i].keys():
        #            if j is rid:
        #               print('force overwrite')
        #               g['status'][i][rid] = {}
        #               g['status'][i][rid]['status'] = json['p'].get('status', "")
        #               g['status'][i][rid]['info'] = json['p'].get('info', "")
        #               break
    elif json['action'] == "ask_status":
        #print('received my event: ' + str(json) + json['action'])
        _datamodel = SQLAInterface(ProjectFiles, db.session)
        filters = _datamodel.get_filters()
        filters.add_filter('name', FilterEqual, json['rid'])
        count, item = _datamodel.query(filters=filters, order_column='id', order_direction='desc', page_size=-1)
        item = item[0]
        print("=== current status is %s ===" % (item.status))
        socketio.emit('message', {'action': 'resp_status', 'p': item.status}, namespace='/canary', room=item.name)
        if item.status == -2 and json['p'].get('is_ongoing', False):
            do_reload(json['rid'])

    elif json['action'] == "reload":
        do_reload(json['rid'])
        #s = platform.system()
        #if s == "Windows":
        #    pythin_bin = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
        #elif s == "Darwin":
        #    pythin_bin = "/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome"
        #cmd = '"%s" --app chrome-extension://%s/index.html#popou' % (pythin_bin, json['rid'])
        ##print("reload", json, cmd);
        ##msg = check_output(cmd, shell=True).decode()
        ##print("reload", msg);
        #processThread = threading.Thread(target=processLine, args=(cmd,));
        #processThread.start();
        ##time.sleep(5)
        ##msg = check_output(cmd, shell=True).decode()
        ###msg = check_output("%s --app chrome-extension://%s/index.html#popou" % (pythin_bin, json['rid']), shell=True).decode()
        ##print("reload:msg:", msg)
        #print("reload:msg:", msg)
        socketio.emit('message', {'action': 'resp_status', 'p': 0}, namespace='/canary', room=json['rid'])


socketio.on_event('resp', resp, namespace='/canary')

def line_background_stuff():
     """ python code in main.py """
     print('In background_stuff')
     while True:
         t = str(time.clock())
         #LineFuncuntionView._heartbeat('cohdjlnickbddofkgnnmkjlcehfeedld')
         print('In background_stuff', t)
         time.sleep(10)

#@app.before_request
#def before_request():
#    g.status = {}

class LineFuncuntionView(ModelView, ModelRestApi):
    datamodel = SQLAInterface(LindFriend)
    route_base = '/linefuncuntion'
    default_view = 'add_form'
    add_columns = ["line_id"]
    list_columns = ["line_id", "updated"]
    show_fieldsets = [
        ("Info", {"fields": ["line_id", "updated"]}),
    ]

    @expose("/refresh_client", methods=['GET'])
    def refresh_client(self):
        # https://stackoverflow.com/questions/15974730/how-do-i-get-the-different-parts-of-a-flask-requests-url
        to = request.args.get('to', default = request.url_root, type = str)
        id = request.args.get('id', default = -1, type = int)
        s = self.datamodel.session
        _datamodel = SQLAInterface(Project)
        _datamodel.session = s
        filters = _datamodel.get_filters()
        filters.add_filter('user_id', FilterEqual, current_user.id)
        count, item = _datamodel.query(filters=filters, page_size=1)

        is_found = False 
        p = {}
        item = item[0]
        for i in item.projectfiles:
            if i.id == id:
                is_found = True
                p = i
                break

        if is_found and p.status is 0:
            socketio.emit('message', {'action': 'refresh', 'p': ''}, namespace='/canary', room=p.name)
        return redirect(to)

    @expose("/sync_group", methods=['GET'])
    def sync_group(self):
        name = request.args.get('name', default = -1, type = str)
        s = self.datamodel.session
        _datamodel = SQLAInterface(Project)
        _datamodel.session = s
        filters = _datamodel.get_filters()
        filters.add_filter('user_id', FilterEqual, current_user.id)
        count, item = _datamodel.query(filters=filters, page_size=1)

        if count:
            item = item[0]
            for i in item.projectfiles:
                if i.name == name:
                    socketio.emit('message', {'action': 'sync_group', 'p': ''}, namespace='/canary', room=i.name)
                    return '{"status": "ok"}'

        return '{"status": "error"}'


    @expose("/status", methods=['GET'])
    def check_status(self):
        global g
        name = request.args.get('name', default = '-1', type = str)
        me_id = request.args.get('me_id', default = '-1', type = str) # me_id means be monitored's line id
        icon_base64 = ""

        if name == -1 or me_id == -1:
            return '{"status": "error"}'

        if me_id not in g['status']:
            g['status'][me_id] = {}

        is_found = False
        if name in g['status'][me_id]:
            pass
        else:
            g['status'][me_id][name] = {}

        s = self.datamodel.session
        _datamodel = SQLAInterface(Project)
        _datamodel.session = s
        filters = _datamodel.get_filters()
        filters.add_filter('user_id', FilterEqual, current_user.id)
        count, item = _datamodel.query(filters=filters, page_size=1)
        item = item[0]

        for i in item.projectfiles:
            if i.name == name:
                is_found = True
                icon_base64 = i.icon_base64
                user_name = i.user_name
                me_id = i.me_id

                if me_id not in g['status']:
                    # change login
                    g['status'][me_id] = {}
                    g['status'][me_id][name] = {}
                break
        
        if not is_found:
            return '{"status": "error", info: "not found"}'
                
        if 'status' not in g['status'][me_id][name]:
            g['status'][me_id][name]['status'] = ""

        if 'info' not in g['status'][me_id][name]:
            g['status'][me_id][name]['info'] = ""

        s = g['status'][me_id][name]['status']
        i = g['status'][me_id][name]['info']

        socketio.emit('message', {'action': 'status', 'p': ''}, namespace='/canary', room=name)

        if not isinstance(s, int):
            s = -3;

        stage = int(s)
        if stage is -2:
            i = _('logouting')
        if stage is -1:
            i = _('start line setting syncing')
        elif stage is 0:
            i = _('starting line setting sync ')
        elif stage is 1:
            i = _('start sim chat with line official account')
        elif stage is 2:
            i = _('done for sim chat with line official account')
        elif stage is 3:
            i = _('start delete login message')
        elif stage is 4:
            i = _('done for delete login message')
        elif stage is 5:
            i = _('start add friend')
        elif stage is 6:
            i = _('start get monitor user info')
        elif stage is 7:
            i = _('start syncing history') + " " + i

        return '{"status": %d, "info": "%s", "me_id": "%s", "user_name": "%s", "icon_base64": "%s"}' % \
            (stage, i, me_id, user_name, icon_base64)


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
        me_id = request.args.get('me_id', default = '-1', type = str) # me_id means be monitored's line id
        #LineFuncuntionView._heartbeat(name)

        resp = {'is_find': 0, 'is_alive': 0}
        _datamodel = SQLAInterface(ProjectFiles, db.session)
        filters = _datamodel.get_filters()
        filters.add_filter('name', FilterEqual, name)
        count, item = _datamodel.query(filters=filters, order_column='id', order_direction='desc', page_size=-1)

        if count:
            item = item[0]
            resp['is_alive'] = item.status
            resp['is_find'] = 1

            s = ""
            i = ""
            if me_id in g['status'] and name in g['status'][me_id]:
                if 'status' in g['status'][me_id][name]:
                    s = g['status'][me_id][name]['status']
                elif 'info' in g['status'][me_id][name]:
                    i = g['status'][me_id][name]['info']

            resp['status'] = s
            resp['info'] = i

            if i == "":
                resp['info'] = _('logouting')

        return self.response(200, resp=resp)
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

            _datamodel = SQLAInterface(ProjectFiles, self.datamodel.session)
            filters = _datamodel.get_filters()
            filters.add_filter('name', FilterEqual, name)
            count, item = _datamodel.query(filters=filters)
            for i in item:
                #g['is_logout'][name] = -2
                i.status = -2
                _datamodel.add(i)

                global g
                g['status'][i.me_id][name]['status'] = -1

            #return redirect(self.route_base)

        widgets = self._list()
        return self.render_template(
            'line_function.html',
            title=self.list_title, widgets=widgets, is_logout=True, resp=resp)


appbuilder.add_view(LineFuncuntionView, 'add friend', icon="fa-user-plus", category='Line',
                    category_icon = "fa fa-user-o")
appbuilder.add_link('logout',href='/linefuncuntion/logout', icon="fa-sign-out", category='Line')

appbuilder.add_view(ProjectFile, "Add line monitor", icon="fa fa-qrcode", category="Line")
#appbuilder.add_view(ProjectFilesByUser, "line function", icon="fa fa-qrcode", category="Line",
#                    category_icon = "fa-envelope")
appbuilder.add_view(ProjectFilesByUser, "line function", icon="fa fa-qrcode", category="Line",
                    category_icon = "fa-envelope")
#appbuilder.add_view(
#    ProjectFilesModelView, "List all", icon="fa-table", category="Projects"
#)
appbuilder.add_link('Line', label=_('monitor list'), icon="fa-user-plus", href='/projectfilesbyuser/show')
appbuilder.add_view(ProjectModelView, "List All Qrcode group", icon="fa-table", category="Line")
appbuilder.add_view(ProjectFilesModelView, "List All Qrcode", icon="fa-table", category="Line")
appbuilder.add_view_no_menu(ProjectFilesModelView)
appbuilder.add_view_no_menu(ShowProjectFilesByUser)
#appbuilder.add_view_no_menu(s)

db.create_all()
