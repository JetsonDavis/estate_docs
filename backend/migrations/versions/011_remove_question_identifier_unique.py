"""remove question identifier unique constraint

Revision ID: 011_remove_question_identifier_unique
Revises: 010_add_question_group_identifier_unique
Create Date: 2026-02-24 12:03:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '011_remove_question_identifier_unique'
down_revision = '010_add_question_group_identifier_unique'
branch_labels = None
depends_on = None


def upgrade():
    # Remove unique constraint from questions.identifier
    op.drop_constraint('questions_identifier_key', 'questions', type_='unique')


def downgrade():
    # Re-add unique constraint to questions.identifier
    op.create_unique_constraint('questions_identifier_key', 'questions', ['identifier'])
