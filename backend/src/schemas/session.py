from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class SessionAnswerBase(BaseModel):
    """Base schema for session answers."""
    question_id: int
    answer_value: str


class SessionAnswerCreate(SessionAnswerBase):
    """Schema for creating a session answer."""
    pass


class SessionAnswerResponse(SessionAnswerBase):
    """Schema for session answer response."""
    id: int
    session_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentSessionCreate(BaseModel):
    """Schema for creating a document session."""
    client_identifier: str = Field(..., min_length=1, max_length=255)
    flow_id: Optional[int] = None
    starting_group_id: Optional[int] = None


class DocumentSessionUpdate(BaseModel):
    """Schema for updating a document session."""
    current_group_id: Optional[int] = None
    is_completed: Optional[bool] = None


class DocumentSessionResponse(BaseModel):
    """Schema for document session response."""
    id: int
    client_identifier: str
    user_id: int
    flow_id: Optional[int]
    current_group_id: Optional[int]
    is_completed: bool
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentSessionWithAnswers(DocumentSessionResponse):
    """Schema for session with answers."""
    answers: List[SessionAnswerResponse]


class SubmitAnswersRequest(BaseModel):
    """Schema for submitting answers to a question group."""
    answers: List[SessionAnswerCreate]


class SessionProgressResponse(BaseModel):
    """Schema for session progress response."""
    session: DocumentSessionResponse
    current_group: Optional[dict]
    next_group_id: Optional[int]
    is_completed: bool
    total_answers: int
