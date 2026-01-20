"""create questionnaire flows

Revision ID: 010
Revises: 009
Create Date: 2026-01-19

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade():
    # Create questionnaire_flows table
    op.create_table(
        'questionnaire_flows',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('starting_group_id', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['starting_group_id'], ['question_groups.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_questionnaire_flows_id'), 'questionnaire_flows', ['id'], unique=False)
    op.create_index(op.f('ix_questionnaire_flows_name'), 'questionnaire_flows', ['name'], unique=True)


def downgrade():
    # Drop questionnaire_flows table only (flow_question_groups existed before this migration)
    op.drop_index(op.f('ix_questionnaire_flows_name'), table_name='questionnaire_flows')
    op.drop_index(op.f('ix_questionnaire_flows_id'), table_name='questionnaire_flows')
    op.drop_table('questionnaire_flows')
