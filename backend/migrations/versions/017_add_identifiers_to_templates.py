"""add identifiers column to templates

Revision ID: 017
Revises: 016
Create Date: 2026-01-22

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '017'
down_revision = '016'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('templates', sa.Column('identifiers', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('templates', 'identifiers')
