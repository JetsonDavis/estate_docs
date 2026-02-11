"""Namespace question identifiers with group identifier

This migration updates all existing question identifiers to be namespaced
with their question group identifier (e.g., "field" becomes "group.field").
This allows the same identifier name to be used in different groups.

Revision ID: 021
Revises: 020_add_repeatable_to_questions
Create Date: 2026-02-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session


# revision identifiers, used by Alembic.
revision = '021'
down_revision = '020'
branch_labels = None
depends_on = None


def upgrade():
    # Get database connection
    bind = op.get_bind()
    session = Session(bind=bind)
    
    # Get all questions with their group identifiers
    result = session.execute(sa.text("""
        SELECT q.id, q.identifier, qg.identifier as group_identifier
        FROM questions q
        JOIN question_groups qg ON q.question_group_id = qg.id
    """))
    
    # Update each question's identifier to be namespaced
    for row in result:
        question_id = row[0]
        current_identifier = row[1]
        group_identifier = row[2]
        
        # Skip if already namespaced (contains a dot and starts with group identifier)
        if current_identifier.startswith(f"{group_identifier}."):
            continue
        
        # Build namespaced identifier
        namespaced_identifier = f"{group_identifier}.{current_identifier}"
        
        # Update the question
        session.execute(
            sa.text("UPDATE questions SET identifier = :new_id WHERE id = :qid"),
            {"new_id": namespaced_identifier, "qid": question_id}
        )
    
    session.commit()


def downgrade():
    # Get database connection
    bind = op.get_bind()
    session = Session(bind=bind)
    
    # Get all questions
    result = session.execute(sa.text("SELECT id, identifier FROM questions"))
    
    # Remove namespace prefix from each question's identifier
    for row in result:
        question_id = row[0]
        current_identifier = row[1]
        
        # Remove namespace prefix (everything before and including the first dot)
        if '.' in current_identifier:
            original_identifier = current_identifier.split('.', 1)[1]
            session.execute(
                sa.text("UPDATE questions SET identifier = :new_id WHERE id = :qid"),
                {"new_id": original_identifier, "qid": question_id}
            )
    
    session.commit()
