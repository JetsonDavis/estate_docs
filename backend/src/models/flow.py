from sqlalchemy import Column, Integer, String, Text, ForeignKey, Table, JSON
from sqlalchemy.orm import relationship
from . import Base, TimestampMixin, SoftDeleteMixin


# Association table for many-to-many relationship between flows and question groups
flow_question_groups = Table(
    'flow_question_groups',
    Base.metadata,
    Column('flow_id', Integer, ForeignKey('document_flows.id', ondelete='CASCADE'), primary_key=True),
    Column('question_group_id', Integer, ForeignKey('question_groups.id', ondelete='CASCADE'), primary_key=True),
    Column('order_index', Integer, nullable=False, default=0)
)


class DocumentFlow(Base, TimestampMixin, SoftDeleteMixin):
    """Document flow model for managing multiple document workflows."""
    
    __tablename__ = "document_flows"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    
    # Flow logic stored as JSON (list of steps with groups and conditionals)
    flow_logic = Column(JSON, nullable=True)
    
    # Starting question group for this flow
    starting_group_id = Column(Integer, ForeignKey("question_groups.id", ondelete="SET NULL"), nullable=True)
    
    # Metadata
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Relationships
    starting_group = relationship("QuestionGroup", foreign_keys=[starting_group_id])
    question_groups = relationship(
        "QuestionGroup",
        secondary=flow_question_groups,
        backref="flows"
    )
    creator = relationship("User", foreign_keys=[created_by])
    
    def __repr__(self) -> str:
        return f"<DocumentFlow(id={self.id}, name='{self.name}')>"
    
    def to_dict(self) -> dict:
        """Convert flow to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "flow_logic": self.flow_logic,
            "starting_group_id": self.starting_group_id,
            "created_by": self.created_by,
            "is_active": bool(self.is_active),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
