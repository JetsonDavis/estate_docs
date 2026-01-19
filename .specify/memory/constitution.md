<!--
Sync Impact Report:
- Version: 0.0.0 → 1.0.0 (initial constitution)
- Modified principles: N/A (initial version)
- Added sections: Core Principles (5), Technical Standards, Development Workflow, Governance
- Removed sections: N/A
- Templates requiring updates:
  ✅ plan-template.md (Constitution Check section aligns with principles)
  ✅ spec-template.md (requirements align with functional/testable approach)
  ✅ tasks-template.md (task organization supports modular development)
- Follow-up TODOs: None
-->

# Estate Planning Document Generator Constitution

## Core Principles

### I. Clean and Modular Code (NON-NEGOTIABLE)

**All code MUST be clean, modular, and maintainable.**

- **Modularity**: Code MUST be organized into small, single-responsibility modules with clear interfaces
- **Separation of Concerns**: Business logic, data access, and presentation MUST be separated into distinct layers
- **DRY Principle**: Code duplication MUST be eliminated through proper abstraction
- **Naming**: Variables, functions, and classes MUST have descriptive, self-documenting names
- **Function Size**: Functions SHOULD be small (typically <50 lines) and do one thing well
- **Dependencies**: Module dependencies MUST be explicit, minimal, and unidirectional where possible

**Rationale**: Clean, modular code reduces bugs, accelerates development, simplifies testing, and enables team scalability. This is the foundation of all other principles.

### II. Type Safety and Validation

**Type hints and validation MUST be used throughout the codebase.**

- **Python**: All functions MUST include type hints for parameters and return values (Python 3.13+ syntax)
- **TypeScript/React**: Strict mode MUST be enabled; all components and functions MUST be typed
- **Database**: Schema constraints MUST enforce data integrity at the database level
- **Runtime Validation**: User inputs and external data MUST be validated before processing
- **API Contracts**: All API endpoints MUST have explicit request/response schemas

**Rationale**: Type safety catches errors at development time, serves as living documentation, and enables better IDE support and refactoring.

### III. Test-First Development (NON-NEGOTIABLE)

**Tests MUST be written before implementation for all new features.**

- **Test-Driven Development**: Write test → Verify it fails → Implement → Verify it passes
- **Coverage**: All business logic MUST have unit tests; critical paths MUST have integration tests
- **Test Independence**: Tests MUST be isolated and runnable in any order
- **Test Clarity**: Test names MUST clearly describe what is being tested and expected behavior
- **No Test Deletion**: Existing tests MUST NOT be deleted or weakened without explicit justification

**Rationale**: TDD ensures code correctness, prevents regressions, and produces better-designed, testable code.

### IV. Database-First Data Modeling

**Data models MUST be designed at the database level with proper constraints.**

- **Schema First**: Database schema MUST be defined with proper types, constraints, and relationships
- **Migrations**: All schema changes MUST use versioned migrations (never manual SQL)
- **Normalization**: Data MUST be normalized to at least 3NF unless denormalization is explicitly justified
- **Constraints**: Foreign keys, unique constraints, and check constraints MUST be defined in the database
- **Indexes**: Performance-critical queries MUST have appropriate indexes

**Rationale**: Database-level constraints ensure data integrity across all application layers and prevent inconsistent states.

### V. API-First Architecture

**Backend and frontend MUST communicate through well-defined API contracts.**

- **Contract Definition**: API contracts MUST be documented before implementation
- **RESTful Design**: APIs SHOULD follow REST principles with proper HTTP methods and status codes
- **Versioning**: Breaking API changes MUST use versioning (e.g., `/api/v1/`, `/api/v2/`)
- **Error Handling**: APIs MUST return consistent, structured error responses
- **Documentation**: All endpoints MUST be documented with request/response examples

**Rationale**: Clear API contracts enable parallel frontend/backend development and prevent integration issues.

## Technical Standards

### Technology Stack

**Required Versions**:

- **Backend Language**: Python 3.13
- **Backend Framework**: FastAPI
- **Frontend Framework**: React 18+ with TypeScript
- **Database**: PostgreSQL 15 (local and AWS RDS for production)
- **Testing**: pytest (backend), Jest + React Testing Library (frontend)
- **Type Checking**: mypy (Python), TypeScript strict mode (React)
- **Deployment**: AWS EC2

### Code Quality Standards

- **Linting**: Code MUST pass linting (ruff for Python, ESLint for TypeScript)
- **Formatting**: Code MUST be formatted consistently (ruff for Python, Prettier for TypeScript)
- **Type Checking**: Code MUST pass type checking with no errors (mypy, tsc --strict)
- **Security**: Dependencies MUST be scanned for vulnerabilities; secrets MUST NOT be committed
- **Performance**: Database queries MUST be optimized; N+1 queries MUST be eliminated

### Project Structure

- **Backend**: `backend/src/` for source, `backend/tests/` for tests
- **Frontend**: `frontend/src/` for source, `frontend/tests/` for tests
- **Shared**: Database migrations in `backend/migrations/`
- **Documentation**: Feature specs in `specs/[###-feature-name]/`

## Development Workflow

### Feature Development Process

1. **Specification**: Create feature spec using `/speckit.specify`
2. **Clarification**: Resolve ambiguities using `/speckit.clarify`
3. **Planning**: Generate implementation plan using `/speckit.plan`
4. **Task Generation**: Create task list using `/speckit.tasks`
5. **Implementation**: Execute tasks using `/speckit.implement` or manually
6. **Validation**: Verify all acceptance criteria and tests pass

### Code Review Requirements

- **All changes** MUST be reviewed before merging
- **Tests** MUST pass in CI/CD pipeline
- **Type checking** MUST pass with no errors
- **Linting** MUST pass with no warnings
- **Constitution compliance** MUST be verified

### Quality Gates

- **Pre-commit**: Linting and formatting checks
- **Pre-push**: Unit tests and type checking
- **Pre-merge**: Integration tests, code review approval, constitution compliance check

## Governance

### Amendment Process

This constitution supersedes all other development practices. Amendments require:

1. **Documentation**: Proposed changes documented with rationale
2. **Review**: Team review and approval
3. **Migration Plan**: Plan for bringing existing code into compliance (if applicable)
4. **Version Update**: Constitution version incremented per semantic versioning

### Versioning Policy

- **MAJOR**: Backward-incompatible principle changes or removals
- **MINOR**: New principles added or existing principles materially expanded
- **PATCH**: Clarifications, wording improvements, non-semantic updates

### Compliance

- **All PRs** MUST verify compliance with this constitution
- **Complexity** that violates principles MUST be explicitly justified in plan.md
- **Regular Reviews**: Constitution compliance SHOULD be reviewed quarterly

**Version**: 1.0.0 | **Ratified**: 2026-01-18 | **Last Amended**: 2026-01-18
