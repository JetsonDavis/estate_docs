# Estate Doc(tor)

A two-mode application for estate document generation with dynamic questionnaire workflows and conditional flow logic.

## Overview

The Estate Doc(tor) enables:
- **Admin Mode**: Create question groups with conditional flow logic, manage document templates, and design multiple document flows
- **Client Mode**: Complete questionnaires with dynamic navigation, generate merged PDF documents

## Architecture

- **Backend**: Python 3.13 + FastAPI + PostgreSQL 15
- **Frontend**: React 18 + TypeScript + Vite
- **Authentication**: JWT with httpOnly cookies
- **Document Processing**: AWS Textract (OCR), ReportLab (PDF generation)
- **Storage**: PostgreSQL (data), EC2 file system (documents)

## Quick Start

### Prerequisites

- Python 3.13+
- Node.js 18+
- PostgreSQL 15+
- AWS Account (for Textract OCR)

### Backend Setup

```bash
cd backend

# Create virtual environment
python3.13 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Setup database
createdb estate_docs_dev
createdb estate_docs_test

# Run migrations
alembic upgrade head

# Start server
uvicorn src.main:app --reload
```

Backend will be available at http://localhost:8000

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will be available at http://localhost:5173

## Documentation

- [Backend README](./backend/README.md)
- [Frontend README](./frontend/README.md)
- [Feature Specification](./specs/001-estate-doc-generator/spec.md)
- [Implementation Plan](./specs/001-estate-doc-generator/plan.md)
- [Data Model](./specs/001-estate-doc-generator/data-model.md)
- [API Contracts](./specs/001-estate-doc-generator/contracts/openapi.yaml)
- [Quickstart Guide](./specs/001-estate-doc-generator/quickstart.md)

## Project Structure

```
estate_docs/
├── backend/              # FastAPI backend
│   ├── src/             # Source code
│   ├── tests/           # Tests
│   └── migrations/      # Database migrations
├── frontend/            # React frontend
│   ├── src/            # Source code
│   └── tests/          # Tests
└── specs/              # Feature specifications
    └── 001-estate-doc-generator/
        ├── spec.md
        ├── plan.md
        ├── data-model.md
        ├── tasks.md
        └── contracts/
```

## Development Workflow

1. **Backend**: Follow TDD - write tests first, then implement
2. **Frontend**: Component-based development with TypeScript
3. **Database**: Use Alembic for all schema changes
4. **API**: Follow OpenAPI specification in contracts/

## Testing

### Backend
```bash
cd backend
pytest --cov=src --cov-report=html
```

### Frontend
```bash
cd frontend
npm test
```

## Deployment

See [Quickstart Guide](./specs/001-estate-doc-generator/quickstart.md) for deployment instructions.

## License

Proprietary - All rights reserved
