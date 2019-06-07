from flask import Markup, url_for
from flask_appbuilder.models.mixins import AuditMixin, FileColumn
from sqlalchemy import Table, Column, Integer, String, Boolean, ForeignKey
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


class ProjectFiles(Model):
    __tablename__ = "project_files"
    id = Column(Integer, primary_key=True, autoincrement = True)
    project_id = Column(Integer, ForeignKey("project.id"))
    project = relationship("Project", backref=backref("ProjectFiles", cascade="all, delete-orphan"))
    file = Column(FileColumn, nullable=False)
    description = Column(String(150))

    def download(self):
        return Markup(
            '<a href="'
            + url_for("ProjectFilesModelView.download", filename=str(self.file))
            + '">Download</a>'
            + '<img style="margin: 0 auto; padding:5%" src="'+url_for("ProjectFilesModelView.download", filename=str(self.file))+'" class="img-responsive" alt="...">'

        )

    def file_name(self):
        return get_file_original_name(str(self.file))

@event.listens_for(ProjectFiles, 'after_delete')
def receive_after_delete(mapper, connection, target):
    "listen for the 'after_delete' event"
    #log.error("target", target, target.file)
    im = ImageManager()
    im.delete_file(target.file)
