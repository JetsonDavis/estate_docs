#!/bin/bash
# Run backend with SQLite for E2E testing
# This provides faster database operations than remote PostgreSQL

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
SQLITE_DB="/tmp/estate_docs_test.db"

# Clean up existing test database
rm -f "$SQLITE_DB"

cd "$BACKEND_DIR"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Initialize database and create admin user
echo "Initializing SQLite test database..."
python -c "
import os
os.environ['DATABASE_URL'] = 'sqlite:///$SQLITE_DB'
os.environ['JWT_SECRET_KEY'] = 'test-secret-key-for-e2e-tests'

from src.database import Base, engine
from src.models import *

# Create all tables
Base.metadata.create_all(bind=engine)
print('Tables created')

# Create admin user
from sqlalchemy.orm import Session
from src.models.user import User
from src.utils.security import hash_password

with Session(engine) as session:
    existing = session.query(User).filter_by(username='admin').first()
    if not existing:
        admin = User(
            username='admin',
            email='admin@test.com',
            hashed_password=hash_password('password'),
            is_active=True,
            role='admin'
        )
        session.add(admin)
        session.commit()
        print('Admin user created')
    else:
        print('Admin user already exists')
"

PORT=${1:-8005}

echo "Starting backend on port $PORT with SQLite..."
DATABASE_URL="sqlite:///$SQLITE_DB" \
JWT_SECRET_KEY="test-secret-key-for-e2e-tests" \
python -m uvicorn src.main:app --reload --port $PORT
