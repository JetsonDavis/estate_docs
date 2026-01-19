"""create document flows tables

Revision ID: 006
Revises: 005
Create Date: 2026-01-18

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade():
    # Create document_flows table
    op.execute("""
        CREATE TABLE document_flows (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            description TEXT,
            starting_group_id INTEGER REFERENCES question_groups(id) ON DELETE SET NULL,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now()
        );
    """)
    
    op.create_index('ix_document_flows_id', 'document_flows', ['id'], unique=False)
    op.create_index('ix_document_flows_name', 'document_flows', ['name'], unique=True)
    
    # Create flow_question_groups association table
    op.execute("""
        CREATE TABLE flow_question_groups (
            flow_id INTEGER NOT NULL REFERENCES document_flows(id) ON DELETE CASCADE,
            question_group_id INTEGER NOT NULL REFERENCES question_groups(id) ON DELETE CASCADE,
            order_index INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (flow_id, question_group_id)
        );
    """)
    
    # Add flow_id to questionnaire_sessions
    op.execute("""
        ALTER TABLE questionnaire_sessions
        ADD COLUMN flow_id INTEGER REFERENCES document_flows(id) ON DELETE SET NULL;
    """)


def downgrade():
    # Remove flow_id from questionnaire_sessions
    op.execute('ALTER TABLE questionnaire_sessions DROP COLUMN flow_id')
    
    # Drop tables
    op.execute('DROP TABLE flow_question_groups')
    
    op.drop_index('ix_document_flows_name', table_name='document_flows')
    op.drop_index('ix_document_flows_id', table_name='document_flows')
    op.execute('DROP TABLE document_flows')
