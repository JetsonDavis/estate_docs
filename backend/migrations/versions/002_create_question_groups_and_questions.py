"""Create question_groups and questions tables

Revision ID: 002
Revises: 001
Create Date: 2026-01-18 16:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON


# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create question_groups table
    op.create_table(
        'question_groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('identifier', sa.String(length=100), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_question_groups_id'), 'question_groups', ['id'], unique=False)
    op.create_index(op.f('ix_question_groups_identifier'), 'question_groups', ['identifier'], unique=True)
    
    # Create questions table
    op.create_table(
        'questions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('question_group_id', sa.Integer(), nullable=False),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('question_type', sa.Enum('multiple_choice', 'free_text', 'database_dropdown', name='questiontype'), nullable=False),
        sa.Column('identifier', sa.String(length=100), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_required', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('help_text', sa.Text(), nullable=True),
        sa.Column('options', JSON, nullable=True),
        sa.Column('database_table', sa.String(length=100), nullable=True),
        sa.Column('database_value_column', sa.String(length=100), nullable=True),
        sa.Column('database_label_column', sa.String(length=100), nullable=True),
        sa.Column('validation_rules', JSON, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.ForeignKeyConstraint(['question_group_id'], ['question_groups.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_questions_id'), 'questions', ['id'], unique=False)
    op.create_index(op.f('ix_questions_question_group_id'), 'questions', ['question_group_id'], unique=False)
    op.create_index(op.f('ix_questions_identifier'), 'questions', ['identifier'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_questions_identifier'), table_name='questions')
    op.drop_index(op.f('ix_questions_question_group_id'), table_name='questions')
    op.drop_index(op.f('ix_questions_id'), table_name='questions')
    op.drop_table('questions')
    
    op.drop_index(op.f('ix_question_groups_identifier'), table_name='question_groups')
    op.drop_index(op.f('ix_question_groups_id'), table_name='question_groups')
    op.drop_table('question_groups')
    
    op.execute('DROP TYPE questiontype')
