import json
from flask_appbuilder import Model
from sqlalchemy import Column, Integer, String, ForeignKey, Date, DateTime
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import relationship, backref

class ContactGroup(Model):
    __tablename__ = "contact_group"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    line_id = Column(String)
    user_id = Column(Integer, ForeignKey("ab_user.id"), nullable=True)
    user = relationship("User", foreign_keys='ContactGroup.user_id')
    updated = Column(DateTime)
    #contacts = relationship('Contact', back_populates = 'contact_group', lazy = True)

    def __repr__(self):
        return self.name


class Contact(Model):
    __tablename__ = "contact"
    id = Column(Integer, primary_key=True)
    line_id = Column(String)
    name = Column(String, unique=False, nullable=False)
    msg = Column(String, unique=False, nullable=False)
    from_id = Column(String, unique=False)
    from_display_name = Column(String, unique=False)
    me_id = Column(String, unique=False)
    user_id = Column(Integer, ForeignKey("ab_user.id"), nullable=True)
    user = relationship("User", foreign_keys='Contact.user_id')

    #contact_group_id = Column(Integer)
    #contact_group_id = Column(Integer, ForeignKey('contact_group.id'))
    #contact_group = relationship("ContactGroup", backref=backref("Contact", cascade="all, delete-orphan"))
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
        return json.dumps(out, ensure_ascii=False)

