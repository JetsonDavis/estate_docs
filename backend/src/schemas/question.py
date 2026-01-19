from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime


class QuestionOption(BaseModel):
    """Schema for multiple choice question option."""
    value: str
    label: str


class QuestionBase(BaseModel):
    """Base question schema."""
    question_text: str = Field(..., min_length=1, max_length=1000)
    question_type: str = Field(..., pattern="^(multiple_choice|free_text|database_dropdown)$")
    identifier: str = Field(..., min_length=1, max_length=100, pattern="^[a-z0-9_]+$")
    display_order: int = Field(default=0, ge=0)
    is_required: bool = Field(default=True)
    help_text: Optional[str] = Field(None, max_length=500)
    options: Optional[List[QuestionOption]] = None
    database_table: Optional[str] = Field(None, max_length=100)
    database_value_column: Optional[str] = Field(None, max_length=100)
    database_label_column: Optional[str] = Field(None, max_length=100)
    validation_rules: Optional[Dict[str, Any]] = None


class QuestionCreate(QuestionBase):
    """Schema for creating a question."""
    question_group_id: int
    
    @field_validator('options')
    @classmethod
    def validate_options(cls, v: Optional[List[QuestionOption]], info) -> Optional[List[QuestionOption]]:
        """Validate options for multiple choice questions."""
        question_type = info.data.get('question_type')
        if question_type == 'multiple_choice':
            if not v or len(v) < 2:
                raise ValueError('Multiple choice questions must have at least 2 options')
        return v
    
    @field_validator('database_table')
    @classmethod
    def validate_database_fields(cls, v: Optional[str], info) -> Optional[str]:
        """Validate database fields for database dropdown questions."""
        question_type = info.data.get('question_type')
        if question_type == 'database_dropdown':
            if not v:
                raise ValueError('Database dropdown questions must specify database_table')
            if not info.data.get('database_value_column'):
                raise ValueError('Database dropdown questions must specify database_value_column')
            if not info.data.get('database_label_column'):
                raise ValueError('Database dropdown questions must specify database_label_column')
        return v


class QuestionUpdate(BaseModel):
    """Schema for updating a question."""
    question_text: Optional[str] = Field(None, min_length=1, max_length=1000)
    question_type: Optional[str] = Field(None, pattern="^(multiple_choice|free_text|database_dropdown)$")
    display_order: Optional[int] = Field(None, ge=0)
    is_required: Optional[bool] = None
    help_text: Optional[str] = Field(None, max_length=500)
    options: Optional[List[QuestionOption]] = None
    database_table: Optional[str] = Field(None, max_length=100)
    database_value_column: Optional[str] = Field(None, max_length=100)
    database_label_column: Optional[str] = Field(None, max_length=100)
    validation_rules: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class QuestionResponse(BaseModel):
    """Schema for question response."""
    id: int
    question_group_id: int
    question_text: str
    question_type: str
    identifier: str
    display_order: int
    is_required: bool
    help_text: Optional[str]
    options: Optional[List[Dict[str, str]]]
    database_table: Optional[str]
    database_value_column: Optional[str]
    database_label_column: Optional[str]
    validation_rules: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime
    is_active: bool
    
    model_config = {"from_attributes": True}


class QuestionGroupBase(BaseModel):
    """Base question group schema."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    identifier: str = Field(..., min_length=1, max_length=100, pattern="^[a-z0-9_]+$")
    display_order: int = Field(default=0, ge=0)


class QuestionGroupCreate(QuestionGroupBase):
    """Schema for creating a question group."""
    pass


class QuestionGroupUpdate(BaseModel):
    """Schema for updating a question group."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    display_order: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class QuestionGroupResponse(BaseModel):
    """Schema for question group response."""
    id: int
    name: str
    description: Optional[str]
    identifier: str
    display_order: int
    created_at: datetime
    updated_at: datetime
    is_active: bool
    question_count: int
    
    model_config = {"from_attributes": True}


class QuestionGroupDetailResponse(QuestionGroupResponse):
    """Schema for detailed question group response with questions."""
    questions: List[QuestionResponse] = []


class QuestionGroupListResponse(BaseModel):
    """Schema for question group list response."""
    question_groups: List[QuestionGroupResponse]
    total: int
    page: int
    page_size: int
