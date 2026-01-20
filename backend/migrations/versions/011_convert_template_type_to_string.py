"""Convert template_type from enum to string

Revision ID: 011
Revises: 010_create_questionnaire_flows
Create Date: 2026-01-20

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '011'
down_revision = '45d06c3d7248'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add a temporary column
    op.add_column('templates', sa.Column('template_type_new', sa.String(50), nullable=True))
    
    # Copy data from old column to new column (enum values are already lowercase in the enum definition)
    op.execute("UPDATE templates SET template_type_new = template_type::text")
    
    # Drop the old column
    op.drop_column('templates', 'template_type')
    
    # Rename the new column to the original name
    op.alter_column('templates', 'template_type_new', new_column_name='template_type', nullable=False)
    
    # Drop the enum type
    op.execute("DROP TYPE IF EXISTS templatetype")


def downgrade() -> None:
    # Create the enum type
    op.execute("CREATE TYPE templatetype AS ENUM ('word', 'pdf', 'image', 'direct')")
    
    # Add a temporary column with the enum type
    op.add_column('templates', sa.Column('template_type_old', sa.Enum('word', 'pdf', 'image', 'direct', name='templatetype'), nullable=True))
    
    # Copy data from string column to enum column
    op.execute("UPDATE templates SET template_type_old = template_type::templatetype")
    
    # Drop the string column
    op.drop_column('templates', 'template_type')
    
    # Rename the enum column to the original name
    op.alter_column('templates', 'template_type_old', new_column_name='template_type', nullable=False)
