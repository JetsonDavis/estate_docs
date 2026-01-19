from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from . import Base, TimestampMixin, SoftDeleteMixin


class TemplateType(str, enum.Enum):
    """Template type enumeration."""
    WORD = "word"
    PDF = "pdf"
    IMAGE = "image"
    DIRECT = "direct"


class Template(Base, TimestampMixin, SoftDeleteMixin):
    """Template model for document templates."""
    
    __tablename__ = "templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    template_type = Column(Enum(TemplateType), nullable=False)
    
    # Original file information
    original_filename = Column(String(255), nullable=True)
    original_file_path = Column(String(500), nullable=True)
    
    # Markdown content with identifiers
    markdown_content = Column(Text, nullable=False)
    
    # Metadata
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    
    def __repr__(self) -> str:
        return f"<Template(id={self.id}, name='{self.name}', type='{self.template_type.value}')>"
    
    def to_dict(self) -> dict:
        """Convert template to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "template_type": self.template_type.value,
            "original_filename": self.original_filename,
            "original_file_path": self.original_file_path,
            "markdown_content": self.markdown_content,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "is_active": self.is_active,
        }
    
    def extract_identifiers(self) -> list[str]:
        """Extract all identifiers from markdown content (e.g., <<identifier>>)."""
        import re
        pattern = r'<<([^>]+)>>'
        matches = re.findall(pattern, self.markdown_content)
        return list(set(matches))  # Return unique identifiers
