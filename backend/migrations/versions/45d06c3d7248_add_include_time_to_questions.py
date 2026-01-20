"""add_include_time_to_questions

Revision ID: 45d06c3d7248
Revises: a2a532ceedb6
Create Date: 2026-01-19 17:43:24.906495

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '45d06c3d7248'
down_revision = 'a2a532ceedb6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add include_time column to questions table
    op.add_column('questions', sa.Column('include_time', sa.Boolean(), nullable=True, server_default='false'))


def downgrade() -> None:
    # Remove include_time column
    op.drop_column('questions', 'include_time')
