"""Service layer for template operations."""

from sqlalchemy.orm import Session
from typing import Optional
from fastapi import HTTPException, status, UploadFile
from ..models.template import Template, TemplateType
from ..schemas.template import TemplateCreate, TemplateUpdate
from ..utils.document_processor import DocumentProcessor
from ..config import settings
import os


class TemplateService:
    """Service for template CRUD operations."""
    
    @staticmethod
    def create_template(db: Session, template_data: TemplateCreate, created_by: int) -> Template:
        """
        Create a new template.
        
        Args:
            db: Database session
            template_data: Template creation data
            created_by: User ID creating the template
            
        Returns:
            Created template
        """
        # Validate markdown content
        if not DocumentProcessor.validate_markdown(template_data.markdown_content):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Markdown content"
            )
        
        template = Template(
            name=template_data.name,
            description=template_data.description,
            template_type=template_data.template_type,  # Pass the string directly, SQLAlchemy will handle it
            markdown_content=template_data.markdown_content,
            original_filename=template_data.original_filename,
            original_file_path=template_data.original_file_path,
            created_by=created_by
        )
        
        db.add(template)
        db.commit()
        db.refresh(template)
        
        return template
    
    @staticmethod
    def get_template(db: Session, template_id: int) -> Optional[Template]:
        """
        Get template by ID.
        
        Args:
            db: Database session
            template_id: Template ID
            
        Returns:
            Template if found, None otherwise
        """
        return db.query(Template).filter(
            Template.id == template_id,
            Template.is_active == True
        ).first()
    
    @staticmethod
    def list_templates(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None
    ) -> tuple[list[Template], int]:
        """
        List templates with pagination and search.
        
        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            search: Optional search term for name
            
        Returns:
            Tuple of (templates list, total count)
        """
        query = db.query(Template).filter(Template.is_active == True)
        
        if search:
            query = query.filter(Template.name.ilike(f"%{search}%"))
        
        total = query.count()
        templates = query.order_by(Template.created_at.desc()).offset(skip).limit(limit).all()
        
        return templates, total
    
    @staticmethod
    def update_template(
        db: Session,
        template_id: int,
        template_data: TemplateUpdate
    ) -> Optional[Template]:
        """
        Update template.
        
        Args:
            db: Database session
            template_id: Template ID
            template_data: Update data
            
        Returns:
            Updated template if found, None otherwise
        """
        template = TemplateService.get_template(db, template_id)
        if not template:
            return None
        
        update_data = template_data.model_dump(exclude_unset=True)
        
        # Validate markdown if being updated
        if 'markdown_content' in update_data:
            if not DocumentProcessor.validate_markdown(update_data['markdown_content']):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid Markdown content"
                )
        
        for field, value in update_data.items():
            setattr(template, field, value)
        
        db.commit()
        db.refresh(template)
        
        return template
    
    @staticmethod
    def delete_template(db: Session, template_id: int) -> bool:
        """
        Soft delete template.
        
        Args:
            db: Database session
            template_id: Template ID
            
        Returns:
            True if deleted, False if not found
        """
        template = TemplateService.get_template(db, template_id)
        if not template:
            return False
        
        template.is_active = False
        db.commit()
        
        return True
    
    @staticmethod
    async def process_uploaded_file(
        file: UploadFile,
        created_by: int,
        db: Session = None,
        template_name: str = None
    ) -> dict:
        """
        Process uploaded file and convert to markdown.

        Args:
            file: Uploaded file
            created_by: User ID uploading the file
            db: Database session (optional, for fetching user info)
            template_name: Template name for markdown file naming (optional)

        Returns:
            Dictionary with file info and markdown content
        """
        # Determine file type
        file_type = DocumentProcessor.get_file_type(file.filename)
        if not file_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file type. Supported: .docx, .pdf, .txt, .jpg, .png, .tiff"
            )

        # Read file content
        content = await file.read()

        # Save file to storage
        upload_dir = settings.upload_dir
        file_path = DocumentProcessor.save_uploaded_file(content, file.filename, upload_dir)

        # Convert to markdown based on file type
        try:
            if file_type == 'word':
                markdown_content = DocumentProcessor.word_to_markdown(file_path)
            elif file_type == 'pdf':
                markdown_content = DocumentProcessor.pdf_to_markdown(file_path)
            elif file_type == 'text':
                markdown_content = DocumentProcessor.text_to_markdown(file_path)
            elif file_type == 'image':
                # For images, we would call AWS Textract here
                # For now, return placeholder
                markdown_content = "# OCR Processing Required\n\nPlease process this image with AWS Textract."
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Unsupported file type"
                )

            # Save markdown file to document_uploads if Word, PDF, or Text
            markdown_file_path = None
            if file_type in ['word', 'pdf', 'text'] and db and template_name:
                # Get username from database
                from ..models.user import User
                user = db.query(User).filter(User.id == created_by).first()
                username = user.username if user else f"user_{created_by}"

                # Save markdown file
                markdown_file_path = DocumentProcessor.save_markdown_file(
                    markdown_content,
                    template_name,
                    username
                )

        except Exception as e:
            # Clean up file if processing fails
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error processing file: {str(e)}"
            )

        return {
            "filename": file.filename,
            "file_path": file_path,
            "file_type": file_type,
            "markdown_content": markdown_content,
            "markdown_file_path": markdown_file_path
        }
    
    @staticmethod
    def get_template_identifiers(db: Session, template_id: int) -> Optional[list[str]]:
        """
        Get all identifiers from a template.
        
        Args:
            db: Database session
            template_id: Template ID
            
        Returns:
            List of identifiers if template found, None otherwise
        """
        template = TemplateService.get_template(db, template_id)
        if not template:
            return None
        
        return template.extract_identifiers()
