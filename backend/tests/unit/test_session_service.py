"""Unit tests for session service."""

import pytest
from unittest.mock import Mock, patch
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime

from src.services.session_service import SessionService
from src.models.session import QuestionnaireSession, SessionAnswer
from src.models.question import QuestionGroup, Question
from src.schemas.session import QuestionnaireSessionCreate, SessionAnswerCreate


class TestSessionService:
    """Test suite for SessionService."""
    
    def test_create_session_success(self, db_session: Session, sample_question_group):
        """Test successful session creation."""
        session_data = QuestionnaireSessionCreate(
            client_identifier="John Doe",
            starting_group_id=sample_question_group.id
        )
        
        session = SessionService.create_session(db_session, session_data, 1)
        
        assert session.client_identifier == "John Doe"
        assert session.user_id == 1
        assert session.current_group_id == sample_question_group.id
        assert session.is_completed == False
    
    def test_create_session_default_starting_group(self, db_session: Session, sample_question_group):
        """Test session creation with default starting group."""
        session_data = QuestionnaireSessionCreate(
            client_identifier="Jane Doe"
        )
        
        session = SessionService.create_session(db_session, session_data, 1)
        
        assert session.current_group_id == sample_question_group.id
    
    def test_create_session_no_groups_available(self, db_session: Session):
        """Test session creation when no question groups exist."""
        session_data = QuestionnaireSessionCreate(
            client_identifier="Test Client"
        )
        
        with pytest.raises(HTTPException) as exc_info:
            SessionService.create_session(db_session, session_data, 1)
        
        assert exc_info.value.status_code == 400
        assert "No question groups available" in str(exc_info.value.detail)
    
    def test_get_session_success(self, db_session: Session, sample_session):
        """Test getting a session by ID."""
        retrieved = SessionService.get_session(db_session, sample_session.id, sample_session.user_id)
        
        assert retrieved is not None
        assert retrieved.id == sample_session.id
        assert retrieved.client_identifier == sample_session.client_identifier
    
    def test_get_session_wrong_user(self, db_session: Session, sample_session):
        """Test getting a session with wrong user ID."""
        retrieved = SessionService.get_session(db_session, sample_session.id, 999)
        
        assert retrieved is None
    
    def test_list_sessions(self, db_session: Session, sample_question_group):
        """Test listing sessions for a user."""
        # Create multiple sessions
        for i in range(3):
            session_data = QuestionnaireSessionCreate(
                client_identifier=f"Client {i}",
                starting_group_id=sample_question_group.id
            )
            SessionService.create_session(db_session, session_data, 1)
        
        sessions, total = SessionService.list_sessions(db_session, 1)
        
        assert total == 3
        assert len(sessions) == 3
    
    def test_list_sessions_pagination(self, db_session: Session, sample_question_group):
        """Test listing sessions with pagination."""
        # Create 5 sessions
        for i in range(5):
            session_data = QuestionnaireSessionCreate(
                client_identifier=f"Client {i}",
                starting_group_id=sample_question_group.id
            )
            SessionService.create_session(db_session, session_data, 1)
        
        sessions, total = SessionService.list_sessions(db_session, 1, skip=0, limit=2)
        
        assert total == 5
        assert len(sessions) == 2
    
    def test_submit_answers_success(self, db_session: Session, sample_session, sample_questions):
        """Test submitting answers successfully."""
        answers = [
            SessionAnswerCreate(question_id=sample_questions[0].id, answer_value="Answer 1"),
            SessionAnswerCreate(question_id=sample_questions[1].id, answer_value="Answer 2")
        ]
        
        updated_session = SessionService.submit_answers(
            db_session,
            sample_session.id,
            sample_session.user_id,
            answers
        )
        
        assert updated_session is not None
        # Check answers were saved
        saved_answers = db_session.query(SessionAnswer).filter(
            SessionAnswer.session_id == sample_session.id
        ).all()
        assert len(saved_answers) == 2
    
    def test_submit_answers_session_not_found(self, db_session: Session):
        """Test submitting answers to non-existent session."""
        answers = [SessionAnswerCreate(question_id=1, answer_value="Test")]
        
        with pytest.raises(HTTPException) as exc_info:
            SessionService.submit_answers(db_session, 999, 1, answers)
        
        assert exc_info.value.status_code == 404
    
    def test_submit_answers_already_completed(self, db_session: Session, sample_session):
        """Test submitting answers to completed session."""
        sample_session.is_completed = True
        sample_session.completed_at = datetime.utcnow()
        db_session.commit()
        
        answers = [SessionAnswerCreate(question_id=1, answer_value="Test")]
        
        with pytest.raises(HTTPException) as exc_info:
            SessionService.submit_answers(
                db_session,
                sample_session.id,
                sample_session.user_id,
                answers
            )
        
        assert exc_info.value.status_code == 400
        assert "already completed" in str(exc_info.value.detail)
    
    def test_submit_answers_update_existing(self, db_session: Session, sample_session, sample_questions):
        """Test updating existing answers."""
        # Submit initial answer
        initial_answer = SessionAnswer(
            session_id=sample_session.id,
            question_id=sample_questions[0].id,
            answer_value="Initial Answer"
        )
        db_session.add(initial_answer)
        db_session.commit()
        
        # Update the answer
        answers = [
            SessionAnswerCreate(question_id=sample_questions[0].id, answer_value="Updated Answer")
        ]
        
        SessionService.submit_answers(
            db_session,
            sample_session.id,
            sample_session.user_id,
            answers
        )
        
        # Verify answer was updated
        updated_answer = db_session.query(SessionAnswer).filter(
            SessionAnswer.session_id == sample_session.id,
            SessionAnswer.question_id == sample_questions[0].id
        ).first()
        
        assert updated_answer.answer_value == "Updated Answer"
    
    def test_conditional_flow_navigation(self, db_session: Session, sample_session_with_flow, sample_questions):
        """Test conditional flow navigation based on answers."""
        # Answer that triggers conditional flow
        answers = [
            SessionAnswerCreate(question_id=sample_questions[0].id, answer_value="Male")
        ]
        
        updated_session = SessionService.submit_answers(
            db_session,
            sample_session_with_flow.id,
            sample_session_with_flow.user_id,
            answers
        )
        
        # Should navigate to the conditional next group
        assert updated_session.current_group_id == 2  # Based on conditional flow
    
    def test_default_flow_navigation(self, db_session: Session, sample_session, sample_questions):
        """Test default flow navigation when no condition matches."""
        answers = [
            SessionAnswerCreate(question_id=sample_questions[0].id, answer_value="Other")
        ]
        
        updated_session = SessionService.submit_answers(
            db_session,
            sample_session.id,
            sample_session.user_id,
            answers
        )
        
        # Should use default next_group_id
        current_group = db_session.query(QuestionGroup).filter(
            QuestionGroup.id == sample_session.current_group_id
        ).first()
        
        if current_group.next_group_id:
            assert updated_session.current_group_id == current_group.next_group_id
        else:
            assert updated_session.is_completed == True
    
    def test_session_completion(self, db_session: Session, sample_session_last_group, sample_questions):
        """Test session completion when no next group."""
        answers = [
            SessionAnswerCreate(question_id=sample_questions[0].id, answer_value="Final Answer")
        ]
        
        updated_session = SessionService.submit_answers(
            db_session,
            sample_session_last_group.id,
            sample_session_last_group.user_id,
            answers
        )
        
        assert updated_session.is_completed == True
        assert updated_session.completed_at is not None
    
    def test_get_session_answers(self, db_session: Session, sample_session, sample_questions):
        """Test getting all answers for a session."""
        # Create some answers
        for i, question in enumerate(sample_questions):
            answer = SessionAnswer(
                session_id=sample_session.id,
                question_id=question.id,
                answer_value=f"Answer {i}"
            )
            db_session.add(answer)
        db_session.commit()
        
        answers = SessionService.get_session_answers(
            db_session,
            sample_session.id,
            sample_session.user_id
        )
        
        assert len(answers) == len(sample_questions)
    
    def test_delete_session_success(self, db_session: Session, sample_session):
        """Test deleting a session."""
        success = SessionService.delete_session(
            db_session,
            sample_session.id,
            sample_session.user_id
        )
        
        assert success == True
        
        # Verify session is deleted
        deleted = db_session.query(QuestionnaireSession).filter(
            QuestionnaireSession.id == sample_session.id
        ).first()
        assert deleted is None
    
    def test_delete_session_not_found(self, db_session: Session):
        """Test deleting non-existent session."""
        success = SessionService.delete_session(db_session, 999, 1)
        assert success == False


@pytest.fixture
def db_session():
    """Create a mock database session."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from src.models import Base
    
    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(engine)
    
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    
    yield session
    
    session.close()


@pytest.fixture
def sample_question_group(db_session):
    """Create a sample question group."""
    group = QuestionGroup(
        name="Test Group",
        description="Test Description",
        order_index=1,
        is_active=True
    )
    db_session.add(group)
    db_session.commit()
    db_session.refresh(group)
    return group


@pytest.fixture
def sample_questions(db_session, sample_question_group):
    """Create sample questions."""
    questions = []
    for i in range(3):
        question = Question(
            group_id=sample_question_group.id,
            identifier=f"test_q{i}",
            question_text=f"Test Question {i}",
            question_type="free_text",
            order_index=i,
            is_required=True,
            is_active=True
        )
        db_session.add(question)
        questions.append(question)
    
    db_session.commit()
    for q in questions:
        db_session.refresh(q)
    
    return questions


@pytest.fixture
def sample_session(db_session, sample_question_group):
    """Create a sample session."""
    session = QuestionnaireSession(
        client_identifier="Test Client",
        user_id=1,
        current_group_id=sample_question_group.id,
        is_completed=False
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)
    return session


@pytest.fixture
def sample_session_with_flow(db_session, sample_question_group, sample_questions):
    """Create a session with conditional flow."""
    # Add conditional flow to group
    sample_question_group.conditional_flows = [
        {
            "question_id": sample_questions[0].id,
            "expected_value": "Male",
            "next_group_id": 2
        }
    ]
    db_session.commit()
    
    session = QuestionnaireSession(
        client_identifier="Flow Test Client",
        user_id=1,
        current_group_id=sample_question_group.id,
        is_completed=False
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)
    return session


@pytest.fixture
def sample_session_last_group(db_session, sample_question_group):
    """Create a session on the last group (no next group)."""
    sample_question_group.next_group_id = None
    db_session.commit()
    
    session = QuestionnaireSession(
        client_identifier="Last Group Client",
        user_id=1,
        current_group_id=sample_question_group.id,
        is_completed=False
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)
    return session
