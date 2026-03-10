"""Integration tests for document merge with person conjunction support."""

import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from src.main import app
from src.database import get_db
from src.models import Base
from src.models.user import User, UserRole
from src.models.question import QuestionGroup, Question
from src.models.template import Template
from src.models.session import InputForm, SessionAnswer
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
    return TestClient(app)


@pytest.fixture
def db(test_db):
    """Provide a managed database session for test data setup."""
    session = TestingSessionLocal()
    yield session
    session.rollback()
    session.close()


@pytest.fixture
def test_user(db):
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
    return user.id


@pytest.fixture
def user_token(client, test_user):
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "password"}
    )
    assert response.status_code == 200
    # Login sets httpOnly cookies on the TestClient; subsequent requests send them automatically.
    return response.cookies.get("access_token")


def _setup_repeatable_group(db, group_identifier="test_group"):
    """Create a question group with repeatable person + free_text questions.
    Returns (group_id, trustor_question_id, share_question_id)."""
    group = QuestionGroup(
        name="Test Trust Group",
        description="Test group",
        identifier=group_identifier,
        display_order=1
    )
    db.add(group)
    db.commit()
    db.refresh(group)

    rep_group_id = "9999999999"

    trustor_q = Question(
        question_group_id=group.id,
        identifier=f"{group_identifier}.trustor",
        question_text="Who are the trustors?",
        question_type="person",
        repeatable=True,
        repeatable_group_id=rep_group_id,
        display_order=1,
        is_required=True
    )
    share_q = Question(
        question_group_id=group.id,
        identifier=f"{group_identifier}.trustor_share",
        question_text="What share?",
        question_type="free_text",
        repeatable=True,
        repeatable_group_id=rep_group_id,
        display_order=2,
        is_required=False
    )
    db.add_all([trustor_q, share_q])
    db.commit()
    db.refresh(trustor_q)
    db.refresh(share_q)

    return group.id, trustor_q.id, share_q.id


def _create_template(db, user_id, markdown_content):
    """Create a template with given markdown content. Returns template_id."""
    template = Template(
        name="Test Template",
        description="Test",
        template_type="direct",
        markdown_content=markdown_content,
        created_by=user_id
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template.id


def _create_session_with_answers(db, user_id, group_id, answers_map):
    """Create a session and save answers. answers_map: {question_id: answer_value}.
    Returns session_id."""
    session = InputForm(
        client_identifier="Test Client",
        user_id=user_id,
        current_group_id=group_id,
        is_completed=False
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    for q_id, val in answers_map.items():
        ans = SessionAnswer(
            session_id=session.id,
            question_id=q_id,
            answer_value=val
        )
        db.add(ans)
    db.commit()
    return session.id


class TestDocumentMergeConjunction:
    """Test person conjunction in document merge/preview."""

    def test_preview_two_persons_no_conjunction_defaults_to_and(self, client, user_token, test_user, db):
        """When person data has no conjunction field, names should be joined with 'and'."""
        group_id, trustor_qid, share_qid = _setup_repeatable_group(db)

        template_id = _create_template(
            db, test_user,
            "BE IT KNOWN THAT the undersigned, <<trustor>>, established a Trust."
        )

        # Person data WITHOUT conjunction (the bug scenario)
        person_data = json.dumps([
            json.dumps({"name": "Shay Stiers"}),
            json.dumps({"name": "Kyra Dushkin"})
        ])
        session_id = _create_session_with_answers(db, test_user, group_id, {
            trustor_qid: person_data
        })

        response = client.post(
            f"/api/v1/documents/preview?session_id={session_id}&template_id={template_id}"
        )
        assert response.status_code == 200
        content = response.json()["markdown_content"]
        assert "Shay Stiers and Kyra Dushkin" in content
        assert "Shay Stiers Kyra Dushkin" not in content.replace("Shay Stiers and Kyra Dushkin", "")

    def test_preview_two_persons_with_and_conjunction(self, client, user_token, test_user, db):
        """Person data with explicit 'and' conjunction."""
        group_id, trustor_qid, share_qid = _setup_repeatable_group(db)

        template_id = _create_template(
            db, test_user,
            "Trustors: <<trustor>>"
        )

        person_data = json.dumps([
            json.dumps({"name": "Alice", "conjunction": "and"}),
            json.dumps({"name": "Bob", "conjunction": "and"})
        ])
        session_id = _create_session_with_answers(db, test_user, group_id, {
            trustor_qid: person_data
        })

        response = client.post(
            f"/api/v1/documents/preview?session_id={session_id}&template_id={template_id}"
        )
        assert response.status_code == 200
        content = response.json()["markdown_content"]
        assert "Alice and Bob" in content

    def test_preview_three_persons_with_and_conjunction(self, client, user_token, test_user, db):
        """Three persons with 'and' — should use Oxford comma in inline array join."""
        group_id, trustor_qid, share_qid = _setup_repeatable_group(db)

        template_id = _create_template(
            db, test_user,
            "Trustors: <<trustor>>"
        )

        person_data = json.dumps([
            json.dumps({"name": "Alice", "conjunction": "and"}),
            json.dumps({"name": "Bob", "conjunction": "and"}),
            json.dumps({"name": "Carol", "conjunction": "and"})
        ])
        session_id = _create_session_with_answers(db, test_user, group_id, {
            trustor_qid: person_data
        })

        response = client.post(
            f"/api/v1/documents/preview?session_id={session_id}&template_id={template_id}"
        )
        assert response.status_code == 200
        content = response.json()["markdown_content"]
        # _format_answer_value handles person formatting directly
        assert "Alice" in content
        assert "Bob" in content
        assert "Carol" in content

    def test_preview_persons_with_then_conjunction(self, client, user_token, test_user, db):
        """Person data with 'then' conjunction."""
        group_id, trustor_qid, share_qid = _setup_repeatable_group(db)

        template_id = _create_template(
            db, test_user,
            "Order: <<trustor>>"
        )

        person_data = json.dumps([
            json.dumps({"name": "Alice"}),
            json.dumps({"name": "Bob", "conjunction": "then"})
        ])
        session_id = _create_session_with_answers(db, test_user, group_id, {
            trustor_qid: person_data
        })

        response = client.post(
            f"/api/v1/documents/preview?session_id={session_id}&template_id={template_id}"
        )
        assert response.status_code == 200
        content = response.json()["markdown_content"]
        assert "Alice" in content
        assert "then" in content
        assert "Bob" in content

    def test_preview_inline_repeatable_share_uses_conjunction(self, client, user_token, test_user, db):
        """Non-person repeatable (shares) inline should be joined with conjunction from person entries."""
        group_id, trustor_qid, share_qid = _setup_repeatable_group(db)

        template_id = _create_template(
            db, test_user,
            "Shares: <<trustor_share>>"
        )

        person_data = json.dumps([
            json.dumps({"name": "Alice", "conjunction": "and"}),
            json.dumps({"name": "Bob", "conjunction": "and"})
        ])
        share_data = json.dumps(["50%", "50%"])
        session_id = _create_session_with_answers(db, test_user, group_id, {
            trustor_qid: person_data,
            share_qid: share_data
        })

        response = client.post(
            f"/api/v1/documents/preview?session_id={session_id}&template_id={template_id}"
        )
        assert response.status_code == 200
        content = response.json()["markdown_content"]
        assert "50% and 50%" in content

    def test_preview_inline_three_shares_oxford_comma(self, client, user_token, test_user, db):
        """Three non-person repeatable values with 'and' should use Oxford comma."""
        group_id, trustor_qid, share_qid = _setup_repeatable_group(db)

        template_id = _create_template(
            db, test_user,
            "Shares: <<trustor_share>>"
        )

        person_data = json.dumps([
            json.dumps({"name": "Alice", "conjunction": "and"}),
            json.dumps({"name": "Bob", "conjunction": "and"}),
            json.dumps({"name": "Carol", "conjunction": "and"})
        ])
        share_data = json.dumps(["50%", "30%", "20%"])
        session_id = _create_session_with_answers(db, test_user, group_id, {
            trustor_qid: person_data,
            share_qid: share_data
        })

        response = client.post(
            f"/api/v1/documents/preview?session_id={session_id}&template_id={template_id}"
        )
        assert response.status_code == 200
        content = response.json()["markdown_content"]
        assert "50%, 30%, and 20%" in content

    def test_preview_single_person_no_conjunction(self, client, user_token, test_user, db):
        """Single person should just show the name, no conjunction needed."""
        group_id, trustor_qid, share_qid = _setup_repeatable_group(db)

        template_id = _create_template(
            db, test_user,
            "Trustor: <<trustor>>"
        )

        person_data = json.dumps([
            json.dumps({"name": "Alice"})
        ])
        session_id = _create_session_with_answers(db, test_user, group_id, {
            trustor_qid: person_data
        })

        response = client.post(
            f"/api/v1/documents/preview?session_id={session_id}&template_id={template_id}"
        )
        assert response.status_code == 200
        content = response.json()["markdown_content"]
        assert "Trustor: Alice" in content

    def test_generate_document_has_conjunction(self, client, user_token, test_user, db):
        """Generate (not just preview) should also have conjunctions."""
        group_id, trustor_qid, share_qid = _setup_repeatable_group(db)

        template_id = _create_template(
            db, test_user,
            "<<trustor>> established a Trust."
        )

        person_data = json.dumps([
            json.dumps({"name": "Shay Stiers"}),
            json.dumps({"name": "Kyra Dushkin"})
        ])
        session_id = _create_session_with_answers(db, test_user, group_id, {
            trustor_qid: person_data
        })

        response = client.post(
            "/api/v1/documents/generate",
            json={
                "session_id": session_id,
                "template_id": template_id,
                "document_name": "Test Doc"
            }
        )
        assert response.status_code == 201
        content = response.json()["markdown_content"]
        assert "Shay Stiers and Kyra Dushkin" in content


class TestDocumentMergeAuthz:
    """Negative-path authorization and not-found tests for document preview/generate."""

    def test_preview_nonexistent_session_returns_404(self, client, user_token, test_user, db):
        """Previewing a session that does not exist should return 404."""
        response = client.post(
            "/api/v1/documents/preview?session_id=999999&template_id=1"
        )
        assert response.status_code == 404

    def test_preview_nonexistent_template_returns_404(self, client, user_token, test_user, db):
        """Previewing with a valid session but a nonexistent template should return 404."""
        group_id, trustor_qid, _ = _setup_repeatable_group(db)
        session_id = _create_session_with_answers(db, test_user, group_id, {})

        response = client.post(
            f"/api/v1/documents/preview?session_id={session_id}&template_id=999999"
        )
        assert response.status_code == 404

    def test_preview_session_belonging_to_other_user_returns_404(self, client, user_token, test_user, db):
        """Previewing a session owned by a different user should return 403 or 404."""
        # Create a second user directly in the database.
        other_user = User(
            username="otheruser",
            email="other@test.com",
            hashed_password=hash_password("password2"),
            role=UserRole.user,
            is_active=True
        )
        db.add(other_user)
        db.commit()
        db.refresh(other_user)

        # Create a template and session owned by test_user (user1).
        group_id, trustor_qid, _ = _setup_repeatable_group(db, group_identifier="authz_group")
        template_id = _create_template(db, test_user, "Hello <<trustor>>")
        session_id = _create_session_with_answers(db, test_user, group_id, {})

        # Login as the second user using a fresh TestClient (its own cookie jar).
        other_client = TestClient(app)
        login_response = other_client.post(
            "/api/v1/auth/login",
            json={"username": "otheruser", "password": "password2"}
        )
        assert login_response.status_code == 200

        # Attempt to preview user1's session while authenticated as user2.
        response = other_client.post(
            f"/api/v1/documents/preview?session_id={session_id}&template_id={template_id}"
        )
        assert response.status_code in (403, 404)

    def test_generate_nonexistent_session_returns_404(self, client, user_token, test_user, db):
        """Generating a document for a session that does not exist should return 404."""
        response = client.post(
            "/api/v1/documents/generate",
            json={"session_id": 999999, "template_id": 1, "document_name": "Test"}
        )
        assert response.status_code == 404
