from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from . import Base, TimestampMixin


class DocumentSession(Base, TimestampMixin):
    """Document session model for tracking client document progress."""
    
    __tablename__ = "document_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    client_identifier = Column(String(255), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    flow_id = Column(Integer, ForeignKey("document_flows.id", ondelete="SET NULL"), nullable=True)
    current_group_id = Column(Integer, ForeignKey("question_groups.id", ondelete="SET NULL"), nullable=True)
    is_completed = Column(Integer, default=False, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    flow = relationship("DocumentFlow", foreign_keys=[flow_id])
    current_group = relationship("QuestionGroup", foreign_keys=[current_group_id])
    answers = relationship("SessionAnswer", back_populates="session", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<DocumentSession(id={self.id}, client='{self.client_identifier}', completed={self.is_completed})>"
    
    def to_dict(self) -> dict:
        """Convert session to dictionary."""
        return {
            "id": self.id,
            "client_identifier": self.client_identifier,
            "user_id": self.user_id,
            "flow_id": self.flow_id,
            "current_group_id": self.current_group_id,
            "is_completed": bool(self.is_completed),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class SessionAnswer(Base, TimestampMixin):
    """Session answer model for storing client answers to questions."""
    
    __tablename__ = "session_answers"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("document_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    answer_value = Column(Text, nullable=False)
    
    # Relationships
    session = relationship("DocumentSession", back_populates="answers")
    question = relationship("Question")
    
    def __repr__(self) -> str:
        return f"<SessionAnswer(id={self.id}, session_id={self.session_id}, question_id={self.question_id})>"
    
    def to_dict(self) -> dict:
        """Convert answer to dictionary."""
        return {
            "id": self.id,
            "session_id": self.session_id,
            "question_id": self.question_id,
            "answer_value": self.answer_value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
