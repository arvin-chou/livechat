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
from werkzeug.utils import secure_filename

from flask_jwt_extended import (
    JWTManager, verify_jwt_in_request, create_access_token,
    get_jwt_claims
)

from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import protect
from flask_appbuilder import ModelView, ModelRestApi
from flask_appbuilder.models.sqla.filters import FilterEqual 
from flask_appbuilder.api import expose
from flask_appbuilder.api import safe
from flask_appbuilder.filemanager import ImageManager
from app import appbuilder, db
from app.m.quickfiles import Project, ProjectFiles
from app.v.quickfiles import ProjectModelView, ProjectFilesModelView

import logging
log = logging.getLogger(__name__)

class ProjectModelApi(ModelRestApi):
    projectmodelview = ProjectModelView()
    datamodel = SQLAInterface(Project)
    resource_name = "projectmodelview"
    version = "1.0"

    def add_apispec_components(self, api_spec):
        super(SecurityApi, self).add_apispec_components(api_spec)
        jwt_scheme = {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
        api_spec.components.security_scheme("jwt", jwt_scheme)

    @expose('/private')
    @protect()
    def rison_json(self):
        """Say it's risonjson
        ---
        get:
          responses:
            200:
              description: Say it's private
              content:
                application/json:
                  schema:
                    type: object
            401:
              $ref: '#/components/responses/401'
        """
        return self.response(200, message="This is private")

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
        if request.is_json:
            name = request.json.get('name', None)
            login_qrcode_base64 = request.json.get('login_qrcode_base64', None)
            description = request.json.get('description', None)

            if name is None or login_qrcode_base64 is None:
                return self.response_400(message="Request payload is not JSON")

            s = self.datamodel.session
            datamodel = SQLAInterface(Project)
            datamodel.session = s

            filters = datamodel.get_filters()
            filters.add_filter('name', FilterEqual, name)
            count, item = datamodel.query(filters=filters, page_size=1)
            if count:
                item = item[0]
                pid = item.id
                datamodel = SQLAInterface(ProjectFiles)
                datamodel.session = s
                filters = datamodel.get_filters()
                filters.add_filter('project_id', FilterEqual, pid)
                count, child = datamodel.query(filters=filters, page_size=1)
                child = child[0]

            else:
                item = datamodel.obj()
                item.name = name
                item.created_by_fk = 1
                item.changed_by_fk = 1

                datamodel.add(item)

                pid = item.id

                datamodel = SQLAInterface(ProjectFiles)
                datamodel.session = s
                child = datamodel.obj()

            child.project = item
            child.description = description
            child.login_qrcode_base64 = login_qrcode_base64
            datamodel.add(child)

        else:
            name = request.form.get('name')

            if not name:
                return self.response_400(message="Missing required parameter")

            if 'file' not in request.files:
                flash('No file part')
                return self.response_400(message="Missing file parameter")
            file = request.files['file']

            if file.filename == '':
                return self.response_400(message="no file select")
            #filename = secure_filename(file.filename)
            #file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))

            s = self.datamodel.session
            datamodel = SQLAInterface(Project)
            datamodel.session = s
            item = datamodel.obj()
            item.name = name
            item.created_by_fk = 1
            item.changed_by_fk = 1

            datamodel.add(item)
            pid = item.id

            im = ImageManager()
            filename = im.save_file(file, im.generate_name(file, file))

            datamodel = SQLAInterface(ProjectFiles)
            datamodel.session = s
            child = datamodel.obj()
            child.file = filename
            child.project = item
            child.description = request.form.get('description')
            datamodel.add(child)
        #datamodel._add_files(request, item)
        #log.warning("XX", item.id, "VV")

        return self.response(200, message=datamodel.message)


    @expose("/api/read", methods=["GET"])
    @safe
    def login(self):
        """Login endpoint for the API returns a JWT and optionally a refresh token
        ---
        post:
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    username:
                      type: string
                    password:
                      type: string
                    provider:
                      type: string
                      enum:
                      - db
                      - ldap
                    refresh:
                      type: boolean
          responses:
            200:
              description: Authentication Successful
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      access_token:
                        type: string
                      refresh_token:
                        type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        #if not request.is_json:
        #    return self.response_400(message="Request payload is not JSON")
        #username = request.json.get(API_SECURITY_USERNAME_KEY, None)
        #password = request.json.get(API_SECURITY_PASSWORD_KEY, None)
        #provider = request.json.get(API_SECURITY_PROVIDER_KEY, None)
        #refresh = request.json.get(API_SECURITY_REFRESH_KEY, False)
        #if not username or not password or not provider:
        #    return self.response_400(message="Missing required parameter")
        ## AUTH
        #if provider == API_SECURITY_PROVIDER_DB:
        #    user = self.appbuilder.sm.auth_user_db(username, password)
        #elif provider == API_SECURITY_PROVIDER_LDAP:
        #    user = self.appbuilder.sm.auth_user_ldap(username, password)
        #else:
        #    return self.response_400(
        #        message="Provider {} not supported".format(provider)
        #    )
        #if not user:
        #    return self.response_401()

        ## Identity can be any data that is json serializable
        #resp = dict()
        #resp[API_SECURITY_ACCESS_TOKEN_KEY] = create_access_token(
        #    identity=user.id, fresh=True
        #)
        #if refresh:
        #    resp[API_SECURITY_REFRESH_TOKEN_KEY] = create_refresh_token(
        #        identity=user.id
        #    )
        #return self.response(200, **resp)



appbuilder.add_api(ProjectModelApi)
#

