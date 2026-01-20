from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..schemas.person import (
    Person,
    PersonCreate,
    PersonUpdate,
    PersonListResponse,
    PersonRelationshipCreate,
    PersonRelationship
)
from ..services.person_service import person_service
from ..middleware.auth_middleware import require_admin

router = APIRouter(prefix="/people", tags=["people"])


@router.post("", response_model=Person)
def create_person(
    person_data: PersonCreate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new person (admin only)"""
    person = person_service.create_person(db, person_data)
    # Add has_ssn flag
    person.has_ssn = bool(person.ssn_encrypted)
    return person


@router.get("", response_model=PersonListResponse)
def list_people(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    include_inactive: bool = Query(False),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get a list of people with pagination (admin only)"""
    skip = (page - 1) * page_size
    people, total = person_service.get_people(
        db,
        skip=skip,
        limit=page_size,
        include_inactive=include_inactive,
        search=search
    )
    
    # Add has_ssn flag to each person
    for person in people:
        person.has_ssn = bool(person.ssn_encrypted)
    
    return PersonListResponse(
        people=people,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{person_id}", response_model=Person)
def get_person(
    person_id: int,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get a person by ID (admin only)"""
    person = person_service.get_person(db, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    # Add has_ssn flag
    person.has_ssn = bool(person.ssn_encrypted)
    return person


@router.put("/{person_id}", response_model=Person)
def update_person(
    person_id: int,
    person_data: PersonUpdate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update a person (admin only)"""
    person = person_service.update_person(db, person_id, person_data)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    # Add has_ssn flag
    person.has_ssn = bool(person.ssn_encrypted)
    return person


@router.delete("/{person_id}")
def delete_person(
    person_id: int,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a person (soft delete, admin only)"""
    success = person_service.delete_person(db, person_id)
    if not success:
        raise HTTPException(status_code=404, detail="Person not found")
    
    return {"message": "Person deleted successfully"}


@router.post("/{person_id}/relationships")
def add_relationship(
    person_id: int,
    relationship_data: PersonRelationshipCreate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Add a relationship between two people (admin only)"""
    success = person_service.add_relationship(db, person_id, relationship_data)
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Failed to add relationship. Person(s) may not exist or relationship already exists."
        )
    
    return {"message": "Relationship added successfully"}


@router.delete("/{person_id}/relationships/{related_person_id}")
def remove_relationship(
    person_id: int,
    related_person_id: int,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Remove a relationship between two people (admin only)"""
    success = person_service.remove_relationship(db, person_id, related_person_id)
    if not success:
        raise HTTPException(status_code=404, detail="Relationship not found")
    
    return {"message": "Relationship removed successfully"}


@router.get("/{person_id}/relationships", response_model=List[PersonRelationship])
def get_relationships(
    person_id: int,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all relationships for a person (admin only)"""
    person = person_service.get_person(db, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    relationships = person_service.get_relationships(db, person_id)
    return relationships
