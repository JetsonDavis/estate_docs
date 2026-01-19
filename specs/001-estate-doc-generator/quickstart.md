# Quickstart Guide: Document Merge System

**Feature**: Document Merge System  
**Date**: 2026-01-18  
**Audience**: Developers

## Overview

This guide provides step-by-step instructions to set up the development environment, run the application locally, and execute tests for the Document Merge System.

## Prerequisites

- **Python**: 3.13+
- **Node.js**: 18+ with npm
- **PostgreSQL**: 15+
- **Git**: Latest version
- **AWS Account**: For Textract (optional for local dev, can mock)

## Project Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd estate_docs
git checkout 001-estate-doc-generator
```

### 2. Backend Setup

#### Install Python Dependencies

```bash
cd backend

# Create virtual environment
python3.13 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

#### Configure Environment Variables

Create `.env` file in `backend/` directory:

```env
# Database
DATABASE_URL=postgresql://localhost:5432/estate_docs_dev
TEST_DATABASE_URL=postgresql://localhost:5432/estate_docs_test

# JWT
JWT_SECRET_KEY=your-secret-key-change-in-production
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# AWS (optional for local dev)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1

# Email (for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@example.com

# File Storage
UPLOAD_DIR=/var/app/storage/uploads
GENERATED_DIR=/var/app/storage/generated
MAX_UPLOAD_SIZE_MB=10

# Environment
ENVIRONMENT=development
DEBUG=true
```

#### Setup Database

```bash
# Create databases
createdb estate_docs_dev
createdb estate_docs_test

# Run migrations
alembic upgrade head

# (Optional) Seed initial data
python scripts/seed_data.py
```

#### Run Backend Server

```bash
# Development server with auto-reload
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Server will be available at http://localhost:8000
# API docs at http://localhost:8000/docs
```

### 3. Frontend Setup

#### Install Node Dependencies

```bash
cd frontend

# Install dependencies
npm install
```

#### Configure Environment Variables

Create `.env` file in `frontend/` directory:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_ENVIRONMENT=development
```

#### Run Frontend Dev Server

```bash
# Development server with hot reload
npm run dev

# Server will be available at http://localhost:5173
```

## Running Tests

### Backend Tests

```bash
cd backend
source venv/bin/activate

# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test file
pytest tests/unit/test_auth_service.py

# Run specific test
pytest tests/unit/test_auth_service.py::test_login_success

# Run integration tests only
pytest tests/integration/

# Run with verbose output
pytest -v
```

### Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm test -- LoginForm.test.tsx
```

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

Follow TDD approach:
1. Write test first
2. Run test (should fail)
3. Implement feature
4. Run test (should pass)
5. Refactor if needed

### 3. Run Quality Checks

#### Backend

```bash
cd backend

# Type checking
mypy src/

# Linting
ruff check src/

# Formatting
ruff format src/

# Run all checks
./scripts/check_quality.sh
```

#### Frontend

```bash
cd frontend

# Type checking
npm run type-check

# Linting
npm run lint

# Formatting
npm run format

# Run all checks
npm run check
```

### 4. Commit Changes

```bash
git add .
git commit -m "feat: add user authentication"
```

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
# Create pull request on GitHub
```

## Common Development Tasks

### Create Database Migration

```bash
cd backend

# Auto-generate migration from model changes
alembic revision --autogenerate -m "add user table"

# Create empty migration
alembic revision -m "custom migration"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# View migration history
alembic history
```

### Add New API Endpoint

1. Define Pydantic schema in `backend/src/schemas/`
2. Add route handler in `backend/src/api/v1/`
3. Implement business logic in `backend/src/services/`
4. Write tests in `backend/tests/`
5. Update OpenAPI spec in `specs/001-estate-doc-generator/contracts/openapi.yaml`

### Add New React Component

1. Create component in `frontend/src/components/`
2. Add TypeScript types in `frontend/src/types/`
3. Write component tests in `frontend/tests/components/`
4. Use component in page

### Debug Backend

```bash
# Run with debugger
python -m debugpy --listen 5678 --wait-for-client -m uvicorn src.main:app --reload

# Or use VS Code launch configuration
# Press F5 in VS Code with Python debugger configured
```

### Debug Frontend

```bash
# Use browser DevTools
# React DevTools extension recommended
# Set breakpoints in browser or VS Code
```

## API Documentation

### Swagger UI

Visit http://localhost:8000/docs for interactive API documentation.

### ReDoc

Visit http://localhost:8000/redoc for alternative API documentation.

### OpenAPI Spec

View raw OpenAPI spec at `specs/001-estate-doc-generator/contracts/openapi.yaml`

## Database Access

### Using psql

```bash
# Connect to dev database
psql estate_docs_dev

# Common queries
\dt                          # List tables
\d users                     # Describe users table
SELECT * FROM users;         # Query users
```

### Using Database GUI

Recommended tools:
- **pgAdmin**: Full-featured PostgreSQL GUI
- **DBeaver**: Universal database tool
- **TablePlus**: Modern database GUI

Connection details:
- Host: localhost
- Port: 5432
- Database: estate_docs_dev
- User: your-postgres-user
- Password: your-postgres-password

## Troubleshooting

### Backend Issues

**Database connection error**
```bash
# Check PostgreSQL is running
pg_isready

# Restart PostgreSQL
brew services restart postgresql@15  # macOS
sudo systemctl restart postgresql    # Linux
```

**Import errors**
```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

**Migration errors**
```bash
# Reset database (WARNING: deletes all data)
alembic downgrade base
alembic upgrade head

# Or drop and recreate
dropdb estate_docs_dev
createdb estate_docs_dev
alembic upgrade head
```

### Frontend Issues

**Module not found**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Port already in use**
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9

# Or use different port
npm run dev -- --port 3000
```

**Type errors**
```bash
# Regenerate types
npm run type-check

# Clear TypeScript cache
rm -rf node_modules/.cache
```

## Environment-Specific Notes

### Local Development

- Use SQLite for quick prototyping (optional)
- Mock AWS Textract calls to avoid API costs
- Use MailHog for email testing (no real emails sent)

### Staging

- Use AWS RDS PostgreSQL
- Enable AWS Textract integration
- Use real SMTP for emails
- Enable CloudWatch logging

### Production

- Use AWS RDS with automated backups
- Enable all AWS services (Textract, S3)
- Use production SMTP service
- Enable comprehensive monitoring
- Use environment-specific secrets

## Useful Commands

### Backend

```bash
# Start server
uvicorn src.main:app --reload

# Run tests
pytest

# Generate coverage report
pytest --cov=src --cov-report=html

# Type check
mypy src/

# Lint
ruff check src/

# Format
ruff format src/

# Create migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head
```

### Frontend

```bash
# Start dev server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Preview production build
npm run preview

# Type check
npm run type-check

# Lint
npm run lint

# Format
npm run format
```

## Next Steps

1. **Read the specification**: `specs/001-estate-doc-generator/spec.md`
2. **Review data model**: `specs/001-estate-doc-generator/data-model.md`
3. **Explore API contracts**: `specs/001-estate-doc-generator/contracts/openapi.yaml`
4. **Check research notes**: `specs/001-estate-doc-generator/research.md`
5. **Review implementation plan**: `specs/001-estate-doc-generator/plan.md`

## Support

For questions or issues:
- Check documentation in `specs/001-estate-doc-generator/`
- Review constitution: `.specify/memory/constitution.md`
- Create GitHub issue
- Contact team lead

## Resources

- **FastAPI Documentation**: https://fastapi.tiangolo.com/
- **React Documentation**: https://react.dev/
- **SQLAlchemy Documentation**: https://docs.sqlalchemy.org/
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **Alembic Documentation**: https://alembic.sqlalchemy.org/
- **Pydantic Documentation**: https://docs.pydantic.dev/
- **TypeScript Documentation**: https://www.typescriptlang.org/docs/
