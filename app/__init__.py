import logging

from flask import Flask
from flask_appbuilder import AppBuilder, SQLA
from flask_socketio import SocketIO

from gevent import monkey
monkey.patch_all()



"""
 Logging configuration
"""

IS_DEBUG = True
IS_DEBUG = False

logging.basicConfig(format="%(asctime)s:%(levelname)s:%(name)s:%(message)s")
logging.getLogger().setLevel(logging.DEBUG)

if IS_DEBUG:
    logging.getLogger().setLevel(logging.DEBUG)
    #logging.basicConfig()
    logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
else:
    logging.getLogger('engineio.server').setLevel(logging.WARN)
    logging.getLogger('flask_appbuilder').setLevel(logging.WARN)


app = Flask(__name__)
app.config.from_object("config")
db = SQLA(app)
#appbuilder = AppBuilder(app, db.session, indexview='ShowProjectFilesByUser')
appbuilder = AppBuilder(app, db.session)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = False;
socketio = SocketIO(app, manage_session=False)


"""
from sqlalchemy.engine import Engine
from sqlalchemy import event

#Only include this for SQLLite constraints
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    # Will force sqllite contraint foreign keys
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
"""
from . import views
from . import models
