from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class DocumentFlowCreate(BaseModel):
    """Schema for creating a document flow."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    starting_group_id: Optional[int] = None
    question_group_ids: Optional[List[int]] = None


class DocumentFlowUpdate(BaseModel):
    """Schema for updating a document flow."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    starting_group_id: Optional[int] = None
    question_group_ids: Optional[List[int]] = None


class DocumentFlowResponse(BaseModel):
    """Schema for document flow response."""
    id: int
    name: str
    description: Optional[str]
    starting_group_id: Optional[int]
    created_by: Optional[int]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentFlowWithGroups(DocumentFlowResponse):
    """Schema for flow with associated question groups."""
    question_groups: List[dict]


class DocumentFlowListResponse(BaseModel):
    """Schema for paginated flow list response."""
    flows: List[DocumentFlowResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
