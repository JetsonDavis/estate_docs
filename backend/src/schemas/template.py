from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime


class TemplateBase(BaseModel):
    """Base template schema."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class TemplateCreate(TemplateBase):
    """Schema for creating a template."""
    template_type: str = Field(..., pattern="^(word|pdf|image|direct)$")
    markdown_content: str = Field(..., min_length=1)
    original_filename: Optional[str] = None
    original_file_path: Optional[str] = None


class TemplateUpdate(BaseModel):
    """Schema for updating a template."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    markdown_content: Optional[str] = Field(None, min_length=1)


class TemplateResponse(TemplateBase):
    """Schema for template response."""
    id: int
    template_type: str
    original_filename: Optional[str]
    original_file_path: Optional[str]
    markdown_content: str
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class TemplateListResponse(BaseModel):
    """Schema for paginated template list response."""
    templates: list[TemplateResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class TemplateIdentifiersResponse(BaseModel):
    """Schema for template identifiers response."""
    template_id: int
    identifiers: list[str]


class FileUploadResponse(BaseModel):
    """Schema for file upload response."""
    filename: str
    file_path: str
    markdown_content: str
    message: str
