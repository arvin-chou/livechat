from flask import render_template
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder import ModelView, ModelRestApi
from flask_appbuilder import AppBuilder,expose,BaseView,has_access
from .v.quickfiles import *
from .v.contact import *


from . import appbuilder, db

"""
    Create your Model based REST API::

    class MyModelApi(ModelRestApi):
        datamodel = SQLAInterface(MyModel)

    appbuilder.add_api(MyModelApi)


    Create your Views::


    class MyModelView(ModelView):
        datamodel = SQLAInterface(MyModel)


    Next, register your Views::


    appbuilder.add_view(
        MyModelView,
        "My View",
        icon="fa-folder-open-o",
        category="My Category",
        category_icon='fa-envelope'
    )
"""

"""
    Application wide 404 error handler
"""
class indexView(BaseView):
    route_base = '/index'
    default_view = 'add_monitor'
    @expose('/add_monitor')
    def add_monitor(self):
        links = []
        from flask import current_app, url_for
        for rule in current_app.url_map.iter_rules():
            # Filter out rules we can't navigate to in a browser
            # and rules that require parameters
            #url = url_for(rule.endpoint, **(rule.defaults or {}))
            #links.append((url, rule.endpoint))
            links.append((rule.defaults, rule.endpoint))
        return '\n'.join(map(str, links))
    #return self.render_template('add_monitor.html',data={})
    @expose('/message/<string:msg>')
    @has_access
    def message(self,msg):
        msg = 'Hello ' + msg
        return self.render_template('index.html',msg=msg)
# 在菜单中生成访问的链接
appbuilder.add_view(indexView,'add monitor',category='Line')
appbuilder.add_link('message',href='/index/message/user',category='Line')
appbuilder.add_link('welcome',href='/index/hello',category='Line')


@appbuilder.app.errorhandler(404)
def page_not_found(e):
    return (
        render_template(
            "404.html", base_template=appbuilder.base_template, appbuilder=appbuilder
        ),
        404,
    )


db.create_all()
