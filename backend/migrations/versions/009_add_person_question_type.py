"""add person question type

Revision ID: 009
Revises: 008
Create Date: 2026-01-19

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade():
    # Add 'person' to the QuestionType enum
    op.execute("ALTER TYPE questiontype ADD VALUE IF NOT EXISTS 'person'")
    
    # Add person_display_mode column to questions table
    op.add_column('questions', sa.Column('person_display_mode', sa.String(20), nullable=True))


def downgrade():
    # Remove person_display_mode column
    op.drop_column('questions', 'person_display_mode')
    
    # Note: PostgreSQL does not support removing enum values directly
    # If you need to remove the 'person' enum value, you would need to:
    # 1. Create a new enum without 'person'
    # 2. Alter the column to use the new enum
    # 3. Drop the old enum
    # This is complex and typically not done in practice
