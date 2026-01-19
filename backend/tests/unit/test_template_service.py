"""Unit tests for template service."""

import pytest
from unittest.mock import Mock, patch, MagicMock
from sqlalchemy.orm import Session
from fastapi import HTTPException

from src.services.template_service import TemplateService
from src.models.template import Template, TemplateType
from src.schemas.template import TemplateCreate, TemplateUpdate


class TestTemplateService:
    """Test suite for TemplateService."""
    
    def test_create_template_success(self, db_session: Session):
        """Test successful template creation."""
        template_data = TemplateCreate(
            name="Test Template",
            description="Test description",
            template_type="direct",
            markdown_content="# Test\n\nName: <<client_name>>"
        )
        
        with patch('src.services.template_service.DocumentProcessor.validate_markdown', return_value=True):
            template = TemplateService.create_template(db_session, template_data, 1)
            
            assert template.name == "Test Template"
            assert template.description == "Test description"
            assert template.template_type == TemplateType.DIRECT
            assert template.markdown_content == "# Test\n\nName: <<client_name>>"
            assert template.created_by == 1
    
    def test_create_template_invalid_markdown(self, db_session: Session):
        """Test template creation with invalid markdown."""
        template_data = TemplateCreate(
            name="Test Template",
            description="Test description",
            template_type="direct",
            markdown_content="Invalid markdown"
        )
        
        with patch('src.services.template_service.DocumentProcessor.validate_markdown', return_value=False):
            with pytest.raises(HTTPException) as exc_info:
                TemplateService.create_template(db_session, template_data, 1)
            
            assert exc_info.value.status_code == 400
            assert "Invalid Markdown content" in str(exc_info.value.detail)
    
    def test_get_template_success(self, db_session: Session):
        """Test getting a template by ID."""
        # Create a template first
        template_data = TemplateCreate(
            name="Test Template",
            template_type="direct",
            markdown_content="# Test"
        )
        
        with patch('src.services.template_service.DocumentProcessor.validate_markdown', return_value=True):
            created = TemplateService.create_template(db_session, template_data, 1)
            
            # Get the template
            retrieved = TemplateService.get_template(db_session, created.id)
            
            assert retrieved is not None
            assert retrieved.id == created.id
            assert retrieved.name == "Test Template"
    
    def test_get_template_not_found(self, db_session: Session):
        """Test getting a non-existent template."""
        template = TemplateService.get_template(db_session, 99999)
        assert template is None
    
    def test_list_templates_with_pagination(self, db_session: Session):
        """Test listing templates with pagination."""
        # Create multiple templates
        with patch('src.services.template_service.DocumentProcessor.validate_markdown', return_value=True):
            for i in range(5):
                template_data = TemplateCreate(
                    name=f"Template {i}",
                    template_type="direct",
                    markdown_content=f"# Template {i}"
                )
                TemplateService.create_template(db_session, template_data, 1)
        
        # Test pagination
        templates, total = TemplateService.list_templates(db_session, skip=0, limit=3)
        
        assert len(templates) == 3
        assert total == 5
    
    def test_list_templates_with_search(self, db_session: Session):
        """Test listing templates with search."""
        with patch('src.services.template_service.DocumentProcessor.validate_markdown', return_value=True):
            # Create templates with different names
            TemplateService.create_template(
                db_session,
                TemplateCreate(name="Invoice Template", template_type="direct", markdown_content="# Invoice"),
                1
            )
            TemplateService.create_template(
                db_session,
                TemplateCreate(name="Receipt Template", template_type="direct", markdown_content="# Receipt"),
                1
            )
            TemplateService.create_template(
                db_session,
                TemplateCreate(name="Contract Template", template_type="direct", markdown_content="# Contract"),
                1
            )
        
        # Search for "Invoice"
        templates, total = TemplateService.list_templates(db_session, search="Invoice")
        
        assert total == 1
        assert templates[0].name == "Invoice Template"
    
    def test_update_template_success(self, db_session: Session):
        """Test updating a template."""
        # Create a template
        with patch('src.services.template_service.DocumentProcessor.validate_markdown', return_value=True):
            template = TemplateService.create_template(
                db_session,
                TemplateCreate(name="Original Name", template_type="direct", markdown_content="# Original"),
                1
            )
            
            # Update the template
            update_data = TemplateUpdate(
                name="Updated Name",
                markdown_content="# Updated"
            )
            
            updated = TemplateService.update_template(db_session, template.id, update_data)
            
            assert updated is not None
            assert updated.name == "Updated Name"
            assert updated.markdown_content == "# Updated"
    
    def test_update_template_invalid_markdown(self, db_session: Session):
        """Test updating template with invalid markdown."""
        # Create a template
        with patch('src.services.template_service.DocumentProcessor.validate_markdown', return_value=True):
            template = TemplateService.create_template(
                db_session,
                TemplateCreate(name="Test", template_type="direct", markdown_content="# Test"),
                1
            )
        
        # Try to update with invalid markdown
        with patch('src.services.template_service.DocumentProcessor.validate_markdown', return_value=False):
            update_data = TemplateUpdate(markdown_content="Invalid")
            
            with pytest.raises(HTTPException) as exc_info:
                TemplateService.update_template(db_session, template.id, update_data)
            
            assert exc_info.value.status_code == 400
    
    def test_update_template_not_found(self, db_session: Session):
        """Test updating a non-existent template."""
        update_data = TemplateUpdate(name="Updated")
        updated = TemplateService.update_template(db_session, 99999, update_data)
        
        assert updated is None
    
    def test_delete_template_success(self, db_session: Session):
        """Test soft deleting a template."""
        # Create a template
        with patch('src.services.template_service.DocumentProcessor.validate_markdown', return_value=True):
            template = TemplateService.create_template(
                db_session,
                TemplateCreate(name="Test", template_type="direct", markdown_content="# Test"),
                1
            )
            
            # Delete the template
            success = TemplateService.delete_template(db_session, template.id)
            
            assert success is True
            
            # Verify it's soft deleted
            deleted = db_session.query(Template).filter(Template.id == template.id).first()
            assert deleted.is_active is False
    
    def test_delete_template_not_found(self, db_session: Session):
        """Test deleting a non-existent template."""
        success = TemplateService.delete_template(db_session, 99999)
        assert success is False
    
    def test_get_template_identifiers(self, db_session: Session):
        """Test extracting identifiers from a template."""
        # Create a template with identifiers
        with patch('src.services.template_service.DocumentProcessor.validate_markdown', return_value=True):
            template = TemplateService.create_template(
                db_session,
                TemplateCreate(
                    name="Test",
                    template_type="direct",
                    markdown_content="Name: <<client_name>>\nDOB: <<dob>>\nAddress: <<address>>"
                ),
                1
            )
            
            # Get identifiers
            identifiers = TemplateService.get_template_identifiers(db_session, template.id)
            
            assert identifiers is not None
            assert len(identifiers) == 3
            assert "client_name" in identifiers
            assert "dob" in identifiers
            assert "address" in identifiers
    
    def test_get_template_identifiers_not_found(self, db_session: Session):
        """Test getting identifiers from non-existent template."""
        identifiers = TemplateService.get_template_identifiers(db_session, 99999)
        assert identifiers is None


@pytest.fixture
def db_session():
    """Create a mock database session."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from src.models import Base
    
    # Use in-memory SQLite for testing
    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(engine)
    
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    
    yield session
    
    session.close()
