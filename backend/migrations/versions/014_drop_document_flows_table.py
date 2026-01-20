"""drop document_flows table

Revision ID: 014
Revises: 013
Create Date: 2026-01-20

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '014'
down_revision = '013'
branch_labels = None
depends_on = None


def upgrade():
    # Drop document_flows table if it exists
    op.execute("DROP TABLE IF EXISTS document_flows CASCADE")


def downgrade():
    # We don't recreate the table since it was never used
    pass
