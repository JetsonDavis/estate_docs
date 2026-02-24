# Estate Doc(tor) - Setup Guide

Complete setup guide for the Estate Doc(tor).

## Prerequisites

- **Python 3.13+**
- **Node.js 18+**
- **PostgreSQL 15+**
- **Git**

## Initial Setup

### 1. Clone and Navigate

```bash
cd /Users/jeff/Documents/WWW2020/estate_docs
```

### 2. Database Setup

```bash
# Create databases
createdb estate_docs_dev
createdb estate_docs_test

# Verify databases exist
psql -l | grep estate_docs
```

### 3. Backend Setup

```bash
cd backend

# Create virtual environment
python3.13 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Configure environment
cp .env.example .env.local  # Optional: keep .env as is for dev

# Run database migrations
alembic upgrade head

# Verify setup
python -c "from src.config import settings; print(f'Environment: {settings.environment}')"
```

### 4. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Verify setup
npm run type-check
```

## Running the Application

### Start Backend (Terminal 1)

```bash
cd backend
source venv/bin/activate
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at:
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Start Frontend (Terminal 2)

```bash
cd frontend
npm run dev
```

Frontend will be available at: http://localhost:5173

## Creating the First Admin User

### Option 1: Using Python Script

```bash
cd backend
source venv/bin/activate
python -c "
from src.database import SessionLocal
from src.services.auth_service import AuthService
from src.schemas.auth import RegisterRequest

db = SessionLocal()
try:
    admin_data = RegisterRequest(
        username='admin',
        email='admin@example.com',
        password='Admin123!',
        full_name='System Administrator'
    )
    user = AuthService.register(db, admin_data)
    
    # Update to admin role
    from src.models.user import UserRole
    user.role = UserRole.ADMIN
    db.commit()
    print(f'Admin user created: {user.username}')
except Exception as e:
    print(f'Error: {e}')
finally:
    db.close()
"
```

### Option 2: Using API + Database Update

```bash
# 1. Register via API
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@example.com",
    "password": "Admin123!",
    "full_name": "System Administrator"
  }'

# 2. Update role in database
psql estate_docs_dev -c "UPDATE users SET role = 'admin' WHERE username = 'admin';"
```

## Testing

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
pytest tests/unit/test_auth_service.py::test_register_new_user

# Run integration tests only
pytest tests/integration/

# View coverage report
open htmlcov/index.html  # macOS
```

### Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Code Quality Checks

```bash
# Backend
cd backend
source venv/bin/activate
mypy src/                    # Type checking
ruff check src/              # Linting
ruff format src/ --check     # Format checking

# Frontend
cd frontend
npm run type-check           # TypeScript checking
npm run lint                 # ESLint
npm run format               # Prettier formatting
```

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

- Follow TDD: Write tests first
- Backend: Add models → schemas → services → routes → tests
- Frontend: Add types → services → components → pages → tests

### 3. Run Tests

```bash
# Backend
cd backend && pytest

# Frontend
cd frontend && npm test
```

### 4. Check Code Quality

```bash
# Backend
cd backend
mypy src/
ruff check src/

# Frontend
cd frontend
npm run check
```

### 5. Commit and Push

```bash
git add .
git commit -m "feat: your feature description"
git push origin feature/your-feature-name
```

## Common Issues and Solutions

### Issue: Database Connection Error

```bash
# Check PostgreSQL is running
pg_isready

# Check database exists
psql -l | grep estate_docs

# Recreate database if needed
dropdb estate_docs_dev
createdb estate_docs_dev
cd backend && alembic upgrade head
```

### Issue: Port Already in Use

```bash
# Find process using port 8000
lsof -ti:8000

# Kill process
kill -9 $(lsof -ti:8000)

# Or use different port
uvicorn src.main:app --reload --port 8001
```

### Issue: Module Import Errors

```bash
# Backend: Reinstall dependencies
cd backend
pip install -r requirements.txt --force-reinstall

# Frontend: Clear cache and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Issue: Migration Conflicts

```bash
cd backend
# Reset migrations (WARNING: This drops all data)
alembic downgrade base
alembic upgrade head
```

## Environment Variables

### Backend (.env)

```bash
# Required
DATABASE_URL=postgresql://localhost:5432/estate_docs_dev
JWT_SECRET_KEY=your-secret-key-here

# Optional (for full functionality)
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Frontend (.env)

```bash
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_ENVIRONMENT=development
```

## Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment instructions.

## Additional Resources

- [Backend README](./backend/README.md)
- [Frontend README](./frontend/README.md)
- [API Documentation](http://localhost:8000/docs)
- [Feature Specification](./specs/001-estate-doc-generator/spec.md)
- [Implementation Plan](./specs/001-estate-doc-generator/plan.md)
