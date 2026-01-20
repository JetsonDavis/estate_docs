from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from typing import List, Optional
from cryptography.fernet import Fernet
import os
from ..models.person import Person, person_relationships
from ..schemas.person import PersonCreate, PersonUpdate, PersonRelationshipCreate


class PersonService:
    """Service for managing people and their relationships"""
    
    def __init__(self):
        # Initialize encryption key for SSN
        # In production, this should be stored securely (e.g., environment variable, secrets manager)
        encryption_key = os.getenv('SSN_ENCRYPTION_KEY')
        if not encryption_key:
            # Generate a key if not provided (for development only)
            encryption_key = Fernet.generate_key()
        if isinstance(encryption_key, str):
            encryption_key = encryption_key.encode()
        self.cipher = Fernet(encryption_key)
    
    def _encrypt_ssn(self, ssn: str) -> str:
        """Encrypt a Social Security Number"""
        if not ssn:
            return None
        return self.cipher.encrypt(ssn.encode()).decode()
    
    def _decrypt_ssn(self, encrypted_ssn: str) -> str:
        """Decrypt a Social Security Number"""
        if not encrypted_ssn:
            return None
        return self.cipher.decrypt(encrypted_ssn.encode()).decode()
    
    def create_person(self, db: Session, person_data: PersonCreate) -> Person:
        """Create a new person"""
        # Encrypt SSN if provided
        ssn_encrypted = None
        if person_data.ssn:
            ssn_encrypted = self._encrypt_ssn(person_data.ssn)
        
        # Create person without SSN in the data dict
        person_dict = person_data.model_dump(exclude={'ssn'})
        person = Person(**person_dict, ssn_encrypted=ssn_encrypted)
        
        db.add(person)
        db.commit()
        db.refresh(person)
        return person
    
    def get_person(self, db: Session, person_id: int) -> Optional[Person]:
        """Get a person by ID"""
        return db.query(Person).filter(Person.id == person_id).first()
    
    def get_people(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 100,
        include_inactive: bool = False,
        search: Optional[str] = None
    ) -> tuple[List[Person], int]:
        """Get a list of people with pagination and optional search"""
        query = db.query(Person)
        
        if not include_inactive:
            query = query.filter(Person.is_active == 1)
        
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                (Person.name.ilike(search_filter)) |
                (Person.email.ilike(search_filter)) |
                (Person.employer.ilike(search_filter))
            )
        
        total = query.count()
        people = query.offset(skip).limit(limit).all()
        
        return people, total
    
    def update_person(
        self,
        db: Session,
        person_id: int,
        person_data: PersonUpdate
    ) -> Optional[Person]:
        """Update a person"""
        person = self.get_person(db, person_id)
        if not person:
            return None
        
        update_data = person_data.model_dump(exclude_unset=True, exclude={'ssn'})
        
        # Handle SSN encryption if provided
        if person_data.ssn is not None:
            update_data['ssn_encrypted'] = self._encrypt_ssn(person_data.ssn)
        
        for field, value in update_data.items():
            setattr(person, field, value)
        
        db.commit()
        db.refresh(person)
        return person
    
    def delete_person(self, db: Session, person_id: int) -> bool:
        """Soft delete a person"""
        person = self.get_person(db, person_id)
        if not person:
            return False
        
        person.is_active = 0
        db.commit()
        return True
    
    def add_relationship(
        self,
        db: Session,
        person_id: int,
        relationship_data: PersonRelationshipCreate
    ) -> bool:
        """Add a relationship between two people"""
        # Verify both people exist
        person = self.get_person(db, person_id)
        related_person = self.get_person(db, relationship_data.related_person_id)
        
        if not person or not related_person:
            return False
        
        # Check if relationship already exists
        existing = db.execute(
            select(person_relationships).where(
                and_(
                    person_relationships.c.person_id == person_id,
                    person_relationships.c.related_person_id == relationship_data.related_person_id
                )
            )
        ).first()
        
        if existing:
            return False
        
        # Insert relationship
        db.execute(
            person_relationships.insert().values(
                person_id=person_id,
                related_person_id=relationship_data.related_person_id,
                relationship_type=relationship_data.relationship_type
            )
        )
        db.commit()
        return True
    
    def remove_relationship(
        self,
        db: Session,
        person_id: int,
        related_person_id: int
    ) -> bool:
        """Remove a relationship between two people"""
        result = db.execute(
            person_relationships.delete().where(
                and_(
                    person_relationships.c.person_id == person_id,
                    person_relationships.c.related_person_id == related_person_id
                )
            )
        )
        db.commit()
        return result.rowcount > 0
    
    def get_relationships(
        self,
        db: Session,
        person_id: int
    ) -> List[dict]:
        """Get all relationships for a person"""
        relationships = db.execute(
            select(person_relationships).where(
                person_relationships.c.person_id == person_id
            )
        ).all()
        
        return [
            {
                'person_id': rel.person_id,
                'related_person_id': rel.related_person_id,
                'relationship_type': rel.relationship_type,
                'created_at': rel.created_at,
                'updated_at': rel.updated_at
            }
            for rel in relationships
        ]


# Singleton instance
person_service = PersonService()
