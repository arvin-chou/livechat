import json
from flask_appbuilder import Model
from sqlalchemy import Column, Integer, String, ForeignKey, Date, DateTime
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import relationship, backref
from sqlalchemy.schema import UniqueConstraint

#from app.m.quickfiles import ProjectFiles

class ContactGroup(Model):
    __tablename__ = "contact_group"
    id = Column(Integer, primary_key=True)
    is_visible = Column(Integer, nullable=False, default=1)
    icon_base64 = Column(String)
    name = Column(String, nullable=False)
    line_id = Column(String)
    user_id = Column(Integer, ForeignKey("ab_user.id"), nullable=True)
    user = relationship("User", foreign_keys='ContactGroup.user_id')
    updated = Column(DateTime)

    #name = Column(String(150), unique=True, nullable=False)
    projectfiles_name = Column(String, ForeignKey("project_files.name"))
    projectfiles = relationship("ProjectFiles", backref=backref("ContactGroup", cascade="all, delete-orphan"), foreign_keys='ContactGroup.projectfiles_name')
    #contacts = relationship('Contact', back_populates = 'contact_group', lazy = True)
    me_id = Column(String) # be monitored's user line id

    def __repr__(self):
        return self.name


class Contact(Model):
    __tablename__ = "contact"
    id = Column(Integer, primary_key=True)
    line_id = Column(String) # to
    name = Column(String, unique=False, nullable=False) #rid
    msg = Column(String, unique=False, nullable=False)
    from_id = Column(String, unique=False)
    from_display_name = Column(String, unique=False)
    me_id = Column(String, unique=False)
    user_id = Column(Integer, ForeignKey("ab_user.id"), nullable=True)
    user = relationship("User", foreign_keys='Contact.user_id')
    c_type = Column(Integer, default=1) # content type as 1 is chat 2 is sticker
    UniqueConstraint('updated', 'contact_group_id', 'line_id', 'from_id', 'me_id', name='uniq_for_add')


    #contact_group_id = Column(Integer)
    #contact_group_id = Column(Integer, ForeignKey('contact_group.id'))
    contact_group = relationship("ContactGroup", backref=backref("Contact", cascade="all, delete-orphan"))
    icon_base64 = Column(String)

    @declared_attr
    def contact_group_id(self):
        return Column(
                Integer, ForeignKey('contact_group.id')
        )

    @declared_attr
    def contact_group(self):
        return relationship("ContactGroup", backref=backref("Contact", cascade="all, delete-orphan"))

    updated = Column(DateTime)
    t = Column(String)

    def __repr__(self):
        out = dict();
        out['id'] = self.id
        out['msg'] = self.msg
        out['name'] = self.name
        out['t'] = self.t
        out['updated'] = self.updated.timestamp()
        out['from_display_name'] = self.from_display_name
        out['me_id'] = self.me_id
        out['from_id'] = self.from_id
        out['c_type'] = self.c_type
        out['icon_base64'] = self.icon_base64
        return json.dumps(out, ensure_ascii=False)

