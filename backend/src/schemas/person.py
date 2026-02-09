from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import date, datetime


class Address(BaseModel):
    """Schema for address as JSON object"""
    line1: Optional[str] = None
    line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None


class PersonRelationshipBase(BaseModel):
    """Base schema for person relationships"""
    related_person_id: int
    relationship_type: str = Field(..., max_length=100, description="Type of relationship (e.g., spouse, child, parent, sibling)")


class PersonRelationshipCreate(PersonRelationshipBase):
    """Schema for creating a person relationship"""
    pass


class PersonRelationship(PersonRelationshipBase):
    """Schema for person relationship response"""
    person_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PersonBase(BaseModel):
    """Base schema for Person"""
    name: str = Field(..., min_length=1, max_length=255)
    phone_number: Optional[str] = Field(None, max_length=20)
    date_of_birth: Optional[date] = None
    email: Optional[EmailStr] = None
    employer: Optional[str] = Field(None, max_length=255)
    occupation: Optional[str] = Field(None, max_length=255)
    mailing_address: Optional[Address] = None
    physical_address: Optional[Address] = None
    # Trustor-related fields
    trustor_is_living: Optional[int] = Field(default=1, description="1 = living, 0 = deceased")
    date_of_death: Optional[date] = None
    trustor_death_certificate_received: Optional[int] = Field(default=0)
    trustor_of_sound_mind: Optional[int] = Field(default=1)
    trustor_has_relinquished: Optional[int] = Field(default=0)
    trustor_relinquished_date: Optional[date] = None
    trustor_reling_doc_received: Optional[int] = Field(default=0)


class PersonCreate(PersonBase):
    """Schema for creating a new person"""
    ssn: Optional[str] = Field(None, max_length=11, description="Social Security Number (will be encrypted)")


class PersonUpdate(BaseModel):
    """Schema for updating a person"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone_number: Optional[str] = Field(None, max_length=20)
    date_of_birth: Optional[date] = None
    email: Optional[EmailStr] = None
    employer: Optional[str] = Field(None, max_length=255)
    occupation: Optional[str] = Field(None, max_length=255)
    mailing_address: Optional[Address] = None
    physical_address: Optional[Address] = None
    ssn: Optional[str] = Field(None, max_length=11, description="Social Security Number (will be encrypted)")
    is_active: Optional[bool] = None
    # Trustor-related fields
    trustor_is_living: Optional[int] = None
    date_of_death: Optional[date] = None
    trustor_death_certificate_received: Optional[int] = None
    trustor_of_sound_mind: Optional[int] = None
    trustor_has_relinquished: Optional[int] = None
    trustor_relinquished_date: Optional[date] = None
    trustor_reling_doc_received: Optional[int] = None


class Person(PersonBase):
    """Schema for person response"""
    id: int
    created_at: datetime
    updated_at: datetime
    is_active: bool
    has_ssn: bool = Field(default=False, description="Indicates if SSN is stored (encrypted)")

    class Config:
        from_attributes = True


class PersonWithRelationships(Person):
    """Schema for person response with relationships"""
    relationships: List[PersonRelationship] = []

    class Config:
        from_attributes = True


class PersonListResponse(BaseModel):
    """Schema for paginated person list response"""
    people: List[Person]
    total: int
    page: int
    page_size: int
