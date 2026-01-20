"""create people and person_relationships tables

Revision ID: 007
Revises: 006
Create Date: 2026-01-19

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade():
    # Create people table
    op.execute("""
        CREATE TABLE people (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            phone_number VARCHAR(20),
            date_of_birth DATE,
            ssn_encrypted VARCHAR(255),
            email VARCHAR(255),
            employer VARCHAR(255),
            occupation VARCHAR(255),
            mailing_address VARCHAR(500),
            physical_address VARCHAR(500),
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now(),
            is_active INTEGER NOT NULL DEFAULT 1
        );
    """)
    
    op.create_index('ix_people_id', 'people', ['id'], unique=False)
    op.create_index('ix_people_name', 'people', ['name'], unique=False)
    op.create_index('ix_people_email', 'people', ['email'], unique=False)
    
    # Create person_relationships table
    op.execute("""
        CREATE TABLE person_relationships (
            person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
            related_person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
            relationship_type VARCHAR(100),
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now(),
            PRIMARY KEY (person_id, related_person_id)
        );
    """)


def downgrade():
    # Drop tables
    op.execute('DROP TABLE person_relationships')
    
    op.drop_index('ix_people_email', table_name='people')
    op.drop_index('ix_people_name', table_name='people')
    op.drop_index('ix_people_id', table_name='people')
    op.execute('DROP TABLE people')
