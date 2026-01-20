from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, Boolean
from sqlalchemy.ext.declarative import declared_attr
from ..database import Base


class TimestampMixin:
    """Mixin to add created_at and updated_at timestamps to models."""
    
    @declared_attr
    def created_at(cls):
        return Column(DateTime, default=datetime.utcnow, nullable=False)
    
    @declared_attr
    def updated_at(cls):
        return Column(
            DateTime,
            default=datetime.utcnow,
            onupdate=datetime.utcnow,
            nullable=False
        )


class SoftDeleteMixin:
    """Mixin to add soft delete functionality to models."""
    
    @declared_attr
    def is_active(cls):
        return Column(Boolean, default=True, nullable=False)


class VersionMixin:
    """Mixin to add optimistic locking version control to models."""
    
    @declared_attr
    def version(cls):
        return Column(Integer, default=1, nullable=False)


# Import models to ensure they're registered with SQLAlchemy
from .user import User, PasswordResetToken  # noqa: E402, F401
from .question import QuestionGroup, Question  # noqa: E402, F401
from .template import Template  # noqa: E402, F401
from .session import DocumentSession, SessionAnswer  # noqa: E402, F401
from .document import GeneratedDocument  # noqa: E402, F401
from .flow import DocumentFlow  # noqa: E402, F401
from .person import Person, person_relationships  # noqa: E402, F401

__all__ = ["Base", "TimestampMixin", "SoftDeleteMixin", "VersionMixin", "User", "PasswordResetToken", "QuestionGroup", "Question", "Template", "DocumentSession", "SessionAnswer", "GeneratedDocument", "DocumentFlow", "Person", "person_relationships"]
