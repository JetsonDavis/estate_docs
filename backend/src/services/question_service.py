from sqlalchemy.orm import Session
from typing import Optional, List
from ..models.question import QuestionGroup, Question, QuestionType
from ..schemas.question import (
    QuestionGroupCreate,
    QuestionGroupUpdate,
    QuestionCreate,
    QuestionUpdate
)
from fastapi import HTTPException, status


class QuestionGroupService:
    """Service for question group operations."""
    
    @staticmethod
    def get_question_group_by_id(db: Session, group_id: int) -> Optional[QuestionGroup]:
        """Get question group by ID."""
        return db.query(QuestionGroup).filter(QuestionGroup.id == group_id).first()
    
    @staticmethod
    def get_question_group_by_identifier(db: Session, identifier: str) -> Optional[QuestionGroup]:
        """Get question group by identifier."""
        return db.query(QuestionGroup).filter(QuestionGroup.identifier == identifier).first()
    
    @staticmethod
    def list_question_groups(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        include_inactive: bool = False
    ) -> tuple[List[QuestionGroup], int]:
        """List question groups with pagination."""
        query = db.query(QuestionGroup)
        
        if not include_inactive:
            query = query.filter(QuestionGroup.is_active == True)
        
        query = query.order_by(QuestionGroup.display_order, QuestionGroup.name)
        
        total = query.count()
        groups = query.offset(skip).limit(limit).all()
        
        return groups, total
    
    @staticmethod
    def create_question_group(db: Session, group_data: QuestionGroupCreate) -> QuestionGroup:
        """Create a new question group."""
        # Check if identifier already exists
        existing = db.query(QuestionGroup).filter(
            QuestionGroup.identifier == group_data.identifier
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Question group with this identifier already exists"
            )
        
        new_group = QuestionGroup(
            name=group_data.name,
            description=group_data.description,
            identifier=group_data.identifier,
            display_order=group_data.display_order
        )
        
        db.add(new_group)
        db.commit()
        db.refresh(new_group)
        
        return new_group
    
    @staticmethod
    def update_question_group(
        db: Session,
        group_id: int,
        group_data: QuestionGroupUpdate
    ) -> QuestionGroup:
        """Update question group."""
        group = db.query(QuestionGroup).filter(QuestionGroup.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Question group not found"
            )
        
        # Update fields
        if group_data.name is not None:
            group.name = group_data.name
        if group_data.description is not None:
            group.description = group_data.description
        if group_data.display_order is not None:
            group.display_order = group_data.display_order
        if group_data.question_logic is not None:
            group.question_logic = group_data.question_logic
        if group_data.is_active is not None:
            group.is_active = group_data.is_active
        
        db.commit()
        db.refresh(group)
        
        return group
    
    @staticmethod
    def delete_question_group(db: Session, group_id: int) -> bool:
        """Hard delete a question group and its questions."""
        group = db.query(QuestionGroup).filter(QuestionGroup.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Question group not found"
            )
        
        # Delete all questions in this group first
        db.query(Question).filter(Question.question_group_id == group_id).delete()
        
        # Delete the group
        db.delete(group)
        db.commit()
        
        return True


class QuestionService:
    """Service for question operations."""
    
    @staticmethod
    def get_question_by_id(db: Session, question_id: int) -> Optional[Question]:
        """Get question by ID."""
        return db.query(Question).filter(Question.id == question_id).first()
    
    @staticmethod
    def get_question_by_identifier(db: Session, identifier: str) -> Optional[Question]:
        """Get question by identifier."""
        return db.query(Question).filter(Question.identifier == identifier).first()
    
    @staticmethod
    def list_questions_by_group(
        db: Session,
        group_id: int,
        include_inactive: bool = False
    ) -> List[Question]:
        """List questions for a specific group."""
        query = db.query(Question).filter(Question.question_group_id == group_id)
        
        if not include_inactive:
            query = query.filter(Question.is_active == True)
        
        query = query.order_by(Question.display_order)
        
        return query.all()
    
    @staticmethod
    def create_question(db: Session, question_data: QuestionCreate) -> Question:
        """Create a new question."""
        # Check if identifier already exists
        existing = db.query(Question).filter(
            Question.identifier == question_data.identifier
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Question with this identifier already exists"
            )
        
        # Verify question group exists
        group = db.query(QuestionGroup).filter(
            QuestionGroup.id == question_data.question_group_id
        ).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Question group not found"
            )
        
        # Convert options to dict format if provided
        options_dict = None
        if question_data.options:
            options_dict = [opt.model_dump() for opt in question_data.options]
        
        new_question = Question(
            question_group_id=question_data.question_group_id,
            question_text=question_data.question_text,
            question_type=question_data.question_type,
            identifier=question_data.identifier,
            repeatable=question_data.repeatable,
            display_order=question_data.display_order,
            is_required=question_data.is_required,
            help_text=question_data.help_text,
            options=options_dict,
            database_table=question_data.database_table,
            database_value_column=question_data.database_value_column,
            database_label_column=question_data.database_label_column,
            validation_rules=question_data.validation_rules
        )
        
        db.add(new_question)
        db.commit()
        db.refresh(new_question)
        
        return new_question
    
    @staticmethod
    def update_question(
        db: Session,
        question_id: int,
        question_data: QuestionUpdate
    ) -> Question:
        """Update question."""
        question = db.query(Question).filter(Question.id == question_id).first()
        if not question:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Question not found"
            )
        
        # Update fields
        if question_data.question_text is not None:
            question.question_text = question_data.question_text
        if question_data.question_type is not None:
            question.question_type = question_data.question_type
        if question_data.identifier is not None:
            question.identifier = question_data.identifier
        if question_data.display_order is not None:
            question.display_order = question_data.display_order
        if question_data.is_required is not None:
            question.is_required = question_data.is_required
        if question_data.help_text is not None:
            question.help_text = question_data.help_text
        if question_data.options is not None:
            question.options = [opt.model_dump() for opt in question_data.options]
        if question_data.database_table is not None:
            question.database_table = question_data.database_table
        if question_data.database_value_column is not None:
            question.database_value_column = question_data.database_value_column
        if question_data.database_label_column is not None:
            question.database_label_column = question_data.database_label_column
        if question_data.validation_rules is not None:
            question.validation_rules = question_data.validation_rules
        if question_data.is_active is not None:
            question.is_active = question_data.is_active
        if question_data.repeatable is not None:
            question.repeatable = question_data.repeatable
        
        db.commit()
        db.refresh(question)
        
        return question
    
    @staticmethod
    def delete_question(db: Session, question_id: int) -> bool:
        """Hard delete a question."""
        question = db.query(Question).filter(Question.id == question_id).first()
        if not question:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Question not found"
            )
        
        db.delete(question)
        db.commit()
        
        return True
