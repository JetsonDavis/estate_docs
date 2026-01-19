"""API endpoints for document generation and management."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..middleware.auth_middleware import require_auth
from ..schemas.document import (
    GenerateDocumentRequest,
    GeneratedDocumentResponse,
    GeneratedDocumentListResponse,
    DocumentPreviewResponse
)
from ..services.document_service import DocumentService


router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/generate", response_model=GeneratedDocumentResponse, status_code=status.HTTP_201_CREATED)
async def generate_document(
    request: GenerateDocumentRequest,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> GeneratedDocumentResponse:
    """
    Generate a document by merging session answers into a template.
    
    - **session_id**: Questionnaire session ID
    - **template_id**: Document template ID
    - **document_name**: Optional custom document name
    
    The system will replace all <<identifier>> placeholders in the template
    with corresponding answer values from the session.
    """
    document = DocumentService.generate_document(
        db,
        request,
        int(current_user["sub"])
    )
    
    return GeneratedDocumentResponse.model_validate(document)


@router.post("/preview", response_model=DocumentPreviewResponse)
async def preview_document(
    session_id: int,
    template_id: int,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> DocumentPreviewResponse:
    """
    Preview a document merge without saving.
    
    - **session_id**: Questionnaire session ID
    - **template_id**: Document template ID
    
    Returns the merged content and lists any missing identifiers that
    don't have corresponding answers in the session.
    """
    preview = DocumentService.preview_document(
        db,
        session_id,
        template_id,
        int(current_user["sub"])
    )
    
    return DocumentPreviewResponse(**preview)


@router.get("/", response_model=GeneratedDocumentListResponse)
async def list_documents(
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> GeneratedDocumentListResponse:
    """
    List all generated documents for the current user.
    
    - **skip**: Number of records to skip (default: 0)
    - **limit**: Maximum number of records to return (default: 100)
    """
    documents, total = DocumentService.list_documents(
        db,
        int(current_user["sub"]),
        skip,
        limit
    )
    
    page_size = limit
    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
    current_page = (skip // page_size) + 1 if page_size > 0 else 1
    
    return GeneratedDocumentListResponse(
        documents=[GeneratedDocumentResponse.model_validate(d) for d in documents],
        total=total,
        page=current_page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/{document_id}", response_model=GeneratedDocumentResponse)
async def get_document(
    document_id: int,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> GeneratedDocumentResponse:
    """
    Get a specific generated document.
    
    - **document_id**: Document ID
    """
    document = DocumentService.get_document(
        db,
        document_id,
        int(current_user["sub"])
    )
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return GeneratedDocumentResponse.model_validate(document)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: int,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    Delete a generated document.
    
    - **document_id**: Document ID
    """
    success = DocumentService.delete_document(
        db,
        document_id,
        int(current_user["sub"])
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
