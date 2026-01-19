"""Integration tests for template API endpoints."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from io import BytesIO

from src.main import app
from src.database import get_db
from src.models import Base
from src.models.user import User, UserRole
from src.utils.security import hash_password


# Test database setup
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing."""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="function")
def test_db():
    """Create test database."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(test_db):
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def admin_user(test_db):
    """Create admin user for testing."""
    db = TestingSessionLocal()
    user = User(
        username="admin",
        email="admin@test.com",
        hashed_password=hash_password("password"),
        role=UserRole.ADMIN,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


@pytest.fixture
def admin_token(client, admin_user):
    """Get admin authentication token."""
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "password"}
    )
    assert response.status_code == 200
    return response.cookies.get("access_token")


class TestTemplateAPI:
    """Test suite for template API endpoints."""
    
    def test_create_template_success(self, client, admin_token):
        """Test creating a template."""
        response = client.post(
            "/api/v1/templates/",
            json={
                "name": "Test Template",
                "description": "Test description",
                "template_type": "direct",
                "markdown_content": "# Test\n\nName: <<client_name>>"
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Template"
        assert data["description"] == "Test description"
        assert data["template_type"] == "direct"
        assert "<<client_name>>" in data["markdown_content"]
        assert "id" in data
    
    def test_create_template_unauthorized(self, client):
        """Test creating template without authentication."""
        response = client.post(
            "/api/v1/templates/",
            json={
                "name": "Test Template",
                "template_type": "direct",
                "markdown_content": "# Test"
            }
        )
        
        assert response.status_code == 401
    
    def test_create_template_invalid_data(self, client, admin_token):
        """Test creating template with invalid data."""
        response = client.post(
            "/api/v1/templates/",
            json={
                "name": "",  # Empty name
                "template_type": "direct",
                "markdown_content": "# Test"
            }
        )
        
        assert response.status_code == 422
    
    def test_list_templates(self, client, admin_token):
        """Test listing templates."""
        # Create some templates
        for i in range(3):
            client.post(
                "/api/v1/templates/",
                json={
                    "name": f"Template {i}",
                    "template_type": "direct",
                    "markdown_content": f"# Template {i}"
                }
            )
        
        # List templates
        response = client.get("/api/v1/templates/")
        
        assert response.status_code == 200
        data = response.json()
        assert "templates" in data
        assert "total" in data
        assert data["total"] == 3
        assert len(data["templates"]) == 3
    
    def test_list_templates_with_pagination(self, client, admin_token):
        """Test listing templates with pagination."""
        # Create 5 templates
        for i in range(5):
            client.post(
                "/api/v1/templates/",
                json={
                    "name": f"Template {i}",
                    "template_type": "direct",
                    "markdown_content": f"# Template {i}"
                }
            )
        
        # Get first page
        response = client.get("/api/v1/templates/?skip=0&limit=2")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["templates"]) == 2
        assert data["total"] == 5
        assert data["page"] == 1
        assert data["page_size"] == 2
    
    def test_list_templates_with_search(self, client, admin_token):
        """Test listing templates with search."""
        # Create templates
        client.post(
            "/api/v1/templates/",
            json={
                "name": "Invoice Template",
                "template_type": "direct",
                "markdown_content": "# Invoice"
            }
        )
        client.post(
            "/api/v1/templates/",
            json={
                "name": "Receipt Template",
                "template_type": "direct",
                "markdown_content": "# Receipt"
            }
        )
        
        # Search for "Invoice"
        response = client.get("/api/v1/templates/?search=Invoice")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["templates"][0]["name"] == "Invoice Template"
    
    def test_get_template(self, client, admin_token):
        """Test getting a specific template."""
        # Create a template
        create_response = client.post(
            "/api/v1/templates/",
            json={
                "name": "Test Template",
                "template_type": "direct",
                "markdown_content": "# Test"
            }
        )
        template_id = create_response.json()["id"]
        
        # Get the template
        response = client.get(f"/api/v1/templates/{template_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == template_id
        assert data["name"] == "Test Template"
    
    def test_get_template_not_found(self, client, admin_token):
        """Test getting a non-existent template."""
        response = client.get("/api/v1/templates/99999")
        
        assert response.status_code == 404
    
    def test_update_template(self, client, admin_token):
        """Test updating a template."""
        # Create a template
        create_response = client.post(
            "/api/v1/templates/",
            json={
                "name": "Original Name",
                "template_type": "direct",
                "markdown_content": "# Original"
            }
        )
        template_id = create_response.json()["id"]
        
        # Update the template
        response = client.put(
            f"/api/v1/templates/{template_id}",
            json={
                "name": "Updated Name",
                "markdown_content": "# Updated"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["markdown_content"] == "# Updated"
    
    def test_update_template_not_found(self, client, admin_token):
        """Test updating a non-existent template."""
        response = client.put(
            "/api/v1/templates/99999",
            json={"name": "Updated"}
        )
        
        assert response.status_code == 404
    
    def test_delete_template(self, client, admin_token):
        """Test deleting a template."""
        # Create a template
        create_response = client.post(
            "/api/v1/templates/",
            json={
                "name": "Test Template",
                "template_type": "direct",
                "markdown_content": "# Test"
            }
        )
        template_id = create_response.json()["id"]
        
        # Delete the template
        response = client.delete(f"/api/v1/templates/{template_id}")
        
        assert response.status_code == 204
        
        # Verify it's deleted (soft delete)
        get_response = client.get(f"/api/v1/templates/{template_id}")
        assert get_response.status_code == 404
    
    def test_delete_template_not_found(self, client, admin_token):
        """Test deleting a non-existent template."""
        response = client.delete("/api/v1/templates/99999")
        
        assert response.status_code == 404
    
    def test_get_template_identifiers(self, client, admin_token):
        """Test getting identifiers from a template."""
        # Create a template with identifiers
        create_response = client.post(
            "/api/v1/templates/",
            json={
                "name": "Test Template",
                "template_type": "direct",
                "markdown_content": "Name: <<client_name>>\nDOB: <<dob>>\nAddress: <<address>>"
            }
        )
        template_id = create_response.json()["id"]
        
        # Get identifiers
        response = client.get(f"/api/v1/templates/{template_id}/identifiers")
        
        assert response.status_code == 200
        data = response.json()
        assert "identifiers" in data
        assert len(data["identifiers"]) == 3
        assert "client_name" in data["identifiers"]
        assert "dob" in data["identifiers"]
        assert "address" in data["identifiers"]
    
    def test_get_template_identifiers_not_found(self, client, admin_token):
        """Test getting identifiers from non-existent template."""
        response = client.get("/api/v1/templates/99999/identifiers")
        
        assert response.status_code == 404
    
    def test_upload_file_unauthorized(self, client):
        """Test file upload without authentication."""
        files = {"file": ("test.txt", BytesIO(b"test content"), "text/plain")}
        response = client.post("/api/v1/templates/upload", files=files)
        
        assert response.status_code == 401
    
    def test_upload_file_unsupported_type(self, client, admin_token):
        """Test uploading unsupported file type."""
        files = {"file": ("test.txt", BytesIO(b"test content"), "text/plain")}
        response = client.post("/api/v1/templates/upload", files=files)
        
        assert response.status_code == 400
        assert "Unsupported file type" in response.json()["detail"]
