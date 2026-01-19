from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class GenerateDocumentRequest(BaseModel):
    """Schema for document generation request."""
    session_id: int
    template_id: int
    document_name: Optional[str] = None


class GeneratedDocumentResponse(BaseModel):
    """Schema for generated document response."""
    id: int
    session_id: int
    template_id: Optional[int]
    document_name: str
    markdown_content: str
    pdf_file_path: Optional[str]
    generated_by: Optional[int]
    generated_at: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GeneratedDocumentListResponse(BaseModel):
    """Schema for paginated document list response."""
    documents: list[GeneratedDocumentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class DocumentPreviewResponse(BaseModel):
    """Schema for document preview (before generation)."""
    template_name: str
    session_client: str
    markdown_content: str
    missing_identifiers: list[str]
    available_identifiers: list[str]
