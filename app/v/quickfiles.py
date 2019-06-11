from flask_login import current_user

from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.views import ModelView, CompactCRUDMixin
from app.m.quickfiles import Project, ProjectFiles
from app import appbuilder, db
from flask_appbuilder import AppBuilder,expose,BaseView,has_access
from flask_appbuilder.urltools import get_filter_args, get_order_args, get_page_args, get_page_size_args
from flask_appbuilder.widgets import RenderTemplateWidget
from flask_appbuilder.models.sqla.filters import FilterEqual 
from flask_appbuilder.models.filters import Filters
from flask_appbuilder.baseviews import BaseCRUDView


import logging
log = logging.getLogger(__name__)

class ProjectFilesModelView(ModelView):
    datamodel = SQLAInterface(ProjectFiles)

    label_columns = {"file_name": "File Name", "download": "Download"}
    add_columns = ["file", "description", "project"]
    edit_columns = ["file", "description", "project"]
    list_columns = ["file_name", "qrcode", "download"]
    show_columns = ["file_name", "qrcode", "download"]

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
    edit_columns = ["name", "user_id"]
    list_columns = ["name", "user_id", "created_by", "created_on", "changed_by", "changed_on"]
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


db.create_all()
appbuilder.add_view(
    ProjectFile, "Add line monitor", icon="fa-table", category="Line"
)
#appbuilder.add_view(
#    ProjectFilesModelView, "List all", icon="fa-table", category="Projects"
#)
#appbuilder.add_link('Add line monitor', icon="fa-table", href='/index/hello', category='Projects')
appbuilder.add_view(
    ProjectModelView, "List All", icon="fa-table", category="Line"
)
appbuilder.add_view_no_menu(ProjectFilesModelView)
