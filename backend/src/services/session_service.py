"""Service layer for questionnaire session operations."""

from sqlalchemy.orm import Session
from typing import Optional, List, Tuple
from fastapi import HTTPException, status
from datetime import datetime

from ..models.session import QuestionnaireSession, SessionAnswer
from ..models.question import QuestionGroup, Question
from ..schemas.session import (
    QuestionnaireSessionCreate,
    QuestionnaireSessionUpdate,
    SessionAnswerCreate
)


class SessionService:
    """Service for questionnaire session operations."""
    
    @staticmethod
    def create_session(
        db: Session,
        session_data: QuestionnaireSessionCreate,
        user_id: int
    ) -> QuestionnaireSession:
        """
        Create a new questionnaire session.
        
        Args:
            db: Database session
            session_data: Session creation data
            user_id: User ID creating the session
            
        Returns:
            Created questionnaire session
        """
        from ..models.flow import QuestionnaireFlow
        
        # Determine starting group
        starting_group_id = session_data.starting_group_id
        flow_id = session_data.flow_id
        
        # If flow is specified, use its starting group
        if flow_id:
            flow = db.query(QuestionnaireFlow).filter(
                QuestionnaireFlow.id == flow_id,
                QuestionnaireFlow.is_active == True
            ).first()
            
            if not flow:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Flow not found"
                )
            
            if flow.starting_group_id:
                starting_group_id = flow.starting_group_id
        
        # If still no starting group, get first available group
        if not starting_group_id:
            first_group = db.query(QuestionGroup).filter(
                QuestionGroup.is_active == True
            ).order_by(QuestionGroup.order_index).first()
            
            if not first_group:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No question groups available"
                )
            starting_group_id = first_group.id
        
        session = QuestionnaireSession(
            client_identifier=session_data.client_identifier,
            user_id=user_id,
            flow_id=flow_id,
            current_group_id=starting_group_id,
            is_completed=False
        )
        
        db.add(session)
        db.commit()
        db.refresh(session)
        
        return session
    
    @staticmethod
    def get_session(db: Session, session_id: int, user_id: int) -> Optional[QuestionnaireSession]:
        """
        Get session by ID (user can only access their own sessions).
        
        Args:
            db: Database session
            session_id: Session ID
            user_id: User ID
            
        Returns:
            Session if found and belongs to user, None otherwise
        """
        return db.query(QuestionnaireSession).filter(
            QuestionnaireSession.id == session_id,
            QuestionnaireSession.user_id == user_id
        ).first()
    
    @staticmethod
    def list_sessions(
        db: Session,
        user_id: int,
        skip: int = 0,
        limit: int = 100
    ) -> Tuple[List[QuestionnaireSession], int]:
        """
        List sessions for a user.
        
        Args:
            db: Database session
            user_id: User ID
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            Tuple of (sessions list, total count)
        """
        query = db.query(QuestionnaireSession).filter(
            QuestionnaireSession.user_id == user_id
        )
        
        total = query.count()
        sessions = query.order_by(QuestionnaireSession.created_at.desc()).offset(skip).limit(limit).all()
        
        return sessions, total
    
    @staticmethod
    def submit_answers(
        db: Session,
        session_id: int,
        user_id: int,
        answers: List[SessionAnswerCreate]
    ) -> QuestionnaireSession:
        """
        Submit answers for current question group and navigate to next group.
        
        Args:
            db: Database session
            session_id: Session ID
            user_id: User ID
            answers: List of answers to submit
            
        Returns:
            Updated session
        """
        session = SessionService.get_session(db, session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        if session.is_completed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session is already completed"
            )
        
        # Get current group
        current_group = db.query(QuestionGroup).filter(
            QuestionGroup.id == session.current_group_id
        ).first()
        
        if not current_group:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current question group not found"
            )
        
        # Save answers
        for answer_data in answers:
            # Check if answer already exists for this question
            existing_answer = db.query(SessionAnswer).filter(
                SessionAnswer.session_id == session_id,
                SessionAnswer.question_id == answer_data.question_id
            ).first()
            
            if existing_answer:
                # Update existing answer
                existing_answer.answer_value = answer_data.answer_value
            else:
                # Create new answer
                answer = SessionAnswer(
                    session_id=session_id,
                    question_id=answer_data.question_id,
                    answer_value=answer_data.answer_value
                )
                db.add(answer)
        
        db.commit()
        
        # Determine next group based on conditional flow
        next_group_id = SessionService._get_next_group(db, session, current_group, answers)
        
        if next_group_id:
            session.current_group_id = next_group_id
        else:
            # No next group - mark as completed
            session.is_completed = True
            session.completed_at = datetime.utcnow()
        
        db.commit()
        db.refresh(session)
        
        return session
    
    @staticmethod
    def _get_next_group(
        db: Session,
        session: QuestionnaireSession,
        current_group: QuestionGroup,
        answers: List[SessionAnswerCreate]
    ) -> Optional[int]:
        """
        Determine next group based on conditional flow logic.
        
        Args:
            db: Database session
            session: Current session
            current_group: Current question group
            answers: Submitted answers
            
        Returns:
            Next group ID or None if completed
        """
        # Check if current group has conditional flows
        if current_group.conditional_flows:
            # Evaluate conditional flows
            for flow in current_group.conditional_flows:
                question_id = flow.get('question_id')
                expected_value = flow.get('expected_value')
                next_group_id = flow.get('next_group_id')
                
                # Find the answer for this question
                for answer in answers:
                    if answer.question_id == question_id:
                        if answer.answer_value == expected_value:
                            return next_group_id
        
        # If no conditional flow matched, use default next group
        return current_group.next_group_id
    
    @staticmethod
    def get_session_answers(
        db: Session,
        session_id: int,
        user_id: int
    ) -> List[SessionAnswer]:
        """
        Get all answers for a session.
        
        Args:
            db: Database session
            session_id: Session ID
            user_id: User ID
            
        Returns:
            List of session answers
        """
        session = SessionService.get_session(db, session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        return db.query(SessionAnswer).filter(
            SessionAnswer.session_id == session_id
        ).all()
    
    @staticmethod
    def delete_session(db: Session, session_id: int, user_id: int) -> bool:
        """
        Delete a session.
        
        Args:
            db: Database session
            session_id: Session ID
            user_id: User ID
            
        Returns:
            True if deleted, False if not found
        """
        session = SessionService.get_session(db, session_id, user_id)
        if not session:
            return False
        
        db.delete(session)
        db.commit()
        
        return True
