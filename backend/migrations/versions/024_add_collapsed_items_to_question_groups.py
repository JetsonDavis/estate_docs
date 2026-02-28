"""Add collapsed_items column to question_groups

Revision ID: 024
Revises: 023
Create Date: 2026-02-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '024'
down_revision = '023'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('question_groups', sa.Column('collapsed_items', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('question_groups', 'collapsed_items')
