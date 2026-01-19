"""create questionnaire sessions tables

Revision ID: 004
Revises: 003
Create Date: 2026-01-18

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade():
    # Create questionnaire_sessions table
    op.execute("""
        CREATE TABLE questionnaire_sessions (
            id SERIAL PRIMARY KEY,
            client_identifier VARCHAR(255) NOT NULL,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            current_group_id INTEGER REFERENCES question_groups(id) ON DELETE SET NULL,
            is_completed INTEGER NOT NULL DEFAULT 0,
            completed_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now()
        );
    """)
    
    op.create_index('ix_questionnaire_sessions_id', 'questionnaire_sessions', ['id'], unique=False)
    op.create_index('ix_questionnaire_sessions_client_identifier', 'questionnaire_sessions', ['client_identifier'], unique=False)
    
    # Create session_answers table
    op.execute("""
        CREATE TABLE session_answers (
            id SERIAL PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES questionnaire_sessions(id) ON DELETE CASCADE,
            question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
            answer_value TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now()
        );
    """)
    
    op.create_index('ix_session_answers_id', 'session_answers', ['id'], unique=False)
    op.create_index('ix_session_answers_session_id', 'session_answers', ['session_id'], unique=False)
    op.create_index('ix_session_answers_question_id', 'session_answers', ['question_id'], unique=False)


def downgrade():
    op.drop_index('ix_session_answers_question_id', table_name='session_answers')
    op.drop_index('ix_session_answers_session_id', table_name='session_answers')
    op.drop_index('ix_session_answers_id', table_name='session_answers')
    op.execute('DROP TABLE session_answers')
    
    op.drop_index('ix_questionnaire_sessions_client_identifier', table_name='questionnaire_sessions')
    op.drop_index('ix_questionnaire_sessions_id', table_name='questionnaire_sessions')
    op.execute('DROP TABLE questionnaire_sessions')
