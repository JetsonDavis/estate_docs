"""Create answer_snapshots table for persistence verification

Revision ID: 025
Revises: 024
Create Date: 2026-03-21

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '025'
down_revision = 'b810d19332fd'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE answer_snapshots (
            id SERIAL PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES document_sessions(id) ON DELETE CASCADE,
            question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
            answer_value TEXT NOT NULL,
            saved_at TIMESTAMP NOT NULL DEFAULT now()
        );
    """)

    op.create_index('ix_answer_snapshots_id', 'answer_snapshots', ['id'], unique=False)
    op.create_index('ix_answer_snapshots_session_id', 'answer_snapshots', ['session_id'], unique=False)
    op.create_index('ix_answer_snapshots_question_id', 'answer_snapshots', ['question_id'], unique=False)
    op.create_index(
        'ix_answer_snapshots_session_question',
        'answer_snapshots',
        ['session_id', 'question_id'],
        unique=True
    )


def downgrade() -> None:
    op.drop_index('ix_answer_snapshots_session_question', table_name='answer_snapshots')
    op.drop_index('ix_answer_snapshots_question_id', table_name='answer_snapshots')
    op.drop_index('ix_answer_snapshots_session_id', table_name='answer_snapshots')
    op.drop_index('ix_answer_snapshots_id', table_name='answer_snapshots')
    op.execute('DROP TABLE answer_snapshots')
