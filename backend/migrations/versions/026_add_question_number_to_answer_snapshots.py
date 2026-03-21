"""Add question_number column to answer_snapshots

Revision ID: 026
Revises: 025
Create Date: 2026-03-21

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '026'
down_revision = '025'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('answer_snapshots', sa.Column('question_number', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('answer_snapshots', 'question_number')
