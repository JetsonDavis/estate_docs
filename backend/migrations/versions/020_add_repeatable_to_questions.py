"""Add repeatable field to questions table

Revision ID: 020
Revises: 019
Create Date: 2026-02-09
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '020'
down_revision = '019'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('questions', sa.Column('repeatable', sa.Boolean(), nullable=False, server_default='false'))


def downgrade():
    op.drop_column('questions', 'repeatable')
