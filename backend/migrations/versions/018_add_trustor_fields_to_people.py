"""Add trustor fields to people table

Revision ID: 018
Revises: 017_add_identifiers_to_templates
Create Date: 2026-02-09
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '018'
down_revision = '017'
branch_labels = None
depends_on = None


def upgrade():
    # Add trustor-related fields to people table
    op.add_column('people', sa.Column('trustor_is_living', sa.Integer(), nullable=True, server_default='1'))
    op.add_column('people', sa.Column('trustor_death_certificate_received', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('people', sa.Column('trustor_of_sound_mind', sa.Integer(), nullable=True, server_default='1'))
    op.add_column('people', sa.Column('trustor_has_relinquished', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('people', sa.Column('trustor_relinquished_date', sa.Date(), nullable=True))
    op.add_column('people', sa.Column('trustor_reling_doc_received', sa.Integer(), nullable=True, server_default='0'))


def downgrade():
    op.drop_column('people', 'trustor_reling_doc_received')
    op.drop_column('people', 'trustor_relinquished_date')
    op.drop_column('people', 'trustor_has_relinquished')
    op.drop_column('people', 'trustor_of_sound_mind')
    op.drop_column('people', 'trustor_death_certificate_received')
    op.drop_column('people', 'trustor_is_living')
