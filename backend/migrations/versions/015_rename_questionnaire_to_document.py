"""rename questionnaire tables to document tables

Revision ID: 015
Revises: 014
Create Date: 2026-01-20

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '015'
down_revision = '014'
branch_labels = None
depends_on = None


def upgrade():
    # Rename questionnaire_flows to document_flows
    op.execute("ALTER TABLE questionnaire_flows RENAME TO document_flows")
    
    # Rename questionnaire_sessions to document_sessions
    op.execute("ALTER TABLE questionnaire_sessions RENAME TO document_sessions")
    
    # Update foreign key constraint on flow_question_groups to reference document_flows
    op.execute("""
        ALTER TABLE flow_question_groups 
        DROP CONSTRAINT IF EXISTS flow_question_groups_flow_id_fkey;
    """)
    op.execute("""
        ALTER TABLE flow_question_groups 
        ADD CONSTRAINT flow_question_groups_flow_id_fkey 
        FOREIGN KEY (flow_id) REFERENCES document_flows(id) ON DELETE CASCADE;
    """)
    
    # Update foreign key on document_sessions.flow_id if it exists
    op.execute("""
        ALTER TABLE document_sessions 
        DROP CONSTRAINT IF EXISTS questionnaire_sessions_flow_id_fkey;
    """)
    op.execute("""
        ALTER TABLE document_sessions 
        ADD CONSTRAINT document_sessions_flow_id_fkey 
        FOREIGN KEY (flow_id) REFERENCES document_flows(id) ON DELETE SET NULL;
    """)


def downgrade():
    # Rename back to questionnaire tables
    op.execute("ALTER TABLE document_flows RENAME TO questionnaire_flows")
    op.execute("ALTER TABLE document_sessions RENAME TO questionnaire_sessions")
    
    # Update foreign key constraints back
    op.execute("""
        ALTER TABLE flow_question_groups 
        DROP CONSTRAINT IF EXISTS flow_question_groups_flow_id_fkey;
    """)
    op.execute("""
        ALTER TABLE flow_question_groups 
        ADD CONSTRAINT flow_question_groups_flow_id_fkey 
        FOREIGN KEY (flow_id) REFERENCES questionnaire_flows(id) ON DELETE CASCADE;
    """)
    
    op.execute("""
        ALTER TABLE questionnaire_sessions 
        DROP CONSTRAINT IF EXISTS document_sessions_flow_id_fkey;
    """)
    op.execute("""
        ALTER TABLE questionnaire_sessions 
        ADD CONSTRAINT questionnaire_sessions_flow_id_fkey 
        FOREIGN KEY (flow_id) REFERENCES questionnaire_flows(id) ON DELETE SET NULL;
    """)
