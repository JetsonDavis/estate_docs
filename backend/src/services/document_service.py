"""Service layer for document generation and merge operations."""

from sqlalchemy.orm import Session
from typing import Optional, Tuple, List
from fastapi import HTTPException, status
import re
from datetime import datetime
from docx import Document
from docx.shared import Pt
import io
import json

from ..models.document import GeneratedDocument
from ..models.template import Template
from ..models.session import DocumentSession, SessionAnswer
from ..models.question import Question
from ..models.person import Person
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
                # Format person answers with conjunctions
                formatted_value = DocumentService._format_answer_value(
                    answer.answer_value, 
                    question.question_type
                )
                answer_map[question.identifier] = formatted_value
        
        return answer_map
    
    @staticmethod
    def _format_answer_value(answer_value: str, question_type: str) -> str:
        """
        Format an answer value for display in merged documents.
        
        For person-type questions, converts JSON array with conjunctions to readable text.
        E.g., [{"name": "John", "conjunction": "and"}, {"name": "Jane"}] -> "John and Jane"
        
        Args:
            answer_value: Raw answer value from database
            question_type: Type of the question
            
        Returns:
            Formatted answer string
        """
        if question_type != 'person':
            return answer_value
        
        # Try to parse as JSON array of person objects
        try:
            import json
            parsed = json.loads(answer_value)
            
            if isinstance(parsed, list) and len(parsed) > 0:
                # Check if it's the new format with objects containing name and conjunction
                if isinstance(parsed[0], dict) and 'name' in parsed[0]:
                    parts = []
                    for i, person in enumerate(parsed):
                        name = person.get('name', '')
                        if name:
                            parts.append(name)
                            # Add conjunction after this person if it exists and there's a next person
                            if i < len(parsed) - 1:
                                conjunction = person.get('conjunction', '')
                                if conjunction:
                                    parts.append(conjunction)
                    return ' '.join(parts)
                elif isinstance(parsed[0], str):
                    # Old format - just an array of strings
                    return ', '.join(parsed)
            
            return answer_value
        except (json.JSONDecodeError, TypeError):
            # Not JSON, return as-is
            return answer_value
    
    @staticmethod
    def _is_value_empty(value: str) -> bool:
        """Check if a value should be considered empty."""
        if not value:
            return True
        if not value.strip():
            return True
        if value.startswith('[') and value.endswith(']'):
            # Looks like "[identifier: NOT ANSWERED]"
            return True
        return False
    
    @staticmethod
    def _merge_template(template_content: str, answer_map: dict) -> str:
        """
        Merge template content with answer values.
        
        Replaces all occurrences of <<identifier>> with corresponding answer values.
        
        Supports conditional syntax:
        - [[ ... ]] - If all identifiers inside are empty, remove the entire section
        - {{ IF <<identifier>> }} ... {{ END }} - Include content if identifier is NOT empty
        - {{ IF NOT <<identifier>> }} ... {{ END }} - Include content if identifier IS empty
        
        Args:
            template_content: Template markdown content
            answer_map: Dictionary mapping identifiers to answer values
            
        Returns:
            Merged content with identifiers replaced
        """
        merged_content = template_content
        
        # First, process {{ IF <<identifier>> = "value" }} ... {{ END }} blocks (equality check)
        # Include content only if the identifier equals the specified value
        if_equals_pattern = r'\{\{\s*IF\s+<<([^>]+)>>\s*=\s*"([^"]*)"\s*\}\}(.*?)\{\{\s*END\s*\}\}'
        
        def process_if_equals_block(match):
            identifier = match.group(1)
            expected_value = match.group(2)
            section_content = match.group(3)
            actual_value = answer_map.get(identifier, '')
            
            if actual_value == expected_value:
                # Values match - include the content
                return section_content
            else:
                # Values don't match - remove the section
                return ''
        
        merged_content = re.sub(if_equals_pattern, process_if_equals_block, merged_content, flags=re.DOTALL | re.IGNORECASE)
        
        # Process {{ IF <<identifier>> != "value" }} ... {{ END }} blocks (inequality check)
        # Include content only if the identifier does NOT equal the specified value
        if_not_equals_pattern = r'\{\{\s*IF\s+<<([^>]+)>>\s*!=\s*"([^"]*)"\s*\}\}(.*?)\{\{\s*END\s*\}\}'
        
        def process_if_not_equals_block(match):
            identifier = match.group(1)
            expected_value = match.group(2)
            section_content = match.group(3)
            actual_value = answer_map.get(identifier, '')
            
            if actual_value != expected_value:
                # Values don't match - include the content
                return section_content
            else:
                # Values match - remove the section
                return ''
        
        merged_content = re.sub(if_not_equals_pattern, process_if_not_equals_block, merged_content, flags=re.DOTALL | re.IGNORECASE)
        
        # Process {{ IF <<identifier>> }} ... {{ END }} blocks
        # Include content only if the identifier is NOT empty
        if_pattern = r'\{\{\s*IF\s+<<([^>]+)>>\s*\}\}(.*?)\{\{\s*END\s*\}\}'
        
        def process_if_block(match):
            identifier = match.group(1)
            section_content = match.group(2)
            value = answer_map.get(identifier, '')
            
            if not DocumentService._is_value_empty(value):
                # Identifier has a value - include the content
                return section_content
            else:
                # Identifier is empty - remove the section
                return ''
        
        merged_content = re.sub(if_pattern, process_if_block, merged_content, flags=re.DOTALL | re.IGNORECASE)
        
        # Process {{ IF NOT <<identifier>> }} ... {{ END }} blocks
        # Include content only if the identifier IS empty
        if_not_pattern = r'\{\{\s*IF\s+NOT\s+<<([^>]+)>>\s*\}\}(.*?)\{\{\s*END\s*\}\}'
        
        def process_if_not_block(match):
            identifier = match.group(1)
            section_content = match.group(2)
            value = answer_map.get(identifier, '')
            
            if DocumentService._is_value_empty(value):
                # Identifier is empty - include the content
                return section_content
            else:
                # Identifier has a value - remove the section
                return ''
        
        merged_content = re.sub(if_not_pattern, process_if_not_block, merged_content, flags=re.DOTALL | re.IGNORECASE)
        
        # Process conditional sections [[ ... ]]
        # If all identifiers inside are empty, remove the entire section
        conditional_pattern = r'\[\[(.*?)\]\]'
        
        def process_conditional_section(match):
            section_content = match.group(1)
            
            # Find all identifiers in this section
            identifier_pattern = r'<<([^>]+)>>'
            identifiers_in_section = re.findall(identifier_pattern, section_content)
            
            if not identifiers_in_section:
                # No identifiers in section, keep the content (without brackets)
                return section_content
            
            # Check if ALL identifiers in this section are empty
            all_empty = True
            for identifier in identifiers_in_section:
                value = answer_map.get(identifier, '')
                if not DocumentService._is_value_empty(value):
                    all_empty = False
                    break
            
            if all_empty:
                # All identifiers are empty - remove the entire section
                return ''
            else:
                # At least one identifier has a value - keep the section (without brackets)
                return section_content
        
        merged_content = re.sub(conditional_pattern, process_conditional_section, merged_content, flags=re.DOTALL)
        
        # Then, replace all identifiers with their values
        pattern = r'<<([^>]+)>>'
        
        def replace_identifier(match):
            identifier = match.group(1)
            value = answer_map.get(identifier, '')
            # Return answer value if available and not empty, otherwise return empty string
            if not DocumentService._is_value_empty(value):
                return value
            return ''
        
        merged_content = re.sub(pattern, replace_identifier, merged_content)
        
        # Finally, replace ## with auto-incrementing counter
        counter = [1]  # Use list to allow modification in nested function
        
        def replace_counter(match):
            current = counter[0]
            counter[0] += 1
            return str(current)
        
        merged_content = re.sub(r'##', replace_counter, merged_content)
        
        # Clean up any double spaces or extra whitespace left behind
        merged_content = re.sub(r'  +', ' ', merged_content)
        
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
    
    @staticmethod
    def merge_document(
        db: Session,
        session_id: int,
        template_id: int,
        user_id: int
    ) -> bytes:
        """
        Merge a template with session data and return a Word document.
        
        Args:
            db: Database session
            session_id: Document session ID
            template_id: Template ID
            user_id: User ID
            
        Returns:
            Bytes of the generated Word document
        """
        # Get template
        template = db.query(Template).filter(
            Template.id == template_id,
            Template.is_active == True
        ).first()
        
        if not template:
            raise ValueError("Template not found")
        
        # Get session (verify user owns it)
        session = db.query(DocumentSession).filter(
            DocumentSession.id == session_id,
            DocumentSession.user_id == user_id
        ).first()
        
        if not session:
            raise ValueError("Session not found")
        
        # Get all answers for this session with their question identifiers
        answers_query = db.query(SessionAnswer, Question).join(
            Question, SessionAnswer.question_id == Question.id
        ).filter(
            SessionAnswer.session_id == session_id
        ).all()
        
        # Build a mapping of identifier -> answer value (with formatting for person types)
        answer_map = {}
        for answer, question in answers_query:
            formatted_value = DocumentService._format_answer_value(
                answer.answer_value,
                question.question_type
            )
            answer_map[question.identifier] = formatted_value
        
        # Get template markdown content
        content = template.markdown_content or ""
        
        # Find all identifiers in the template
        identifier_pattern = r'<<([^>]+)>>'
        
        def replace_identifier(match):
            identifier = match.group(1).strip()
            
            # Check if this is a person field with dot notation (e.g., person.field)
            if '.' in identifier:
                parts = identifier.split('.', 1)
                person_identifier = parts[0]
                field_name = parts[1]
                
                # Get the person name from answers
                person_name = answer_map.get(person_identifier, '')
                
                # Handle JSON array of person names (multiple people)
                try:
                    person_names = json.loads(person_name)
                    if isinstance(person_names, list) and len(person_names) > 0:
                        person_name = person_names[0]  # Use first person for now
                except (json.JSONDecodeError, TypeError):
                    pass  # person_name is already a string
                
                if person_name:
                    # Look up the person in the database
                    person = db.query(Person).filter(
                        Person.name == person_name
                    ).first()
                    
                    if person:
                        # Get the specified field from the person
                        field_value = getattr(person, field_name, None)
                        if field_value is not None:
                            return str(field_value)
                
                # If person or field not found, return placeholder
                return f"<<{identifier}>>"
            
            # Regular identifier - get from answer map
            value = answer_map.get(identifier, '')
            
            # Handle JSON arrays (for person type questions with multiple values)
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    value = ', '.join(parsed)
            except (json.JSONDecodeError, TypeError):
                pass
            
            return value if value else f"<<{identifier}>>"
        
        # Replace all identifiers in the content
        merged_content = re.sub(identifier_pattern, replace_identifier, content)
        
        # Create a Word document
        doc = Document()
        
        # Add the merged content to the document
        # Split by paragraphs and add each one
        paragraphs = merged_content.split('\n')
        for para_text in paragraphs:
            if para_text.strip():
                paragraph = doc.add_paragraph(para_text)
                # Set default font
                for run in paragraph.runs:
                    run.font.size = Pt(12)
                    run.font.name = 'Calibri'
        
        # Save to bytes
        doc_bytes = io.BytesIO()
        doc.save(doc_bytes)
        doc_bytes.seek(0)
        
        return doc_bytes.getvalue()
