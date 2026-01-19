"""create templates table

Revision ID: 003
Revises: 002
Create Date: 2026-01-18

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade():
    # Create templatetype enum if it doesn't exist
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE templatetype AS ENUM ('word', 'pdf', 'image', 'direct');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # Create templates table using native PostgreSQL type
    op.execute("""
        CREATE TABLE templates (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            template_type templatetype NOT NULL,
            original_filename VARCHAR(255),
            original_file_path VARCHAR(500),
            markdown_content TEXT NOT NULL,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now(),
            is_active BOOLEAN NOT NULL DEFAULT true
        );
    """)
    
    op.create_index('ix_templates_id', 'templates', ['id'], unique=False)
    op.create_index('ix_templates_name', 'templates', ['name'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_templates_name'), table_name='templates')
    op.drop_index(op.f('ix_templates_id'), table_name='templates')
    op.drop_table('templates')
    op.execute('DROP TYPE templatetype')
