"""remove question identifier unique constraint

Revision ID: 023
Revises: 022
Create Date: 2026-02-24 12:03:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '023'
down_revision = '022'
branch_labels = None
depends_on = None


def upgrade():
    # Remove unique constraint from questions.identifier if it exists
    # Use raw SQL to check if constraint exists first
    from sqlalchemy import text
    conn = op.get_bind()
    
    # Check if constraint exists
    result = conn.execute(text("""
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'questions' 
        AND constraint_type = 'UNIQUE' 
        AND constraint_name = 'questions_identifier_key'
    """))
    
    if result.fetchone():
        op.drop_constraint('questions_identifier_key', 'questions', type_='unique')


def downgrade():
    # Re-add unique constraint to questions.identifier
    op.create_unique_constraint('questions_identifier_key', 'questions', ['identifier'])
