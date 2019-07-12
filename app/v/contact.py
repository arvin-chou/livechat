from flask import (
    request,
    redirect,
)
from flask import render_template
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder import ModelView, ModelRestApi
from flask_appbuilder import AppBuilder,expose,BaseView,has_access
from flask_appbuilder.models.sqla.filters import FilterEqual 
from flask_appbuilder.actions import action

from flask_login import current_user
from app.m.contact import ContactGroup, Contact
from app.m.quickfiles import ProjectFiles
from app import appbuilder, db
#import dateutil

import logging
log = logging.getLogger(__name__)

class ContactModelView(ModelView):
    datamodel = SQLAInterface(Contact)

    @expose("/list/")
    @has_access
    def list(self):
        if current_user.id != 1:
            filter_user_id = self._base_filters.get_filter_value('user_id')
            if filter_user_id is None or filter_user_id != current_user.id:
                self._base_filters.clear_filters()
                self._base_filters.add_filter('user_id', FilterEqual, current_user.id)
        else:
            self._base_filters.clear_filters()

        widgets = self._list()
        return self.render_template(
            self.list_template, title=self.list_title, widgets=widgets)

    label_columns = {'contact_group':'Contacts Group',
                     'from_display_name': 'from_display_name',
                     'me_id': 'me_id',
                     'from_id': 'from_id',
                     'c_type': 'c_type',
                     'icon_base64': 'icon_base64'
                     }
    list_columns = ['id', 'from_display_name','msg', 'updated', 'me_id', 'from_id', 'c_type', 'icon_base64']
 
    show_fieldsets = [
                        (
                            'Summary',
                            {'fields':['name', 'msg']}
                        ),
                        (
                            'time',
                            {'fields':['updated'],'expanded':False}
                        ),
                     ]

# 在联系人组视图中，我们使用related_views来关联联系人视图，F.A.B.将自动处理他们之间的关系。
class ContactGroupModelView(ModelView):
    datamodel = SQLAInterface(ContactGroup)
    related_views = [ContactModelView]

    @action("muldelete", "Delete", "Delete all Really?", "fa-rocket", single=False)
    def muldelete(self, items):
        self.datamodel.delete_all(items)
        self.update_redirect()
        return redirect(self.get_redirect())

    @expose("/list/")
    @has_access
    def list(self):
        name = request.args.get('name', default = '-1', type = str)
        me_id = request.args.get('me_id', default = '-1', type = str) # me_id means be monitored's line id

        s = self.datamodel.session
        _datamodel = SQLAInterface(ProjectFiles)
        _datamodel.session = s
        filters = _datamodel.get_filters()
        filters.add_filter('name', FilterEqual, name)
        count, item = _datamodel.query(filters=filters, page_size=0)

        base_order = self.base_order
        page_size = self.page_size
        order_columns = self.order_columns;
        formatters_columns = self.formatters_columns

        if count is 0 or ProjectFiles.is_not_active(item[0]):
            name = -1

        if current_user.id != 1:
            filter_user_id = self._base_filters.get_filter_value('user_id')
            if filter_user_id is None or filter_user_id != current_user.id:
                pass

            self._base_filters.clear_filters()
            self._base_filters.add_filter('user_id', FilterEqual, current_user.id)
            self._base_filters.add_filter('projectfiles_name', FilterEqual, name)
            self._base_filters.add_filter('me_id', FilterEqual, me_id)

            self.list_columns = ['name', 'updated']

            self.page_size = -1
            self.base_order = ('updated','desc')
            self.order_columns = ['updated']

        else:
            self._base_filters.clear_filters()
            self.list_columns = ['name', 'updated', 'user_id']

        if self.__class__.__name__ is 'ContactGroupModelChatView':
            self.formatters_columns = {'updated': lambda x: x.strftime('%p %I:%M').lstrip("0").replace(" 0", "") if x is not None else ""}
            #self.formatters_columns = {'updated': lambda x: dateutil.parser.parse(x).strftime('%p %I:%M').lstrip("0").replace(" 0", "") }
            self.list_columns = ['name', 'id', 'line_id', 'updated', 'icon_base64']

        widgets = self._list()

        if self.__class__.__name__ is 'ContactGroupModelChatView':
            widgets['list'].template = "chat_group.html"

        self.page_size = page_size
        self.base_order = base_order
        self.formatters_columns = formatters_columns
        self.order_columns = order_columns;

        return self.render_template(
            self.list_template, title=self.list_title, widgets=widgets)

    #base_filters = [['user_id', FilterEqual, id]]
    search_columns = ['user', 'name', 'line_id', 'updated']
    list_columns = ['name', 'updated', 'user_id']
    show_columns = ['name', 'Contact']
    #add_fieldsets = [
    #                    (
    #                        'Summary',
    #                        {'fields':['name']}
    #                    ),
    #                    (
    #                        'time',
    #                        {'fields':['name'],'expanded':False}
    #                    ),
    #                 ]

class ContactGroupModelChatView(ContactGroupModelView):
    #datamodel = SQLAInterface(ContactGroup)
    #related_views = [ContactModelView]

    ##base_filters = [['user_id', FilterEqual, id]]
    #list_columns = ['name','user_id']
    #show_columns = ['name', 'Contact']
    list_template = "chat.html"
    ##add_fieldsets = [
    ##                    (
    ##                        'Summary',
    ##                        {'fields':['name']}
    ##                    ),
    ##                    (
    ##                        'time',
    ##                        {'fields':['name'],'expanded':False}
    ##                    ),
    #                 ]
 

# 现在我们就差最后一步工作就要完成本次实验了。
# 首先使用db.create_all()根据数据库模型创建表，然后再将视图添加到菜单。
 
db.create_all()
appbuilder.add_view(ContactGroupModelChatView,
                    "Chat",
                    icon = "fa-address-book-o",
                    category = "Contacts",
                    category_icon = "fa-envelope")
appbuilder.add_view(ContactGroupModelView,
                    "List Groups",
                    icon = "fa-address-book-o",
                    category = "Contacts",
                    category_icon = "fa-envelope")
appbuilder.add_view(ContactModelView,
                    "List Contacts",
                    icon = "fa-address-card-o",
                    category = "Contacts")

#appbuilder.add_view(SwaggerView,
#                    "SwaggerView",
#                    icon = "fa-address-card-o",
#                    category = "manager")
