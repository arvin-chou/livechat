import os
from flask_appbuilder.security.manager import (
    AUTH_OID,
    AUTH_REMOTE_USER,
    AUTH_DB,
    AUTH_LDAP,
    AUTH_OAUTH,
)

basedir = os.path.abspath(os.path.dirname(__file__))

# Your App secret key
SECRET_KEY = "\2\1kDA-VKhY6y@C6-UT\1\2\e\y\y\h"

# The SQLAlchemy connection string.
SQLALCHEMY_DATABASE_URI = "sqlite:///" + os.path.join(basedir, "app.db")
#SQLALCHEMY_ECHO = True
SQLALCHEMY_TRACK_MODIFICATIONS = False
from sqlalchemy.pool import QueuePool, SingletonThreadPool

#_setdefault('pool_size', 'SQLALCHEMY_POOL_SIZE')
#_setdefault('pool_timeout', 'SQLALCHEMY_POOL_TIMEOUT')
#_setdefault('pool_recycle', 'SQLALCHEMY_POOL_RECYCLE')
#_setdefault('max_overflow', 'SQLALCHEMY_MAX_OVERFLOW')
#SQLALCHEMY_POOL_SIZE = 100
#SQLALCHEMY_ENGINE_OPTIONS = {
#        'poolclass': SingletonThreadPool,
#        'pool_size' : 100,
#        'pool_recycle':120,
#        'pool_pre_ping': True
#        }
# SQLALCHEMY_DATABASE_URI = 'mysql://myapp@localhost/myapp'
# SQLALCHEMY_DATABASE_URI = 'postgresql://root:password@localhost/myapp'
#from sqlalchemy import create_engine
#from sqlalchemy import Table, Column, Integer, String, Boolean, ForeignKey, DateTime
#from sqlalchemy.dialects.mysql import LONGTEXT
#
#engine = create_engine(SQLALCHEMY_DATABASE_URI)
#
#def add_column(engine, table_name, column):
#    column_name = column.compile(dialect=engine.dialect)
#    column_type = column.type.compile(engine.dialect)
#    engine.execute('ALTER TABLE %s ADD COLUMN %s %s' % (table_name, column_name, column_type))
#def del_column(engine, table_name, column):
#    column_name = column.compile(dialect=engine.dialect)
#    column_type = column.type.compile(engine.dialect)
#    engine.execute('ALTER TABLE %s DROP COLUMN %s ' % (table_name, column_name))
#
#
#
##column = Column('updated', DateTime)
##column= Column('c_type', Integer)
##column= Column('line_id', String)
##column= Column('msg', LONGTEXT)
##column= Column('login_qrcode_base64', String)
##column= Column('user_name', String)
##add_column(engine, 'project_files', column)
##column= Column('me_id', String)
##add_column(engine, 'contact_group', column)
##add_column(engine, 'project_files', column)
##column= Column('icon_base64', String)
##add_column(engine, 'project_files', column)
#
##del_column(engine, 'project', column)
##column= Column('icon_base64', String)
##add_column(engine, 'contact', column)
##column= Column('contactgroup_id', Integer)
##add_column(engine, 'project', column)
##column= Column('is_visible', Integer)
##add_column(engine, 'contact_group', column)
##column= Column('updated', DateTime)
##add_column(engine, 'linefriend', column)
##engine.execute('update contact_group set user_id = 4')
##engine.execute('update contact set user_id = 4')
##Contact.__table__.drop(engine)
##Contact.__table__.drop(engine)
##ContactGroup.__table__.drop(engine)
##from app.m.quickfiles import Project, ProjectFiles, LindFriend
##ProjectFiles.__table__.drop(engine)
##LindFriend.__table__.drop(engine)


# Flask-WTF flag for CSRF
CSRF_ENABLED = True

# ------------------------------
# GLOBALS FOR APP Builder
# ------------------------------
# Uncomment to setup Your App name
APP_NAME = "Canary"

# Uncomment to setup Setup an App icon
# APP_ICON = "static/img/logo.jpg"

# ----------------------------------------------------
# AUTHENTICATION CONFIG
# ----------------------------------------------------
# The authentication type
# AUTH_OID : Is for OpenID
# AUTH_DB : Is for database (username/password()
# AUTH_LDAP : Is for LDAP
# AUTH_REMOTE_USER : Is for using REMOTE_USER from web server
AUTH_TYPE = AUTH_DB

# Uncomment to setup Full admin role name
# AUTH_ROLE_ADMIN = 'Admin'

# Uncomment to setup Public role name, no authentication needed
# AUTH_ROLE_PUBLIC = 'Public'

# Will allow user self registration
# AUTH_USER_REGISTRATION = True

# The default user self registration role
# AUTH_USER_REGISTRATION_ROLE = "Public"

# When using LDAP Auth, setup the ldap server
# AUTH_LDAP_SERVER = "ldap://ldapserver.new"

# Uncomment to setup OpenID providers example for OpenID authentication
# OPENID_PROVIDERS = [
#    { 'name': 'Yahoo', 'url': 'https://me.yahoo.com' },
#    { 'name': 'AOL', 'url': 'http://openid.aol.com/<username>' },
#    { 'name': 'Flickr', 'url': 'http://www.flickr.com/<username>' },
#    { 'name': 'MyOpenID', 'url': 'https://www.myopenid.com' }]
# ---------------------------------------------------
# Babel config for translations
# ---------------------------------------------------
# Setup default language
BABEL_DEFAULT_LOCALE = "zh_TW"
# Your application default translation path
BABEL_DEFAULT_FOLDER = "translations"
# The allowed translation for you app
LANGUAGES = {
    "zh_TW": {"flag": "tw", "name": "Taiwan"},
    #"en": {"flag": "gb", "name": "English"},
    #"pt": {"flag": "pt", "name": "Portuguese"},
    #"pt_BR": {"flag": "br", "name": "Pt Brazil"},
    #"es": {"flag": "es", "name": "Spanish"},
    #"de": {"flag": "de", "name": "German"},
    #"zh": {"flag": "cn", "name": "Chinese"},
    #"ru": {"flag": "ru", "name": "Russian"},
    #"pl": {"flag": "pl", "name": "Polish"},
}
# ---------------------------------------------------
# Image and file configuration
# ---------------------------------------------------
# The file upload folder, when using models with files
UPLOAD_FOLDER = basedir + "/app/static/uploads/"

# The image upload folder, when using models with images
IMG_UPLOAD_FOLDER = basedir + "/app/static/uploads/"

# The image upload url, when using models with images
IMG_UPLOAD_URL = "/static/uploads/"
# Setup image size default is (300, 200, True)
IMG_SIZE = (300, 200, True)


# Theme configuration
# these are located on static/appbuilder/css/themes
# you can create your own and easily use them placing them on the same dir structure to override
# APP_THEME = "bootstrap-theme.css"  # default bootstrap
# APP_THEME = "cerulean.css"
# APP_THEME = "amelia.css"
# APP_THEME = "cosmo.css"
# APP_THEME = "cyborg.css"
# APP_THEME = "flatly.css"
# APP_THEME = "journal.css"
# APP_THEME = "readable.css"
# APP_THEME = "simplex.css"
# APP_THEME = "slate.css"
# APP_THEME = "spacelab.css"
# APP_THEME = "united.css"
# APP_THEME = "yeti.css"
