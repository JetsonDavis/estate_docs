"""create generated documents table

Revision ID: 005
Revises: 004
Create Date: 2026-01-18

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade():
    # Create generated_documents table
    op.execute("""
        CREATE TABLE generated_documents (
            id SERIAL PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES questionnaire_sessions(id) ON DELETE CASCADE,
            template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
            document_name VARCHAR(255) NOT NULL,
            markdown_content TEXT NOT NULL,
            pdf_content BYTEA,
            pdf_file_path VARCHAR(500),
            generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            generated_at TIMESTAMP NOT NULL DEFAULT now(),
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now()
        );
    """)
    
    op.create_index('ix_generated_documents_id', 'generated_documents', ['id'], unique=False)
    op.create_index('ix_generated_documents_session_id', 'generated_documents', ['session_id'], unique=False)


def downgrade():
    op.drop_index('ix_generated_documents_session_id', table_name='generated_documents')
    op.drop_index('ix_generated_documents_id', table_name='generated_documents')
    op.execute('DROP TABLE generated_documents')
