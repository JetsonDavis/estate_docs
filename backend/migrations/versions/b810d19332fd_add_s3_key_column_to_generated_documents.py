"""Add s3_key column to generated_documents

Revision ID: b810d19332fd
Revises: d7f2ed5ae7f6
Create Date: 2026-03-12 13:49:45.457419

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b810d19332fd'
down_revision = 'd7f2ed5ae7f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add s3_key column
    op.add_column('generated_documents', sa.Column('s3_key', sa.String(length=500), nullable=True))
    
    # Make markdown_content nullable (was NOT NULL before)
    op.alter_column('generated_documents', 'markdown_content',
                    existing_type=sa.Text(),
                    nullable=True)
    
    # After data migration is complete, you can make s3_key NOT NULL:
    # op.alter_column('generated_documents', 's3_key', nullable=False)


def downgrade() -> None:
    # Remove s3_key column
    op.drop_column('generated_documents', 's3_key')
    
    # Make markdown_content NOT NULL again
    op.alter_column('generated_documents', 'markdown_content',
                    existing_type=sa.Text(),
                    nullable=False)
