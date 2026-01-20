"""add_date_question_type

Revision ID: a2a532ceedb6
Revises: 40080654044b
Create Date: 2026-01-19 17:34:52.414131

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a2a532ceedb6'
down_revision = '40080654044b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'date' to the questiontype enum
    op.execute("ALTER TYPE questiontype ADD VALUE IF NOT EXISTS 'date'")


def downgrade() -> None:
    # Note: PostgreSQL doesn't support removing enum values directly
    # This would require recreating the enum type, which is complex
    # For now, we'll leave the enum value in place on downgrade
    pass
