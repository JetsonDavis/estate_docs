"""Change is_completed column from Integer to Boolean

Revision ID: 016
Revises: 015_rename_questionnaire_to_document
Create Date: 2026-01-20

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '016'
down_revision = '015'
branch_labels = None
depends_on = None


def upgrade():
    # Convert is_completed from Integer to Boolean
    # First, drop the default constraint
    op.execute("""
        ALTER TABLE document_sessions 
        ALTER COLUMN is_completed DROP DEFAULT
    """)
    
    # Then alter the column type using USING clause to cast existing values
    op.execute("""
        ALTER TABLE document_sessions 
        ALTER COLUMN is_completed TYPE BOOLEAN 
        USING CASE WHEN is_completed = 0 THEN FALSE ELSE TRUE END
    """)
    
    # Set the new default value
    op.execute("""
        ALTER TABLE document_sessions 
        ALTER COLUMN is_completed SET DEFAULT FALSE
    """)


def downgrade():
    # Convert is_completed from Boolean back to Integer
    # First, drop the default constraint
    op.execute("""
        ALTER TABLE document_sessions 
        ALTER COLUMN is_completed DROP DEFAULT
    """)
    
    # Then alter the column type
    op.execute("""
        ALTER TABLE document_sessions 
        ALTER COLUMN is_completed TYPE INTEGER 
        USING CASE WHEN is_completed THEN 1 ELSE 0 END
    """)
    
    # Set the default value
    op.execute("""
        ALTER TABLE document_sessions 
        ALTER COLUMN is_completed SET DEFAULT 0
    """)
