from flask_babel import lazy_gettext as _
import datetime
import base64
from io import BytesIO

from flask import Markup, url_for
from app import app
from flask_appbuilder.models.mixins import AuditMixin, FileColumn
from sqlalchemy import Table, Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship, backref
from sqlalchemy import event
from flask_appbuilder.filemanager import ImageManager
from flask_appbuilder import Model
from flask_appbuilder.filemanager import get_file_original_name
from app.m.contact import ContactGroup

from pyzbar.pyzbar import decode
from PIL import Image
import qrcode
import os.path as op

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
    limit_qrcode = Column(Integer, unique=False, default=1)
    current = Column(Integer, unique=False, default=0)
    #project_id = Column(Integer, ForeignKey('project_files.id'))
    #projectfiles = relationship('ProjectFiles', foreign_keys='Project.id', back_populates='project')
    #projectfiles = relationship('ProjectFiles', foreign_keys='Project.id')
    projectfiles = relationship('ProjectFiles')


class ProjectFiles(Model):
    __tablename__ = "project_files"
    id = Column(Integer, primary_key=True, autoincrement = True)
    name = Column(String(150), unique=True, nullable=False)
    project_id = Column(Integer, ForeignKey("project.id"))
    project = relationship("Project", backref=backref("ProjectFiles", cascade="all, delete-orphan"))
    file = Column(FileColumn, nullable=True)
    description = Column(String(150)) # my line id
    login_qrcode_base64 = Column(String)
    status = Column(Integer, default=0) # 0 is logout, 1 is online, -2 is delete account and wait re-fresh qrcode
    validate_time = Column(DateTime)
    user_name = Column(String) # for be monitored display name
    icon_base64 = Column(String) # for be monitored image
    me_id = Column(String) # for current monitor's line inner id

    def username(self):
        user = ''
        if self.project:
            user = self.project.user.username

        return Markup(user)
            
        

    def showchat(self):
        if self.is_not_active(self):
            return ""

        s = _('show chat')
        s = ""
        if self.is_offline() or self.is_logouting():
            pass
        else:
            s = """ 
                <div class="list clearfix">
                    <div class="image-cropper">
                      <img class="profile-pic" src="data:image/png;base64,%s" alt="avatar" />
                    </div>
                    <div class="clearfix"></div>
                    <div class="about">
                      <div class="name" data-me_id="%s" data-name="%s">%s</div>
                      <div class="status"></div>
                    </div>
                  </div>
              """ % (self.icon_base64, self.me_id, self.name, self.user_name)

        return Markup(
                '<a class="chat_link" data-me_id="'+self.me_id+'" data-name="'+self.name+'" href="'
                + url_for("ContactGroupModelChatView.list", name=str(self.name),
                me_id=str(self.me_id))
                + '">' + s + '</a>'
                )

    @staticmethod
    def is_not_active(p):
        return p.validate_time is None or p.validate_time < datetime.datetime.now()

    def is_offline(self):
        return self.status == 0

    def is_logouting(self):
        return self.status == -2

    def is_active(self):
        return not self.is_not_active(self)

    def active(self):
        tooltip = ""
        bottom_status = ""
        if self.is_not_active(self):
            bottom_status = "danger"
            tooltip = _("not active your account, please re-enable it")

        else:
            bottom_status = "secondary"
            tooltip = _("no monitor user")
            if self.status is 1:
                bottom_status = "info"
                tooltip = _("monitoring user")

        btn = '<button type="button" class="btn btn-%s btn-circle btn-sm"><i class="glyphicon glyphicon-ok" data-toggle="tooltip" data-placement="top" data-original-title="%s"></i></button>' % (bottom_status, tooltip)
            
        return Markup(btn)


    def add(self):
        return Markup(
                '<a href="'
                + url_for("LineFuncuntionView.add", name=str(self.name))
                + '">add friend</a>'
                )

    def logout(self):
        if self.status is 0:
            return Markup("<a class='offline' href='#'></a>")

        return Markup(
            '<a class="logout" href="'
            + url_for("LineFuncuntionView.logout", name=str(self.name))
            + '">' + _("line logout") +'</a>'
        )

    def download(self):
        if self.file is None:
            return ""

        return Markup(
            '<a href="'
            + url_for("ProjectFilesModelView.download", filename=str(self.file))
            + '">Download</a>'
            + '<img style="margin: 0 auto; padding:5%" src="'+url_for("ProjectFilesModelView.download", filename=str(self.file))+'" class="img-responsive" alt="...">'

        )

    def add_friend(self):
        return Markup(
            '<div class="qr-code-container text-center"><img class="qr-code-'+str(self.id)+'" style="margin: 0 auto; padding:5%" src="'+url_for("ProjectFilesModelView.download", filename=str(self.file))+'" class="img-responsive" alt="..."><div class="qr-code-centered"></div></div>'
        )

    def qrcode(self):
        s = """ 
        <script type="text/javascript">
          $(document).ready(function() {
            var $img = $('img');
            var old_src = $img.attr('src');
            var reload_qrcode = function() {
              var url = '/projectfile/show/0';
              url = url.slice(0, -1);
              url = location.href;
              $.get(url, function(){
              }).done(function(msgs) {
                var $child = $(msgs);
                var $img = $child.find('img');
                var src = $img.attr('src');
                $('img').attr('src', src);
                setTimeout(reload_qrcode, 6000)
              });
            }
            setTimeout(reload_qrcode, 6000)
          });
        </script>
            """
        if not self.login_qrcode_base64:
             return ""

        img_str = self.login_qrcode_base64
        #if self.is_offline() and self.is_active():
        #        # gen image with base64 and with timestamp without permission
        #        qr = qrcode.QRCode(
        #                version=1,
        #                error_correction=qrcode.constants.ERROR_CORRECT_L,
        #                box_size=9,
        #                border=2,
        #                )
        #        from app.v.quickfiles import s
        #        url = url_for("s.g",  _external=True,
        #            pid = str(self.id), 
        #            t=str(datetime.datetime.now().timestamp()))
        #        qr.add_data(url)
        #        qr.make(fit=True)
        #        img = qr.make_image()

        #        buffered = BytesIO()
        #        img.save(buffered, format="PNG")
        #        img_str = base64.b64encode(buffered.getvalue())
        #        img_str = "data:image/png;base64," + str(img_str, 'utf-8')
        
        return Markup(
             #s + 
             #'<link href="' + url_for('static',filename='css/basic.css') + '?v=3" rel="stylesheet">' + 
            #'<div class="qr-code-container text-center"><img class="qr-code-'+str(self.id)+'" style="margin: 0 auto; padding:5%" src="'+self.login_qrcode_base64+'" class="img-responsive" alt="..."><div class="qr-code-centered"></div></div>'
            '<div class="qr-code-container text-center"><img class="qr-code-'+str(self.id)+'" style="margin: 0 auto; padding:5%" src="'+(img_str)+'" class="img-responsive" alt="..."><div class="qr-code-centered"></div></div>'

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
    name = Column(String(150), unique=True, nullable=False)


#@event.listens_for(ProjectFiles, 'after_insert')
@event.listens_for(ProjectFiles, 'after_update')
def receive_after_insert_update(mapper, connection, target):
    "listen for the 'after_delete' event"
    #log.error("target", target, target.file)
    if target.file:
        file_abs_path = app.config['IMG_UPLOAD_FOLDER'] + target.file
        #log.error("target", target.file, file_abs_path)
        if op.exists(file_abs_path):
            #log.error("target", target, target.file)
            d = decode(Image.open(file_abs_path))
            #>>> decode(Image.open('pyzbar/tests/code128.png'))
            #[Decoded(data=b'http://line.me/ti/p/aHVI-uK54_', type='QRCODE', rect=Rect(left=192, top=421, width=291, height=291), polygon=[Point(x=192, y=421), Point(x=192, y=712), Point(x=483, y=712), Point(x=483, y=421)])]
            qr = qrcode.QRCode(
                    version=1,
                    error_correction=qrcode.constants.ERROR_CORRECT_L,
                    box_size=10,
                    border=4,
                    )
            qr.add_data(d[0].data)
            qr.make(fit=True)
            img = qr.make_image()
            img.save(file_abs_path)

@event.listens_for(ProjectFiles, 'after_delete')
def receive_after_delete(mapper, connection, target):
    "listen for the 'after_delete' event"
    #log.error("target", target, target.file)
    if target.file:
        im = ImageManager()
        im.delete_file(target.file)
