# Estate Doc(tor) - Backend

FastAPI backend for the Estate Doc(tor).

## Setup

1. Create virtual environment:
```bash
python3.13 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run database migrations:
```bash
alembic upgrade head
```

5. Start development server:
```bash
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test file
pytest tests/unit/test_auth_service.py
```

## Code Quality

```bash
# Type checking
mypy src/

# Linting
ruff check src/

# Formatting
ruff format src/
```

## API Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
