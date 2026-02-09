from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSON
from datetime import datetime
from ..database import Base

# Association table for person-to-person relationships
person_relationships = Table(
    'person_relationships',
    Base.metadata,
    Column('person_id', Integer, ForeignKey('people.id', ondelete='CASCADE'), primary_key=True),
    Column('related_person_id', Integer, ForeignKey('people.id', ondelete='CASCADE'), primary_key=True),
    Column('relationship_type', String(100)),  # e.g., "spouse", "child", "parent", "sibling", etc.
    Column('created_at', DateTime, default=datetime.utcnow),
    Column('updated_at', DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
)

class Person(Base):
    __tablename__ = 'people'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    phone_number = Column(String(20), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    ssn_encrypted = Column(String(255), nullable=True)  # Encrypted SSN
    email = Column(String(255), nullable=True, index=True)
    employer = Column(String(255), nullable=True)
    occupation = Column(String(255), nullable=True)
    mailing_address = Column(JSON, nullable=True)  # JSON object with address fields
    physical_address = Column(JSON, nullable=True)  # JSON object with address fields
    
    # Trustor-related fields
    trustor_is_living = Column(Integer, default=1, nullable=True)  # 1 = living, 0 = deceased
    trustor_death_certificate_received = Column(Integer, default=0, nullable=True)
    trustor_of_sound_mind = Column(Integer, default=1, nullable=True)
    trustor_has_relinquished = Column(Integer, default=0, nullable=True)
    trustor_relinquished_date = Column(Date, nullable=True)
    trustor_reling_doc_received = Column(Integer, default=0, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    is_active = Column(Integer, default=1, nullable=False)
    
    # Self-referential many-to-many relationship
    relationships = relationship(
        'Person',
        secondary=person_relationships,
        primaryjoin=id == person_relationships.c.person_id,
        secondaryjoin=id == person_relationships.c.related_person_id,
        backref='related_to'
    )

    def __repr__(self):
        return f"<Person(id={self.id}, name='{self.name}', email='{self.email}')>"
