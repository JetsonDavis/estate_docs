"""fix flow_question_groups foreign key

Revision ID: 013
Revises: 012
Create Date: 2026-01-20

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '013'
down_revision = '012'
branch_labels = None
depends_on = None


def upgrade():
    # Drop the existing foreign key constraint if it exists
    op.execute("""
        ALTER TABLE flow_question_groups 
        DROP CONSTRAINT IF EXISTS flow_question_groups_flow_id_fkey;
    """)
    
    # Add the correct foreign key constraint to questionnaire_flows
    op.execute("""
        ALTER TABLE flow_question_groups 
        ADD CONSTRAINT flow_question_groups_flow_id_fkey 
        FOREIGN KEY (flow_id) REFERENCES questionnaire_flows(id) ON DELETE CASCADE;
    """)


def downgrade():
    # Revert to original (though we don't know what it was pointing to)
    op.execute("""
        ALTER TABLE flow_question_groups 
        DROP CONSTRAINT IF EXISTS flow_question_groups_flow_id_fkey;
    """)
