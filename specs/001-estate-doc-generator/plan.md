# Implementation Plan: Document Merge System

**Branch**: `001-estate-doc-generator` | **Date**: 2026-01-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-estate-doc-generator/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

The Document Merge System is a two-mode application (admin and client) that enables dynamic questionnaire creation with conditional flow logic and document generation through template merging. Administrators create question groups with multiple question types (multiple choice, free form, database-populated dropdowns), define conditional navigation rules, design multiple document flows, and create templates with parameter placeholders using `<<identifier>>` syntax. Templates can be created by uploading Word/PDF/images (OCR via AWS Textract) or direct text entry, stored as Markdown. Clients complete questionnaires following conditional flows, with answers stored per client and question identifier. The system merges client answers into templates to generate PDF documents using ReportLab. Authentication uses JWT tokens with httpOnly cookies, supporting user management with forgot password functionality. Files are stored on EC2 instance file system with regular backups.

## Technical Context

**Language/Version**: Python 3.13 (backend), TypeScript/React 18+ (frontend)  
**Primary Dependencies**: 
- Backend: FastAPI, SQLAlchemy, Pydantic, python-docx, PyPDF2/pdfplumber, ReportLab, boto3 (AWS Textract), PyJWT, passlib, python-multipart
- Frontend: React 18+, TypeScript, React Hook Form, React Query, Axios, React Router

**Storage**: PostgreSQL 15 (AWS RDS production, local dev), EC2 file system for documents  
**Testing**: pytest + pytest-asyncio (backend), Jest + React Testing Library (frontend)  
**Target Platform**: AWS EC2 (Linux server), modern web browsers (Chrome, Firefox, Safari, Edge)  
**Project Type**: Web application (separate backend API + frontend SPA)  
**Performance Goals**: 
- API response time <200ms p95 for CRUD operations
- Document merge <10 seconds for templates with 50 identifiers
- OCR processing <3 minutes for 2-page documents
- Support 20+ concurrent client questionnaire sessions
- Conditional flow navigation <1 second

**Constraints**: 
- File upload limit: 10MB per document
- Session timeout: 30 minutes inactivity
- Auto-save interval: 30 seconds
- Password complexity: min 8 chars, mixed case, numbers, special chars
- JWT token expiration: 1 hour (with refresh)

**Scale/Scope**: 
- Initial deployment: 50-100 concurrent users
- Database: ~10 tables with referential integrity
- Frontend: ~15-20 pages/components
- Backend: ~25-30 API endpoints
- Expected data: 1000s of clients, 100s of question groups, 10s of document flows

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Core Principles Compliance

✅ **I. Clean and Modular Code**
- Backend: Layered architecture (API → Services → Models)
- Frontend: Component-based architecture with clear separation
- Single-responsibility modules for auth, questionnaire, templates, merge
- Clear interfaces between layers

✅ **II. Type Safety and Validation**
- Python 3.13 type hints on all functions
- TypeScript strict mode enabled
- Pydantic models for request/response validation
- PostgreSQL schema constraints (foreign keys, unique, check)
- Runtime validation on all user inputs

✅ **III. Test-First Development**
- TDD approach: write tests before implementation
- Unit tests for all business logic (auth, flow logic, merge)
- Integration tests for API endpoints and database operations
- Frontend component tests with React Testing Library
- E2E tests for critical paths (login, questionnaire flow, document generation)

✅ **IV. Database-First Data Modeling**
- PostgreSQL schema with proper constraints
- Normalized to 3NF (users, flows, question_groups, questions, flow_rules, answers, etc.)
- Foreign key relationships enforced
- Migrations using Alembic
- Indexes on frequently queried columns (client_id, question_identifier, flow_id)

✅ **V. API-First Architecture**
- RESTful API design with OpenAPI/Swagger documentation
- Versioned endpoints (/api/v1/)
- Consistent error responses with proper HTTP status codes
- JWT-based authentication with httpOnly cookies
- Clear request/response schemas using Pydantic

### Technology Stack Compliance

✅ **Required Versions Met**:
- Python 3.13 ✓
- FastAPI ✓
- React 18+ with TypeScript ✓
- PostgreSQL 15 ✓
- pytest (backend) ✓
- Jest + React Testing Library (frontend) ✓
- AWS EC2 deployment ✓

✅ **Code Quality Standards**:
- Linting: ruff (Python), ESLint (TypeScript)
- Formatting: ruff (Python), Prettier (TypeScript)
- Type checking: mypy (Python), tsc --strict (TypeScript)
- Security: No secrets in code, password hashing with passlib
- Performance: Query optimization, avoid N+1 with SQLAlchemy eager loading

✅ **Project Structure**:
- `backend/src/` for backend source
- `backend/tests/` for backend tests
- `frontend/src/` for frontend source
- `frontend/tests/` for frontend tests
- `backend/migrations/` for Alembic migrations
- `specs/001-estate-doc-generator/` for documentation

### Gate Status: ✅ PASS

No constitution violations. All principles and standards are met.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
backend/
├── src/
│   ├── main.py                    # FastAPI app entry point
│   ├── config.py                  # Configuration and environment variables
│   ├── database.py                # Database connection and session management
│   ├── models/                    # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── question.py
│   │   ├── flow.py
│   │   ├── template.py
│   │   ├── client.py
│   │   ├── session.py
│   │   └── answer.py
│   ├── schemas/                   # Pydantic request/response schemas
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── question.py
│   │   ├── flow.py
│   │   ├── template.py
│   │   └── merge.py
│   ├── api/                       # API route handlers
│   │   ├── __init__.py
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py           # Login, logout, password reset
│   │   │   ├── users.py          # User management (admin)
│   │   │   ├── questions.py      # Question group CRUD
│   │   │   ├── flows.py          # Document flow management
│   │   │   ├── templates.py      # Template CRUD and upload
│   │   │   ├── sessions.py       # Client questionnaire sessions
│   │   │   └── merge.py          # Document merge and PDF generation
│   ├── services/                  # Business logic layer
│   │   ├── __init__.py
│   │   ├── auth_service.py       # Authentication and JWT handling
│   │   ├── user_service.py       # User management logic
│   │   ├── question_service.py   # Question group logic
│   │   ├── flow_service.py       # Flow navigation and validation
│   │   ├── template_service.py   # Template processing and OCR
│   │   ├── session_service.py    # Session management and auto-save
│   │   └── merge_service.py      # Document merge and PDF generation
│   ├── utils/                     # Utility functions
│   │   ├── __init__.py
│   │   ├── security.py           # Password hashing, token generation
│   │   ├── email.py              # Email sending for password reset
│   │   ├── file_storage.py       # EC2 file system operations
│   │   ├── ocr.py                # AWS Textract integration
│   │   ├── document_converter.py # Word/PDF to Markdown
│   │   └── pdf_generator.py      # ReportLab PDF generation
│   └── middleware/                # Custom middleware
│       ├── __init__.py
│       └── auth_middleware.py    # JWT validation middleware
├── tests/
│   ├── __init__.py
│   ├── conftest.py               # Pytest fixtures
│   ├── unit/                     # Unit tests
│   │   ├── test_auth_service.py
│   │   ├── test_flow_service.py
│   │   ├── test_merge_service.py
│   │   └── ...
│   ├── integration/              # Integration tests
│   │   ├── test_api_auth.py
│   │   ├── test_api_questions.py
│   │   ├── test_api_flows.py
│   │   └── ...
│   └── e2e/                      # End-to-end tests
│       ├── test_questionnaire_flow.py
│       └── test_document_generation.py
├── migrations/                    # Alembic database migrations
│   ├── versions/
│   ├── env.py
│   └── alembic.ini
├── requirements.txt              # Python dependencies
├── requirements-dev.txt          # Development dependencies
├── pytest.ini                    # Pytest configuration
├── mypy.ini                      # Mypy configuration
└── ruff.toml                     # Ruff linting/formatting config

frontend/
├── src/
│   ├── main.tsx                  # React app entry point
│   ├── App.tsx                   # Root component with routing
│   ├── components/               # Reusable components
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── ForgotPasswordForm.tsx
│   │   │   └── PasswordResetForm.tsx
│   │   ├── admin/
│   │   │   ├── UserManagement.tsx
│   │   │   ├── QuestionGroupEditor.tsx
│   │   │   ├── FlowDesigner.tsx
│   │   │   └── TemplateEditor.tsx
│   │   ├── client/
│   │   │   ├── QuestionnaireView.tsx
│   │   │   ├── QuestionGroup.tsx
│   │   │   ├── QuestionRenderer.tsx
│   │   │   └── FlowSelector.tsx
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Dropdown.tsx
│   │   │   └── FileUpload.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── Layout.tsx
│   ├── pages/                    # Page components
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── admin/
│   │   │   ├── UsersPage.tsx
│   │   │   ├── QuestionsPage.tsx
│   │   │   ├── FlowsPage.tsx
│   │   │   └── TemplatesPage.tsx
│   │   └── client/
│   │       ├── QuestionnairePage.tsx
│   │       └── MergePage.tsx
│   ├── services/                 # API client services
│   │   ├── api.ts               # Axios instance with interceptors
│   │   ├── authService.ts
│   │   ├── userService.ts
│   │   ├── questionService.ts
│   │   ├── flowService.ts
│   │   ├── templateService.ts
│   │   └── mergeService.ts
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useQuestions.ts
│   │   ├── useFlows.ts
│   │   └── useAutoSave.ts
│   ├── types/                    # TypeScript type definitions
│   │   ├── auth.ts
│   │   ├── user.ts
│   │   ├── question.ts
│   │   ├── flow.ts
│   │   └── template.ts
│   ├── utils/                    # Utility functions
│   │   ├── validation.ts
│   │   └── formatting.ts
│   └── styles/                   # Global styles
│       └── globals.css
├── tests/
│   ├── components/               # Component tests
│   │   ├── LoginForm.test.tsx
│   │   ├── QuestionGroupEditor.test.tsx
│   │   └── ...
│   └── integration/              # Integration tests
│       └── questionnaire-flow.test.tsx
├── public/                       # Static assets
├── package.json
├── tsconfig.json                 # TypeScript configuration
├── vite.config.ts                # Vite build configuration
├── eslint.config.js              # ESLint configuration
└── .prettierrc                   # Prettier configuration
```

**Structure Decision**: Web application architecture with separate backend API and frontend SPA. Backend uses layered architecture (API → Services → Models) with clear separation of concerns. Frontend uses component-based architecture with pages, reusable components, and service layer for API communication. This structure supports parallel development, clear testing boundaries, and aligns with FastAPI + React best practices.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
