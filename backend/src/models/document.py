from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, LargeBinary
from sqlalchemy.orm import relationship
from datetime import datetime
from . import Base, TimestampMixin


class GeneratedDocument(Base, TimestampMixin):
    """Generated document model for storing merged documents."""
    
    __tablename__ = "generated_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("questionnaire_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    template_id = Column(Integer, ForeignKey("templates.id", ondelete="SET NULL"), nullable=True)
    document_name = Column(String(255), nullable=False)
    
    # Merged content
    markdown_content = Column(Text, nullable=False)
    
    # PDF storage (optional - can be generated on demand)
    pdf_content = Column(LargeBinary, nullable=True)
    pdf_file_path = Column(String(500), nullable=True)
    
    # Metadata
    generated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    generated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Relationships
    session = relationship("QuestionnaireSession")
    template = relationship("Template")
    generator = relationship("User", foreign_keys=[generated_by])
    
    def __repr__(self) -> str:
        return f"<GeneratedDocument(id={self.id}, name='{self.document_name}')>"
    
    def to_dict(self) -> dict:
        """Convert document to dictionary."""
        return {
            "id": self.id,
            "session_id": self.session_id,
            "template_id": self.template_id,
            "document_name": self.document_name,
            "markdown_content": self.markdown_content,
            "pdf_file_path": self.pdf_file_path,
            "generated_by": self.generated_by,
            "generated_at": self.generated_at.isoformat(),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
