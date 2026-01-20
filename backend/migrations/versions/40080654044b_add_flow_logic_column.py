"""add_flow_logic_column

Revision ID: 40080654044b
Revises: 010
Create Date: 2026-01-19 16:51:35.747762

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '40080654044b'
down_revision = '010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add flow_logic JSON column to questionnaire_flows table
    op.add_column('questionnaire_flows', sa.Column('flow_logic', sa.JSON(), nullable=True))


def downgrade() -> None:
    # Remove flow_logic column
    op.drop_column('questionnaire_flows', 'flow_logic')
