from sqlalchemy import Column, Integer, String, Text, Boolean, Enum, ForeignKey, JSON
from sqlalchemy.orm import relationship
import enum
from . import Base, TimestampMixin, SoftDeleteMixin


class QuestionType(str, enum.Enum):
    """Question type enumeration."""
    MULTIPLE_CHOICE = "multiple_choice"
    FREE_TEXT = "free_text"
    DATABASE_DROPDOWN = "database_dropdown"
    PERSON = "person"
    DATE = "date"


class QuestionGroup(Base, TimestampMixin, SoftDeleteMixin):
    """Question group model."""
    
    __tablename__ = "question_groups"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    identifier = Column(String(100), unique=True, nullable=False, index=True)
    display_order = Column(Integer, default=0, nullable=False)
    
    # Question logic stored as JSON (list of question items with conditionals)
    # Structure: [{ type: 'question', questionId: 123 }, { type: 'conditional', ifIdentifier: 'prev_q', value: 'yes', nestedItems: [...] }]
    question_logic = Column(JSON, nullable=True)
    
    # Relationships
    questions = relationship(
        "Question",
        back_populates="question_group",
        cascade="all, delete-orphan",
        order_by="Question.display_order"
    )
    
    def __repr__(self) -> str:
        return f"<QuestionGroup(id={self.id}, name='{self.name}', identifier='{self.identifier}')>"
    
    def to_dict(self) -> dict:
        """Convert question group to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "identifier": self.identifier,
            "display_order": self.display_order,
            "question_logic": self.question_logic,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "is_active": self.is_active,
            "question_count": len(self.questions) if self.questions else 0,
        }


class Question(Base, TimestampMixin, SoftDeleteMixin):
    """Question model."""
    
    __tablename__ = "questions"
    
    id = Column(Integer, primary_key=True, index=True)
    question_group_id = Column(Integer, ForeignKey("question_groups.id"), nullable=False, index=True)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(50), nullable=False)  # Validated by Pydantic schema
    identifier = Column(String(100), nullable=False, index=True)
    repeatable = Column(Boolean, default=False, nullable=False)
    repeatable_group_id = Column(String(100), nullable=True)  # ID to group repeatable questions together
    display_order = Column(Integer, default=0, nullable=False)
    is_required = Column(Boolean, default=True, nullable=False)
    help_text = Column(Text, nullable=True)
    
    # For multiple choice questions
    options = Column(JSON, nullable=True)  # List of options: [{"value": "male", "label": "Male"}, ...]
    
    # For database dropdown questions
    database_table = Column(String(100), nullable=True)
    database_value_column = Column(String(100), nullable=True)
    database_label_column = Column(String(100), nullable=True)
    
    # For person type questions
    person_display_mode = Column(String(20), nullable=True)  # 'autocomplete' or 'dropdown'
    
    # For date type questions
    include_time = Column(Boolean, default=False, nullable=True)  # Whether to include time of day
    
    # Validation rules
    validation_rules = Column(JSON, nullable=True)  # {"min_length": 5, "max_length": 100, "pattern": "regex"}
    
    # Relationships
    question_group = relationship("QuestionGroup", back_populates="questions")
    
    def __repr__(self) -> str:
        qt = self.question_type.value if hasattr(self.question_type, 'value') else self.question_type
        return f"<Question(id={self.id}, identifier='{self.identifier}', type='{qt}')>"
    
    def to_dict(self) -> dict:
        """Convert question to dictionary."""
        qt = self.question_type.value if hasattr(self.question_type, 'value') else self.question_type
        return {
            "id": self.id,
            "question_group_id": self.question_group_id,
            "question_text": self.question_text,
            "question_type": qt,
            "identifier": self.identifier,
            "repeatable": self.repeatable,
            "repeatable_group_id": self.repeatable_group_id,
            "display_order": self.display_order,
            "is_required": self.is_required,
            "help_text": self.help_text,
            "options": self.options,
            "database_table": self.database_table,
            "database_value_column": self.database_value_column,
            "database_label_column": self.database_label_column,
            "person_display_mode": self.person_display_mode,
            "include_time": self.include_time,
            "validation_rules": self.validation_rules,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "is_active": self.is_active,
        }
