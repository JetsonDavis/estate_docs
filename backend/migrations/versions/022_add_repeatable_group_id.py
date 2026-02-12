"""Add repeatable_group_id to questions

Revision ID: 022
Revises: 021
Create Date: 2026-02-11
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '022'
down_revision = '021'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('questions', sa.Column('repeatable_group_id', sa.String(100), nullable=True))


def downgrade():
    op.drop_column('questions', 'repeatable_group_id')
