from flask import render_template
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder import ModelView, ModelRestApi
from flask_appbuilder import AppBuilder,expose,BaseView,has_access
from flask_appbuilder.models.sqla.filters import FilterEqual 
from flask_login import current_user
from app.m.contact import ContactGroup, Contact
from app import appbuilder, db

import logging
log = logging.getLogger(__name__)

class ContactModelView(ModelView):
    datamodel = SQLAInterface(Contact)

    @expose("/list/")
    @has_access
    def list(self):
        if current_user.id != 1:
            if self._base_filters.get_filter_value('user_id') is None:
                self._base_filters.add_filter('user_id', FilterEqual, current_user.id)

        widgets = self._list()
        return self.render_template(
            self.list_template, title=self.list_title, widgets=widgets)

    label_columns = {'contact_group':'Contacts Group'}
    list_columns = ['id', 'name','msg', 'updated', 't']
 
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

    @expose("/list/")
    @has_access
    def list(self):
        if current_user.id != 1:
            if self._base_filters.get_filter_value('user_id') is None:
                self._base_filters.add_filter('user_id', FilterEqual, current_user.id)
            self.list_columns = ['name']
        else:
            self.list_columns = ['name','user_id']

        if self.__class__.__name__ is 'ContactGroupModelChatView':
            self.list_columns = ['name', 'id', 'line_id']

        widgets = self._list()

        if self.__class__.__name__ is 'ContactGroupModelChatView':
            widgets['list'].template = "chat_group.html"

        return self.render_template(
            self.list_template, title=self.list_title, widgets=widgets)

    #base_filters = [['user_id', FilterEqual, id]]
    list_columns = ['name','user_id']
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
