# Research: Estate Doc(tor)

**Feature**: Estate Doc(tor)  
**Date**: 2026-01-18  
**Status**: Complete

## Overview

This document captures research findings for technology choices, architectural patterns, and best practices for the Estate Doc(tor). All technical unknowns from the specification have been resolved.

## Technology Decisions

### 1. AWS Textract for OCR

**Decision**: Use AWS Textract for OCR of uploaded PDFs and scanned images

**Rationale**:
- Industry-leading accuracy (>95% for typed documents, >90% for handwritten)
- Native AWS integration (already using EC2 and RDS)
- Handles both PDFs and images (JPG, PNG, TIFF)
- Asynchronous processing for large documents
- Built-in table and form detection capabilities
- Pay-per-use pricing model (no upfront costs)

**Alternatives Considered**:
- **Tesseract OCR**: Open-source, self-hosted, but lower accuracy (~85-90%) and requires manual setup/maintenance
- **Google Cloud Vision API**: Similar accuracy but requires Google Cloud account and cross-cloud complexity
- **Azure Computer Vision**: Good accuracy but less integration with existing AWS infrastructure

**Implementation Notes**:
- Use boto3 SDK for Python integration
- Implement async processing with job status polling for large documents
- Store raw OCR results temporarily, extract text to Markdown
- Handle OCR failures gracefully with retry logic and user notification

**Best Practices**:
- Validate file format before sending to Textract (supported: PDF, PNG, JPG, TIFF)
- Use StartDocumentTextDetection for async processing (>1 page)
- Implement exponential backoff for rate limiting
- Cache OCR results to avoid redundant processing

---

### 2. JWT Authentication with httpOnly Cookies

**Decision**: Use JWT tokens stored in httpOnly cookies for authentication

**Rationale**:
- Stateless authentication enables horizontal scaling
- httpOnly cookies prevent XSS attacks (JavaScript cannot access token)
- Secure flag ensures HTTPS-only transmission
- SameSite attribute prevents CSRF attacks
- No server-side session storage required
- Works seamlessly with React SPA architecture

**Alternatives Considered**:
- **Server-side sessions**: Stateful, requires session storage (Redis/database), complicates scaling
- **OAuth2 with third-party**: Adds external dependency, overkill for internal tool
- **Basic authentication**: Less secure, no session management

**Implementation Notes**:
- Use PyJWT library for token generation/validation
- Store tokens in httpOnly, Secure, SameSite=Strict cookies
- Implement refresh token mechanism (long-lived refresh, short-lived access)
- Include user ID and role in JWT payload
- Set access token expiration to 1 hour, refresh token to 7 days

**Best Practices**:
- Use strong secret key (256-bit minimum) stored in environment variables
- Implement token rotation on refresh
- Validate token signature and expiration on every request
- Include CSRF token for state-changing operations
- Implement logout by clearing cookies and blacklisting tokens (if needed)

---

### 3. Python Document Conversion Libraries

**Decision**: Use python-docx for Word, PyPDF2/pdfplumber for PDF text extraction

**Rationale**:
- **python-docx**: Native Python library, no external dependencies, good Word document support
- **PyPDF2**: Lightweight, pure Python, handles most PDFs
- **pdfplumber**: Better for complex PDFs with tables, fallback option
- No system-level dependencies required
- Easy integration with FastAPI
- Active maintenance and community support

**Alternatives Considered**:
- **Pandoc**: Universal converter but requires system installation, adds deployment complexity
- **Cloud conversion services**: API costs, external dependency, latency
- **LibreOffice headless**: Heavy dependency, slow startup time

**Implementation Notes**:
- Use python-docx for .docx files: extract paragraphs, preserve basic formatting
- Try PyPDF2 first for PDFs, fallback to pdfplumber if extraction fails
- Convert extracted text to Markdown with basic formatting (headings, bold, lists)
- Handle conversion errors gracefully, allow manual text entry as fallback

**Best Practices**:
- Validate file format before conversion
- Strip excessive whitespace and normalize line endings
- Preserve document structure (headings, paragraphs, lists)
- Log conversion warnings/errors for debugging
- Implement timeout for large documents (5 minute max)

---

### 4. ReportLab for PDF Generation

**Decision**: Use ReportLab with markdown2 preprocessing for PDF generation

**Rationale**:
- Industry-standard Python PDF library
- Programmatic control over layout and styling
- Supports complex layouts, tables, images
- No external dependencies or system binaries
- Active development and extensive documentation
- Commercial support available if needed

**Alternatives Considered**:
- **WeasyPrint**: HTML/CSS to PDF, heavier dependencies (Cairo, Pango)
- **pdfkit/wkhtmltopdf**: Requires external binary, deployment complexity
- **markdown2pdf wrappers**: Limited formatting control

**Implementation Notes**:
- Use markdown2 or mistune to parse Markdown to structured data
- Build PDF using ReportLab's Platypus (Page Layout and Typography Using Scripts)
- Define reusable styles for headings, paragraphs, lists
- Support basic Markdown: headings, bold, italic, lists, line breaks
- Replace `<<identifier>>` placeholders before Markdown parsing

**Best Practices**:
- Create template styles for consistent document appearance
- Use flowables (Paragraph, Spacer, Table) for flexible layout
- Handle long text with automatic page breaks
- Add page numbers and document metadata
- Implement error handling for malformed Markdown
- Cache compiled styles for performance

---

### 5. EC2 File Storage Strategy

**Decision**: Store files on EC2 instance file system with S3 backup

**Rationale**:
- Simple implementation, no additional AWS service costs
- Low latency for file access (local disk)
- Sufficient for moderate file volumes (<10GB initially)
- Easy to implement backup to S3
- Can migrate to S3 later if needed

**Alternatives Considered**:
- **AWS S3**: Better for large scale, but adds complexity and API latency
- **EFS (Elastic File System)**: Overkill for current scale, higher cost
- **Database BLOB storage**: Poor performance for large files

**Implementation Notes**:
- Organize files: `/var/app/storage/{client_id}/{document_type}/{filename}`
- Use UUIDs for filenames to avoid collisions
- Store file metadata in database (path, size, upload date)
- Implement daily backup cron job to S3
- Set appropriate file permissions (owner read/write only)
- Implement file cleanup for temporary files (OCR results, generated PDFs)

**Best Practices**:
- Validate file size before saving (10MB limit)
- Use atomic file operations to prevent corruption
- Implement virus scanning for uploaded files
- Monitor disk usage with CloudWatch
- Set up alerts for low disk space (<20% free)
- Implement file retention policy (delete old generated PDFs after 30 days)
- Encrypt sensitive files at rest

---

## Architectural Patterns

### 1. Layered Architecture (Backend)

**Pattern**: API → Services → Models (Data Access)

**Rationale**:
- Clear separation of concerns
- Business logic isolated in service layer
- Easy to test each layer independently
- Supports dependency injection
- Aligns with FastAPI best practices

**Implementation**:
- **API Layer**: FastAPI route handlers, request/response validation
- **Service Layer**: Business logic, orchestration, transaction management
- **Model Layer**: SQLAlchemy ORM models, database queries

**Benefits**:
- API handlers stay thin (validation, serialization only)
- Services are reusable across multiple endpoints
- Models encapsulate data access logic
- Easy to mock services for testing

---

### 2. Conditional Flow Navigation

**Pattern**: Graph-based navigation with rule evaluation

**Rationale**:
- Question groups are nodes, flow rules are edges
- Each rule specifies: source question, answer value, target group
- System evaluates rules at runtime based on client answers
- Supports complex branching logic

**Implementation**:
- Store flow rules in database with foreign keys
- Service method: `get_next_group(current_group, answers) -> next_group`
- Validate flow graph on creation (no cycles, all paths lead to end)
- Cache flow rules for performance

**Best Practices**:
- Detect cycles during flow creation (DFS/BFS algorithm)
- Provide default "next" group if no rules match
- Log navigation path for debugging
- Support "back" navigation by storing session history

---

### 3. Template Merge Engine

**Pattern**: Two-phase merge (parse → replace → render)

**Rationale**:
- Phase 1: Parse Markdown, identify `<<identifier>>` placeholders
- Phase 2: Replace placeholders with client answer values
- Phase 3: Render Markdown to PDF using ReportLab

**Implementation**:
- Regex pattern: `<<([a-zA-Z0-9_]+)>>`
- Build replacement map from client answers
- Replace all placeholders in single pass
- Handle missing values with default or "[NOT PROVIDED]"
- Parse resulting Markdown and generate PDF

**Best Practices**:
- Validate all identifiers exist before merge
- Escape special characters in answer values
- Support nested identifiers if needed
- Cache parsed templates for performance
- Log missing identifiers for debugging

---

### 4. Auto-Save Mechanism

**Pattern**: Debounced client-side save with server persistence

**Rationale**:
- Client-side: Debounce save requests (wait 2 seconds after last change)
- Server-side: Upsert answers (insert or update)
- Prevents data loss on session timeout or browser crash

**Implementation**:
- Frontend: useAutoSave hook with debounce
- Backend: UPSERT query (ON CONFLICT UPDATE)
- Store current group ID with session
- Timestamp each save for conflict resolution

**Best Practices**:
- Show save indicator to user ("Saving...", "Saved")
- Handle offline scenarios gracefully
- Implement optimistic UI updates
- Retry failed saves with exponential backoff

---

## Database Design Patterns

### 1. Normalized Schema (3NF)

**Rationale**:
- Eliminate data redundancy
- Ensure data integrity through constraints
- Support efficient queries with proper indexes

**Key Tables**:
- users, password_reset_tokens
- document_flows, flow_assignments
- question_groups, questions, flow_rules
- document_templates
- clients, questionnaire_sessions, answers
- generated_documents

**Relationships**:
- One-to-many: flow → flow_assignments, question_group → questions
- Many-to-many: flows ↔ question_groups (via flow_assignments)
- One-to-many: session → answers, client → sessions

---

### 2. Soft Deletes for Historical Data

**Pattern**: Use `deleted_at` timestamp instead of hard deletes

**Rationale**:
- Preserve historical questionnaire data
- Allow audit trail of changes
- Support "undo" operations

**Implementation**:
- Add `deleted_at` column (nullable timestamp)
- Filter deleted records in queries: `WHERE deleted_at IS NULL`
- Implement "restore" functionality for admins

---

### 3. Optimistic Locking for Concurrent Edits

**Pattern**: Use version column to detect concurrent modifications

**Rationale**:
- Prevent lost updates when multiple admins edit same entity
- Detect conflicts at save time

**Implementation**:
- Add `version` integer column to editable tables
- Increment version on each update
- Check version matches before update, fail if mismatch

---

## Security Best Practices

### 1. Password Security
- Hash passwords with bcrypt (passlib library)
- Use salt rounds = 12 (balance security and performance)
- Enforce password complexity requirements
- Implement rate limiting on login attempts (5 attempts per 15 minutes)

### 2. JWT Security
- Use HS256 algorithm with 256-bit secret
- Include `exp` (expiration) and `iat` (issued at) claims
- Validate signature and expiration on every request
- Implement token refresh mechanism
- Consider token blacklist for logout (Redis cache)

### 3. File Upload Security
- Validate file type by magic bytes, not just extension
- Scan uploaded files for malware (ClamAV integration)
- Limit file size (10MB)
- Store files outside web root
- Use UUIDs for filenames to prevent path traversal

### 4. SQL Injection Prevention
- Use SQLAlchemy ORM (parameterized queries)
- Never concatenate user input into SQL
- Validate and sanitize all inputs

### 5. XSS Prevention
- Sanitize user input before storing
- Escape output in templates
- Use Content-Security-Policy headers
- httpOnly cookies for JWT tokens

---

## Performance Optimization

### 1. Database Query Optimization
- Use eager loading for relationships (joinedload, selectinload)
- Add indexes on foreign keys and frequently queried columns
- Implement pagination for large result sets
- Use database connection pooling (SQLAlchemy default)

### 2. Caching Strategy
- Cache flow rules in memory (Redis or in-process)
- Cache parsed templates
- Cache OCR results temporarily
- Implement cache invalidation on updates

### 3. Async Processing
- Use FastAPI async endpoints for I/O-bound operations
- Process OCR asynchronously with background tasks
- Generate PDFs in background for large templates

---

## Testing Strategy

### 1. Unit Tests (pytest)
- Test service layer business logic in isolation
- Mock database and external services
- Test edge cases and error conditions
- Aim for >80% code coverage

### 2. Integration Tests
- Test API endpoints with test database
- Verify database transactions and rollbacks
- Test authentication and authorization
- Use pytest fixtures for test data

### 3. E2E Tests
- Test complete user workflows
- Login → Create question group → Complete questionnaire → Generate document
- Use Playwright or Selenium for browser automation

---

## Deployment Considerations

### 1. Environment Configuration
- Use environment variables for secrets (DATABASE_URL, JWT_SECRET, AWS_CREDENTIALS)
- Separate configs for dev, staging, production
- Use python-dotenv for local development

### 2. Database Migrations
- Use Alembic for schema migrations
- Version control all migration files
- Test migrations on staging before production
- Implement rollback strategy

### 3. Monitoring and Logging
- Use CloudWatch for application logs
- Implement structured logging (JSON format)
- Monitor key metrics: API latency, error rates, disk usage
- Set up alerts for critical errors

### 4. Backup Strategy
- Daily database backups to S3 (RDS automated backups)
- Daily file storage backups to S3
- Test restore procedures quarterly
- Implement point-in-time recovery

---

## Conclusion

All technical unknowns have been resolved. The chosen technologies and patterns align with the constitution's principles of clean, modular, type-safe code with test-first development. The architecture supports the specified performance goals and scale requirements. Ready to proceed with Phase 1 (data model and API contracts).
