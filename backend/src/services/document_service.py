"""Service layer for document generation and merge operations."""

from sqlalchemy.orm import Session
from typing import Optional, Tuple, List
from fastapi import HTTPException, status
import re
from datetime import datetime

from ..models.document import GeneratedDocument
from ..models.template import Template
from ..models.session import DocumentSession, SessionAnswer
from ..models.question import Question
from ..schemas.document import GenerateDocumentRequest


class DocumentService:
    """Service for document generation and merge operations."""
    
    @staticmethod
    def generate_document(
        db: Session,
        request: GenerateDocumentRequest,
        user_id: int
    ) -> GeneratedDocument:
        """
        Generate a document by merging session answers into a template.
        
        Args:
            db: Database session
            request: Document generation request
            user_id: User ID generating the document
            
        Returns:
            Generated document
        """
        # Get template
        template = db.query(Template).filter(
            Template.id == request.template_id,
            Template.is_active == True
        ).first()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )
        
        # Get session (verify user owns it)
        session = db.query(DocumentSession).filter(
            DocumentSession.id == request.session_id,
            DocumentSession.user_id == user_id
        ).first()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Get all answers for the session
        answers = db.query(SessionAnswer).filter(
            SessionAnswer.session_id == request.session_id
        ).all()
        
        # Build answer map: identifier -> answer_value
        answer_map = DocumentService._build_answer_map(db, answers)
        
        # Merge template with answers
        merged_content = DocumentService._merge_template(
            template.markdown_content,
            answer_map
        )
        
        # Generate document name if not provided
        document_name = request.document_name or f"{template.name} - {session.client_identifier}"
        
        # Create generated document
        document = GeneratedDocument(
            session_id=request.session_id,
            template_id=request.template_id,
            document_name=document_name,
            markdown_content=merged_content,
            generated_by=user_id,
            generated_at=datetime.utcnow()
        )
        
        db.add(document)
        db.commit()
        db.refresh(document)
        
        return document
    
    @staticmethod
    def _build_answer_map(db: Session, answers: List[SessionAnswer]) -> dict:
        """
        Build a map of question identifiers to answer values.
        
        Args:
            db: Database session
            answers: List of session answers
            
        Returns:
            Dictionary mapping identifiers to answer values
        """
        answer_map = {}
        
        for answer in answers:
            # Get question to find its identifier
            question = db.query(Question).filter(
                Question.id == answer.question_id
            ).first()
            
            if question:
                answer_map[question.identifier] = answer.answer_value
        
        return answer_map
    
    @staticmethod
    def _merge_template(template_content: str, answer_map: dict) -> str:
        """
        Merge template content with answer values.
        
        Replaces all occurrences of <<identifier>> with corresponding answer values.
        
        Args:
            template_content: Template markdown content
            answer_map: Dictionary mapping identifiers to answer values
            
        Returns:
            Merged content with identifiers replaced
        """
        merged_content = template_content
        
        # Find all identifiers in template (e.g., <<identifier>>)
        pattern = r'<<([^>]+)>>'
        
        def replace_identifier(match):
            identifier = match.group(1)
            # Return answer value if available, otherwise keep placeholder
            return answer_map.get(identifier, f"[{identifier}: NOT ANSWERED]")
        
        merged_content = re.sub(pattern, replace_identifier, merged_content)
        
        return merged_content
    
    @staticmethod
    def preview_document(
        db: Session,
        session_id: int,
        template_id: int,
        user_id: int
    ) -> dict:
        """
        Preview a document merge without saving.
        
        Args:
            db: Database session
            session_id: Session ID
            template_id: Template ID
            user_id: User ID
            
        Returns:
            Preview data including merged content and missing identifiers
        """
        # Get template
        template = db.query(Template).filter(
            Template.id == template_id,
            Template.is_active == True
        ).first()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )
        
        # Get session
        session = db.query(DocumentSession).filter(
            DocumentSession.id == session_id,
            DocumentSession.user_id == user_id
        ).first()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Get answers
        answers = db.query(SessionAnswer).filter(
            SessionAnswer.session_id == session_id
        ).all()
        
        answer_map = DocumentService._build_answer_map(db, answers)
        
        # Get template identifiers
        template_identifiers = template.extract_identifiers()
        
        # Find missing identifiers
        missing_identifiers = [
            identifier for identifier in template_identifiers
            if identifier not in answer_map
        ]
        
        # Merge content
        merged_content = DocumentService._merge_template(
            template.markdown_content,
            answer_map
        )
        
        return {
            "template_name": template.name,
            "session_client": session.client_identifier,
            "markdown_content": merged_content,
            "missing_identifiers": missing_identifiers,
            "available_identifiers": list(answer_map.keys())
        }
    
    @staticmethod
    def get_document(
        db: Session,
        document_id: int,
        user_id: int
    ) -> Optional[GeneratedDocument]:
        """
        Get a generated document by ID.
        
        Args:
            db: Database session
            document_id: Document ID
            user_id: User ID
            
        Returns:
            Generated document if found and user has access
        """
        return db.query(GeneratedDocument).join(
            DocumentSession,
            GeneratedDocument.session_id == DocumentSession.id
        ).filter(
            GeneratedDocument.id == document_id,
            DocumentSession.user_id == user_id
        ).first()
    
    @staticmethod
    def list_documents(
        db: Session,
        user_id: int,
        skip: int = 0,
        limit: int = 100
    ) -> Tuple[List[GeneratedDocument], int]:
        """
        List generated documents for a user.
        
        Args:
            db: Database session
            user_id: User ID
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            Tuple of (documents list, total count)
        """
        query = db.query(GeneratedDocument).join(
            DocumentSession,
            GeneratedDocument.session_id == DocumentSession.id
        ).filter(
            DocumentSession.user_id == user_id
        )
        
        total = query.count()
        documents = query.order_by(GeneratedDocument.generated_at.desc()).offset(skip).limit(limit).all()
        
        return documents, total
    
    @staticmethod
    def delete_document(
        db: Session,
        document_id: int,
        user_id: int
    ) -> bool:
        """
        Delete a generated document.
        
        Args:
            db: Database session
            document_id: Document ID
            user_id: User ID
            
        Returns:
            True if deleted, False if not found
        """
        document = DocumentService.get_document(db, document_id, user_id)
        if not document:
            return False
        
        db.delete(document)
        db.commit()
        
        return True
