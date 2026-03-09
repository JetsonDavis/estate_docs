"""add refresh_tokens table

Revision ID: d7f2ed5ae7f6
Revises: 024
Create Date: 2026-03-09 16:01:13.248351

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd7f2ed5ae7f6'
down_revision = '024'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'refresh_tokens',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('token_jti', sa.String(length=255), nullable=False, unique=True, index=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('is_revoked', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('refresh_tokens')
