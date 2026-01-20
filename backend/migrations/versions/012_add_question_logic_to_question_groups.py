"""Add question_logic column to question_groups

Revision ID: 012
Revises: 45d06c3d7248
Create Date: 2026-01-20

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '012'
down_revision = '011'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add question_logic JSON column to question_groups table
    op.add_column('question_groups', sa.Column('question_logic', sa.JSON(), nullable=True))


def downgrade() -> None:
    # Remove question_logic column
    op.drop_column('question_groups', 'question_logic')
