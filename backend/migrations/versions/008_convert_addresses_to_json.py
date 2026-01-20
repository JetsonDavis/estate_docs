"""convert address fields to JSON

Revision ID: 008
Revises: 007
Create Date: 2026-01-19

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON


# revision identifiers, used by Alembic.
revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade():
    # Change mailing_address and physical_address from VARCHAR to JSON
    op.execute("""
        ALTER TABLE people 
        ALTER COLUMN mailing_address TYPE JSON USING 
        CASE 
            WHEN mailing_address IS NULL THEN NULL
            ELSE mailing_address::JSON
        END
    """)
    
    op.execute("""
        ALTER TABLE people 
        ALTER COLUMN physical_address TYPE JSON USING 
        CASE 
            WHEN physical_address IS NULL THEN NULL
            ELSE physical_address::JSON
        END
    """)


def downgrade():
    # Convert JSON back to VARCHAR
    op.execute("""
        ALTER TABLE people 
        ALTER COLUMN mailing_address TYPE VARCHAR(500) USING 
        CASE 
            WHEN mailing_address IS NULL THEN NULL
            ELSE mailing_address::TEXT
        END
    """)
    
    op.execute("""
        ALTER TABLE people 
        ALTER COLUMN physical_address TYPE VARCHAR(500) USING 
        CASE 
            WHEN physical_address IS NULL THEN NULL
            ELSE physical_address::TEXT
        END
    """)
