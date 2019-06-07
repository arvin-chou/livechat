import json
from flask_appbuilder import Model
from sqlalchemy import Column, Integer, String, ForeignKey, Date, DateTime

from sqlalchemy.orm import relationship, backref

class ContactGroup(Model):
    __tablename__ = "contact_group"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    line_id = Column(String)
    user_id = Column(Integer, ForeignKey("ab_user.id"), nullable=True)
    user = relationship("User", foreign_keys='ContactGroup.user_id')

    def __repr__(self):
        return self.name


class Contact(Model):
    __tablename__ = "contact"
    id = Column(Integer, primary_key=True)
    line_id = Column(String)
    name = Column(String, unique=False, nullable=False)
    msg = Column(String, unique=False, nullable=False)
    user_id = Column(Integer, ForeignKey("ab_user.id"), nullable=True)
    user = relationship("User", foreign_keys='Contact.user_id')

    contact_group_id = Column(Integer, ForeignKey('contact_group.id'))
    contact_group = relationship("ContactGroup", backref=backref("Contact", cascade="all, delete-orphan"))
    updated = Column(DateTime)
    t = Column(String)

    def __repr__(self):
        out = dict();
        out['id'] = self.id;
        out['msg'] = self.msg;
        out['name'] = self.name;
        out['t'] = self.t;
        out['updated'] = self.updated.timestamp();
        return json.dumps(out, ensure_ascii=False)

