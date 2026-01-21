"""Integration tests for session API endpoints."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from src.main import app
from src.database import get_db
from src.models import Base
from src.models.user import User, UserRole
from src.models.question import QuestionGroup, Question
from src.utils.security import hash_password


# Test database setup - use StaticPool to share connection across threads
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def test_db():
    """Create test database."""
    Base.metadata.create_all(bind=engine)
    
    def override_get_db():
        """Override database dependency for testing."""
        try:
            db = TestingSessionLocal()
            yield db
        finally:
            db.close()
    
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(test_db):
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def test_user(test_db):
    """Create test user."""
    db = TestingSessionLocal()
    user = User(
        username="testuser",
        email="test@test.com",
        hashed_password=hash_password("password"),
        role=UserRole.user,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


@pytest.fixture
def user_token(client, test_user):
    """Get user authentication token."""
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "password"}
    )
    assert response.status_code == 200
    return response.cookies.get("access_token")


@pytest.fixture
def sample_question_group(test_db):
    """Create sample question group with questions."""
    db = TestingSessionLocal()
    
    group = QuestionGroup(
        name="Personal Information",
        description="Basic personal details",
        identifier="personal_info",
        display_order=1
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    group_id = group.id
    
    # Add questions
    questions = [
        Question(
            question_group_id=group_id,
            identifier="full_name",
            question_text="What is your full name?",
            question_type="free_text",
            display_order=1,
            is_required=True
        ),
        Question(
            question_group_id=group_id,
            identifier="gender",
            question_text="What is your gender?",
            question_type="multiple_choice",
            options={"choices": ["Male", "Female", "Other"]},
            display_order=2,
            is_required=True
        )
    ]
    
    for q in questions:
        db.add(q)
    
    db.commit()
    db.close()
    
    # Return a simple object with the ID to avoid detached instance issues
    class GroupInfo:
        def __init__(self, id):
            self.id = id
    
    return GroupInfo(group_id)


class TestSessionAPI:
    """Test suite for session API endpoints."""
    
    def test_create_session_success(self, client, user_token, sample_question_group):
        """Test creating a new session."""
        response = client.post(
            "/api/v1/sessions/",
            json={"client_identifier": "John Doe"}
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["client_identifier"] == "John Doe"
        assert data["is_completed"] == False
        assert data["current_group_id"] == sample_question_group.id
        assert "id" in data
    
    def test_create_session_with_starting_group(self, client, user_token, sample_question_group):
        """Test creating session with specific starting group."""
        response = client.post(
            "/api/v1/sessions/",
            json={
                "client_identifier": "Jane Doe",
                "starting_group_id": sample_question_group.id
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["current_group_id"] == sample_question_group.id
    
    def test_create_session_unauthorized(self, client):
        """Test creating session without authentication."""
        response = client.post(
            "/api/v1/sessions/",
            json={"client_identifier": "Test"}
        )
        
        assert response.status_code == 401
    
    def test_list_sessions(self, client, user_token, sample_question_group):
        """Test listing sessions."""
        # Create some sessions
        for i in range(3):
            client.post(
                "/api/v1/sessions/",
                json={"client_identifier": f"Client {i}"}
            )
        
        # List sessions
        response = client.get("/api/v1/sessions/")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 3
    
    def test_get_session(self, client, user_token, sample_question_group):
        """Test getting a specific session."""
        # Create a session
        create_response = client.post(
            "/api/v1/sessions/",
            json={"client_identifier": "Test Client"}
        )
        session_id = create_response.json()["id"]
        
        # Get the session
        response = client.get(f"/api/v1/sessions/{session_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == session_id
        assert data["client_identifier"] == "Test Client"
        assert "answers" in data
    
    def test_get_session_not_found(self, client, user_token):
        """Test getting non-existent session."""
        response = client.get("/api/v1/sessions/99999")
        
        assert response.status_code == 404
    
    def test_get_session_progress(self, client, user_token, sample_question_group):
        """Test getting session progress."""
        # Create a session
        create_response = client.post(
            "/api/v1/sessions/",
            json={"client_identifier": "Progress Test"}
        )
        session_id = create_response.json()["id"]
        
        # Get progress
        response = client.get(f"/api/v1/sessions/{session_id}/progress")
        
        assert response.status_code == 200
        data = response.json()
        assert "session" in data
        assert "current_group" in data
        assert "is_completed" in data
        assert "total_answers" in data
        assert data["current_group"] is not None
        assert data["current_group"]["name"] == "Personal Information"
        assert len(data["current_group"]["questions"]) == 2
    
    def test_submit_answers(self, client, user_token, sample_question_group):
        """Test submitting answers."""
        # Create a session
        create_response = client.post(
            "/api/v1/sessions/",
            json={"client_identifier": "Answer Test"}
        )
        session_id = create_response.json()["id"]
        
        # Get questions from progress
        progress_response = client.get(f"/api/v1/sessions/{session_id}/progress")
        questions = progress_response.json()["current_group"]["questions"]
        
        # Submit answers
        response = client.post(
            f"/api/v1/sessions/{session_id}/submit",
            json={
                "answers": [
                    {"question_id": questions[0]["id"], "answer_value": "John Smith"},
                    {"question_id": questions[1]["id"], "answer_value": "Male"}
                ]
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == session_id
    
    def test_submit_answers_session_not_found(self, client, user_token):
        """Test submitting answers to non-existent session."""
        response = client.post(
            "/api/v1/sessions/99999/submit",
            json={"answers": [{"question_id": 1, "answer_value": "Test"}]}
        )
        
        assert response.status_code == 404
    
    def test_submit_answers_updates_existing(self, client, user_token, sample_question_group):
        """Test that submitting answers updates existing ones via save-answers endpoint."""
        # Create session
        create_response = client.post(
            "/api/v1/sessions/",
            json={"client_identifier": "Update Test"}
        )
        session_id = create_response.json()["id"]
        
        # Get questions
        progress_response = client.get(f"/api/v1/sessions/{session_id}/progress")
        questions = progress_response.json()["current_group"]["questions"]
        question_id = questions[0]["id"]
        
        # Save initial answer (doesn't complete session)
        client.post(
            f"/api/v1/sessions/{session_id}/save-answers",
            json={
                "answers": [{"question_id": question_id, "answer_value": "Initial Answer"}]
            }
        )
        
        # Save updated answer
        response = client.post(
            f"/api/v1/sessions/{session_id}/save-answers",
            json={
                "answers": [{"question_id": question_id, "answer_value": "Updated Answer"}]
            }
        )
        
        assert response.status_code == 204
        
        # Verify answer was updated
        session_response = client.get(f"/api/v1/sessions/{session_id}")
        answers = session_response.json()["answers"]
        answer = next(a for a in answers if a["question_id"] == question_id)
        assert answer["answer_value"] == "Updated Answer"
    
    def test_submit_answers_completes_session(self, client, user_token, sample_question_group):
        """Test that session completes when no next group."""
        # Create session (there's only one group, so it will complete after submit)
        create_response = client.post(
            "/api/v1/sessions/",
            json={"client_identifier": "Completion Test"}
        )
        session_id = create_response.json()["id"]
        
        # Get questions
        progress_response = client.get(f"/api/v1/sessions/{session_id}/progress")
        questions = progress_response.json()["current_group"]["questions"]
        
        # Submit answers
        response = client.post(
            f"/api/v1/sessions/{session_id}/submit",
            json={
                "answers": [
                    {"question_id": q["id"], "answer_value": "Answer"}
                    for q in questions
                ]
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_completed"] == True
        assert data["completed_at"] is not None
    
    def test_delete_session(self, client, user_token, sample_question_group):
        """Test deleting a session."""
        # Create session
        create_response = client.post(
            "/api/v1/sessions/",
            json={"client_identifier": "Delete Test"}
        )
        session_id = create_response.json()["id"]
        
        # Delete session
        response = client.delete(f"/api/v1/sessions/{session_id}")
        
        assert response.status_code == 204
        
        # Verify session is deleted
        get_response = client.get(f"/api/v1/sessions/{session_id}")
        assert get_response.status_code == 404
    
    def test_delete_session_not_found(self, client, user_token):
        """Test deleting non-existent session."""
        response = client.delete("/api/v1/sessions/99999")
        
        assert response.status_code == 404
    
    def test_conditional_flow(self, client, user_token, sample_question_group):
        """Test conditional flow navigation."""
        # Set up conditional flow
        db = TestingSessionLocal()
        
        # Create second group with higher display_order
        group2 = QuestionGroup(
            name="Male Specific",
            description="Questions for males",
            identifier="male_specific",
            display_order=2
        )
        db.add(group2)
        db.commit()
        db.refresh(group2)
        group2_id = group2.id
        
        # Get first group and its questions
        group1 = db.query(QuestionGroup).filter(QuestionGroup.id == sample_question_group.id).first()
        questions = db.query(Question).filter(Question.question_group_id == group1.id).all()
        gender_question = next(q for q in questions if q.identifier == "gender")
        gender_question_id = gender_question.id
        
        db.close()
        
        # Create session
        create_response = client.post(
            "/api/v1/sessions/",
            json={"client_identifier": "Flow Test"}
        )
        session_id = create_response.json()["id"]
        
        # Submit answer - since there's a second group with higher display_order,
        # the session should move to that group
        response = client.post(
            f"/api/v1/sessions/{session_id}/submit",
            json={
                "answers": [
                    {"question_id": gender_question_id, "answer_value": "Male"}
                ]
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["current_group_id"] == group2_id
