import datetime

from flask import Markup, url_for
from flask_appbuilder.models.mixins import AuditMixin, FileColumn
from sqlalchemy import Table, Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship, backref
from sqlalchemy import event
from flask_appbuilder.filemanager import ImageManager
from flask_appbuilder import Model
from flask_appbuilder.filemanager import get_file_original_name

import logging
log = logging.getLogger(__name__)

"""
You can use the extra Flask-AppBuilder fields and Mixin's
AuditMixin will add automatic timestamp of created and modified by who
"""

class Project(AuditMixin, Model):
    __tablename__ = "project"
    id = Column(Integer, primary_key=True, autoincrement = True)
    user_id = Column(Integer, ForeignKey("ab_user.id"), nullable=True)
    user = relationship("User", foreign_keys='Project.user_id')
    name = Column(String(150), unique=True, nullable=False)
    #project_id = Column(Integer, ForeignKey('project_files.id'))
    #projectfiles = relationship('ProjectFiles', foreign_keys='Project.id', back_populates='project')
    #projectfiles = relationship('ProjectFiles', foreign_keys='Project.id')


class ProjectFiles(Model):
    __tablename__ = "project_files"
    id = Column(Integer, primary_key=True, autoincrement = True)
    project_id = Column(Integer, ForeignKey("project.id"))
    project = relationship("Project", backref=backref("ProjectFiles", cascade="all, delete-orphan"))
    file = Column(FileColumn, nullable=True)
    description = Column(String(150))
    login_qrcode_base64 = Column(String)

    def download(self):
        if self.file is None:
            return ""

        return Markup(
            '<a href="'
            + url_for("ProjectFilesModelView.download", filename=str(self.file))
            + '">Download</a>'
            + '<img style="margin: 0 auto; padding:5%" src="'+url_for("ProjectFilesModelView.download", filename=str(self.file))+'" class="img-responsive" alt="...">'

        )

    def qrcode(self):
        return Markup(
            '<img style="margin: 0 auto; padding:5%" src="'+self.login_qrcode_base64+'" class="img-responsive" alt="...">'

        )

    def file_name(self):
        if self.file is None:
            return ""

        return get_file_original_name(str(self.file))

class LindFriend(AuditMixin, Model):
    __tablename__ = "linefriend"
    id = Column(Integer, primary_key=True, autoincrement = True)
    user_id = Column(Integer, ForeignKey("ab_user.id"), nullable=True)
    user = relationship("User", foreign_keys='LindFriend.user_id')
    line_id = Column(String, nullable=False)
    updated = Column(DateTime, default=datetime.datetime.utcnow)


@event.listens_for(ProjectFiles, 'after_delete')
def receive_after_delete(mapper, connection, target):
    "listen for the 'after_delete' event"
    #log.error("target", target, target.file)
    if target.file:
        im = ImageManager()
        im.delete_file(target.file)
