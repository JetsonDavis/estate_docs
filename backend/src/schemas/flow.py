from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


class QuestionnaireFlowCreate(BaseModel):
    """Schema for creating a questionnaire flow."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    flow_logic: Optional[Any] = None
    starting_group_id: Optional[int] = None
    question_group_ids: Optional[List[int]] = None


class QuestionnaireFlowUpdate(BaseModel):
    """Schema for updating a questionnaire flow."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    flow_logic: Optional[Any] = None
    starting_group_id: Optional[int] = None
    question_group_ids: Optional[List[int]] = None


class QuestionnaireFlowResponse(BaseModel):
    """Schema for questionnaire flow response."""
    id: int
    name: str
    description: Optional[str]
    flow_logic: Optional[Any]
    starting_group_id: Optional[int]
    created_by: Optional[int]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class QuestionnaireFlowWithGroups(QuestionnaireFlowResponse):
    """Schema for flow with associated question groups."""
    question_groups: List[dict]


class QuestionnaireFlowListResponse(BaseModel):
    """Schema for paginated flow list response."""
    flows: List[QuestionnaireFlowResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
