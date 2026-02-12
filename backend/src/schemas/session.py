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
    current_group_name: Optional[str] = None
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


class QuestionToDisplay(BaseModel):
    """Schema for a question to display in the document."""
    id: int
    identifier: str
    question_text: str
    question_type: str
    is_required: bool
    repeatable: bool = False
    repeatable_group_id: Optional[str] = None
    help_text: Optional[str]
    options: Optional[List[dict]]
    person_display_mode: Optional[str]
    include_time: Optional[bool]
    validation_rules: Optional[dict]
    current_answer: Optional[str] = None
    depth: int = 0  # Nesting level for conditional questions


class SessionQuestionsResponse(BaseModel):
    """Schema for session questions response with pagination."""
    session_id: int
    client_identifier: str
    flow_id: Optional[int]
    flow_name: Optional[str]
    current_group_id: int
    current_group_name: str
    current_group_index: int
    total_groups: int
    questions: List[QuestionToDisplay]
    current_page: int
    total_pages: int
    questions_per_page: int
    is_completed: bool
    is_last_group: bool
    can_go_back: bool
    existing_answers: dict  # question_id -> answer_value
    conditional_identifiers: List[str] = []  # identifiers that have conditionals depending on them


class SaveAnswersRequest(BaseModel):
    """Schema for saving answers (without navigating)."""
    answers: List[SessionAnswerCreate]


class NavigateRequest(BaseModel):
    """Schema for navigation request."""
    direction: str = Field(..., pattern="^(forward|backward)$")
    answers: Optional[List[SessionAnswerCreate]] = None
