# Estate Docs — Go Backend

Drop-in replacement for the Python/FastAPI backend. Uses the **same database** and is compatible with the **same frontend**.

## Tech Stack

| Layer        | Library                          |
|--------------|----------------------------------|
| Router       | `go-chi/chi` v5                  |
| ORM          | `gorm` (PostgreSQL driver)       |
| Auth         | `golang-jwt/jwt` v5 + bcrypt     |
| Config       | `joho/godotenv` + env vars       |

## Quick Start

```bash
# 1. Copy env
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET_KEY

# 2. Download deps
go mod tidy

# 3. Build
go build -o server ./cmd/server/

# 4. Run
./server
# → listens on :8005 by default
```

## Project Structure

```
go-backend/
├── cmd/server/main.go          # Entry point, router wiring
├── internal/
│   ├── config/                 # Env-based config
│   ├── database/               # GORM connection
│   ├── handlers/               # HTTP handlers (controllers)
│   │   ├── auth.go
│   │   ├── users.go
│   │   ├── question_groups.go
│   │   ├── templates.go
│   │   ├── sessions.go
│   │   ├── documents.go
│   │   ├── flows.go
│   │   └── people.go
│   ├── middleware/              # Auth, rate limit
│   ├── models/                 # GORM models (matches existing DB)
│   ├── services/               # Business logic
│   └── utils/                  # JWT, password hashing, helpers
├── go.mod
├── go.sum
└── .env.example
```

## API Routes

All routes match the Python backend 1:1:

| Prefix                | Auth       | Methods                                      |
|-----------------------|------------|----------------------------------------------|
| `/api/auth`           | Public+Auth| register, login, refresh, logout, me, etc.   |
| `/api/users`          | Admin      | CRUD                                         |
| `/api/question-groups`| Admin      | CRUD + questions CRUD + check-identifier      |
| `/api/templates`      | Auth/Admin | CRUD + upload, duplicate, identifiers         |
| `/api/sessions`       | Auth       | CRUD + submit, navigate, copy, verify, etc.  |
| `/api/documents`      | Auth       | generate, preview, list, get, delete, merge   |
| `/api/flows`          | Auth/Admin | CRUD                                         |
| `/api/people`         | Admin      | CRUD + relationships                          |

## Database

This backend reads from the **same PostgreSQL database** as the Python backend. It does **not** run migrations — the existing Alembic migrations from the Python backend define the schema. Table names match exactly:

- `users`, `password_reset_tokens`, `refresh_tokens`
- `question_groups`, `questions`
- `templates`
- `document_sessions`, `session_answers`, `answer_snapshots`
- `generated_documents`
- `document_flows`, `flow_question_groups`
- `people`, `person_relationships`

## Conformance check (vs Python backend)

From the repository root:

```bash
./scripts/conform-go-mirror.sh
```

This runs `go fmt`, `go vet`, `go test ./...`, and `go build` for `go-backend`. Add new tests when porting behavior so the mirror stays aligned with Python for the same inputs (where the Go implementation exists).

`internal/services/document_service_test.go` covers identifier replacement and `<<person.field>>` lookup, matching the Python merge’s identifier/person resolution for those cases. Full template merge parity (macros, IF/ELSE, `<cr>`, counters, etc.) is still **Python-only** until ported—see Known TODOs.

## Known TODOs

- **File upload conversion** — the `/api/templates/upload` endpoint accepts files but does not yet convert Word/PDF to markdown (needs a Go equivalent of python-docx/mammoth).
- **Document merge as .docx** — currently returns merged markdown; full Word document generation needs a Go docx library.
- **SSN encryption** — placeholder; needs proper AES encryption matching the Python implementation.
- **Email sending** — forgot-password creates tokens but doesn't send emails yet.
- **Flow logic evaluation** — session navigation uses simple sequential order; the full flow_logic JSON evaluation (conditionals) needs to be ported from the Python session_service.
