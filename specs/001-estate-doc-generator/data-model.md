# Data Model: Document Merge System

**Feature**: Document Merge System  
**Date**: 2026-01-18  
**Database**: PostgreSQL 15  
**ORM**: SQLAlchemy 2.0+

## Overview

This document defines the normalized database schema for the Document Merge System. All tables are designed to 3NF with proper constraints, indexes, and relationships to ensure data integrity and query performance.

## Entity Relationship Diagram

```
users (1) ──< (M) password_reset_tokens
users (1) ──< (M) questionnaire_sessions

document_flows (1) ──< (M) flow_assignments (M) >── (1) question_groups
document_flows (1) ──< (M) questionnaire_sessions

question_groups (1) ──< (M) questions
questions (1) ──< (M) flow_rules (source)
question_groups (1) ──< (M) flow_rules (target)

clients (1) ──< (M) questionnaire_sessions
questionnaire_sessions (1) ──< (M) answers

document_templates (1) ──< (M) generated_documents
clients (1) ──< (M) generated_documents
questionnaire_sessions (1) ──< (M) generated_documents
```

## Core Tables

### 1. users

Stores system user accounts with authentication credentials and role information.

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'user')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    
    CONSTRAINT username_length CHECK (LENGTH(username) >= 3),
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_is_active ON users(is_active);
```

**Attributes**:
- `id`: Primary key, auto-increment
- `username`: Unique username, 3-50 characters
- `email`: Unique email address, validated format
- `password_hash`: Bcrypt hashed password (60 chars)
- `role`: User role (admin or user)
- `is_active`: Soft delete flag
- `created_at`: Account creation timestamp
- `last_login_at`: Last successful login timestamp
- `version`: Optimistic locking version

**Constraints**:
- Username must be unique and >= 3 characters
- Email must be unique and valid format
- Role must be 'admin' or 'user'

---

### 2. password_reset_tokens

Stores password reset tokens for forgot password functionality.

```sql
CREATE TABLE password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT token_not_expired CHECK (expires_at > created_at)
);

CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
```

**Attributes**:
- `id`: Primary key
- `user_id`: Foreign key to users table
- `token_hash`: Hashed reset token (UUID hashed)
- `expires_at`: Token expiration timestamp (24 hours)
- `used_at`: Timestamp when token was used (NULL if unused)
- `created_at`: Token creation timestamp

**Constraints**:
- Expiration must be after creation
- Token hash must be unique
- Cascade delete when user is deleted

---

### 3. document_flows

Stores document flow definitions (questionnaire workflows).

```sql
CREATE TABLE document_flows (
    id SERIAL PRIMARY KEY,
    flow_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    starting_group_id INTEGER REFERENCES question_groups(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    
    CONSTRAINT flow_name_length CHECK (LENGTH(flow_name) >= 3)
);

CREATE INDEX idx_document_flows_is_active ON document_flows(is_active);
CREATE INDEX idx_document_flows_starting_group_id ON document_flows(starting_group_id);
```

**Attributes**:
- `id`: Primary key
- `flow_name`: Unique flow name
- `description`: Optional flow description
- `starting_group_id`: Foreign key to first question group
- `is_active`: Soft delete flag
- `created_at`: Flow creation timestamp
- `updated_at`: Last modification timestamp
- `version`: Optimistic locking version

**Constraints**:
- Flow name must be unique and >= 3 characters
- Starting group can be NULL (set during flow design)

---

### 4. flow_assignments

Junction table linking document flows to question groups.

```sql
CREATE TABLE flow_assignments (
    id SERIAL PRIMARY KEY,
    flow_id INTEGER NOT NULL REFERENCES document_flows(id) ON DELETE CASCADE,
    question_group_id INTEGER NOT NULL REFERENCES question_groups(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_flow_group UNIQUE (flow_id, question_group_id)
);

CREATE INDEX idx_flow_assignments_flow_id ON flow_assignments(flow_id);
CREATE INDEX idx_flow_assignments_question_group_id ON flow_assignments(question_group_id);
```

**Attributes**:
- `id`: Primary key
- `flow_id`: Foreign key to document_flows
- `question_group_id`: Foreign key to question_groups
- `display_order`: Order for display purposes
- `created_at`: Assignment creation timestamp

**Constraints**:
- Unique combination of flow_id and question_group_id
- Cascade delete when flow or group is deleted

---

### 5. question_groups

Stores groups of related questions.

```sql
CREATE TABLE question_groups (
    id SERIAL PRIMARY KEY,
    group_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    
    CONSTRAINT group_name_length CHECK (LENGTH(group_name) >= 3)
);

CREATE INDEX idx_question_groups_is_active ON question_groups(is_active);
```

**Attributes**:
- `id`: Primary key
- `group_name`: Group name (not globally unique, can be reused across flows)
- `description`: Optional group description
- `is_active`: Soft delete flag
- `created_at`: Group creation timestamp
- `updated_at`: Last modification timestamp
- `version`: Optimistic locking version

---

### 6. questions

Stores individual questions within question groups.

```sql
CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    question_group_id INTEGER NOT NULL REFERENCES question_groups(id) ON DELETE CASCADE,
    question_identifier VARCHAR(100) NOT NULL UNIQUE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('multiple_choice', 'free_form', 'dropdown')),
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER NOT NULL DEFAULT 0,
    
    -- For multiple choice questions
    options JSONB,
    
    -- For dropdown questions
    dropdown_table VARCHAR(100),
    dropdown_column VARCHAR(100),
    
    -- Validation rules
    validation_rules JSONB,
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    
    CONSTRAINT identifier_length CHECK (LENGTH(question_identifier) >= 2),
    CONSTRAINT question_text_length CHECK (LENGTH(question_text) >= 5),
    CONSTRAINT multiple_choice_has_options CHECK (
        question_type != 'multiple_choice' OR (options IS NOT NULL AND jsonb_array_length(options) >= 2)
    ),
    CONSTRAINT dropdown_has_table CHECK (
        question_type != 'dropdown' OR (dropdown_table IS NOT NULL AND dropdown_column IS NOT NULL)
    )
);

CREATE INDEX idx_questions_group_id ON questions(question_group_id);
CREATE INDEX idx_questions_identifier ON questions(question_identifier);
CREATE INDEX idx_questions_is_active ON questions(is_active);
CREATE INDEX idx_questions_type ON questions(question_type);
```

**Attributes**:
- `id`: Primary key
- `question_group_id`: Foreign key to question_groups
- `question_identifier`: Unique identifier for template merging (e.g., "dob", "client_name")
- `question_text`: The question text displayed to users
- `question_type`: Type of question (multiple_choice, free_form, dropdown)
- `is_required`: Whether answer is required
- `display_order`: Order within group
- `options`: JSON array of options for multiple choice (e.g., ["Male", "Female"])
- `dropdown_table`: Database table name for dropdown population
- `dropdown_column`: Database column name for dropdown values
- `validation_rules`: JSON object with validation rules (e.g., {"min_length": 5, "pattern": "^[0-9]+$"})
- `is_active`: Soft delete flag
- `created_at`: Question creation timestamp
- `updated_at`: Last modification timestamp
- `version`: Optimistic locking version

**Constraints**:
- Question identifier must be unique globally
- Multiple choice questions must have at least 2 options
- Dropdown questions must specify table and column
- Cascade delete when group is deleted

---

### 7. flow_rules

Stores conditional navigation rules for question flows.

```sql
CREATE TABLE flow_rules (
    id SERIAL PRIMARY KEY,
    source_question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    answer_value VARCHAR(255) NOT NULL,
    target_group_id INTEGER NOT NULL REFERENCES question_groups(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_question_answer UNIQUE (source_question_id, answer_value),
    CONSTRAINT no_self_loop CHECK (
        source_question_id NOT IN (
            SELECT id FROM questions WHERE question_group_id = target_group_id
        )
    )
);

CREATE INDEX idx_flow_rules_source_question ON flow_rules(source_question_id);
CREATE INDEX idx_flow_rules_target_group ON flow_rules(target_group_id);
```

**Attributes**:
- `id`: Primary key
- `source_question_id`: Foreign key to questions (the question that triggers the rule)
- `answer_value`: The answer value that triggers this rule (e.g., "Male", "Female")
- `target_group_id`: Foreign key to question_groups (next group to navigate to)
- `priority`: Rule priority (higher priority evaluated first)
- `created_at`: Rule creation timestamp

**Constraints**:
- Unique combination of source_question_id and answer_value
- Prevent self-loops (source question's group cannot be target group)
- Cascade delete when question or target group is deleted

---

### 8. document_templates

Stores document templates with embedded parameter placeholders.

```sql
CREATE TABLE document_templates (
    id SERIAL PRIMARY KEY,
    template_name VARCHAR(100) NOT NULL UNIQUE,
    markdown_content TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    
    CONSTRAINT template_name_length CHECK (LENGTH(template_name) >= 3),
    CONSTRAINT markdown_content_length CHECK (LENGTH(markdown_content) >= 10)
);

CREATE INDEX idx_document_templates_is_active ON document_templates(is_active);
```

**Attributes**:
- `id`: Primary key
- `template_name`: Unique template name
- `markdown_content`: Template content with `<<identifier>>` placeholders
- `description`: Optional template description
- `is_active`: Soft delete flag
- `created_at`: Template creation timestamp
- `updated_at`: Last modification timestamp
- `version`: Optimistic locking version

**Constraints**:
- Template name must be unique and >= 3 characters
- Markdown content must be >= 10 characters

---

### 9. clients

Stores client information for whom questionnaires are completed.

```sql
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    
    CONSTRAINT client_name_length CHECK (LENGTH(client_name) >= 2)
);

CREATE INDEX idx_clients_name ON clients(client_name);
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_is_active ON clients(is_active);
```

**Attributes**:
- `id`: Primary key
- `client_name`: Client full name
- `email`: Optional client email
- `phone`: Optional client phone
- `address`: Optional client address
- `notes`: Optional notes about client
- `is_active`: Soft delete flag
- `created_at`: Client creation timestamp
- `updated_at`: Last modification timestamp
- `version`: Optimistic locking version

---

### 10. questionnaire_sessions

Stores client questionnaire completion sessions.

```sql
CREATE TABLE questionnaire_sessions (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    flow_id INTEGER NOT NULL REFERENCES document_flows(id) ON DELETE RESTRICT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    current_group_id INTEGER REFERENCES question_groups(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT completed_has_timestamp CHECK (
        status != 'completed' OR completed_at IS NOT NULL
    )
);

CREATE INDEX idx_questionnaire_sessions_client_id ON questionnaire_sessions(client_id);
CREATE INDEX idx_questionnaire_sessions_flow_id ON questionnaire_sessions(flow_id);
CREATE INDEX idx_questionnaire_sessions_user_id ON questionnaire_sessions(user_id);
CREATE INDEX idx_questionnaire_sessions_status ON questionnaire_sessions(status);
CREATE INDEX idx_questionnaire_sessions_last_activity ON questionnaire_sessions(last_activity_at);
```

**Attributes**:
- `id`: Primary key
- `client_id`: Foreign key to clients
- `flow_id`: Foreign key to document_flows (which flow is being used)
- `user_id`: Foreign key to users (who is completing the questionnaire)
- `current_group_id`: Foreign key to question_groups (current position in flow)
- `status`: Session status (in_progress, completed, abandoned)
- `started_at`: Session start timestamp
- `completed_at`: Session completion timestamp (NULL if not completed)
- `last_activity_at`: Last activity timestamp (for auto-save and timeout)

**Constraints**:
- Completed sessions must have completed_at timestamp
- Cascade delete when client is deleted
- Restrict delete when flow or user is deleted (preserve historical data)

---

### 11. answers

Stores client answers to questions.

```sql
CREATE TABLE answers (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES questionnaire_sessions(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
    question_identifier VARCHAR(100) NOT NULL,
    answer_value TEXT NOT NULL,
    answered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_session_question UNIQUE (session_id, question_id),
    CONSTRAINT answer_value_length CHECK (LENGTH(answer_value) >= 1)
);

CREATE INDEX idx_answers_session_id ON answers(session_id);
CREATE INDEX idx_answers_question_id ON answers(question_id);
CREATE INDEX idx_answers_identifier ON answers(question_identifier);
CREATE INDEX idx_answers_session_identifier ON answers(session_id, question_identifier);
```

**Attributes**:
- `id`: Primary key
- `session_id`: Foreign key to questionnaire_sessions
- `question_id`: Foreign key to questions
- `question_identifier`: Denormalized identifier for fast lookup during merge
- `answer_value`: The client's answer (stored as text)
- `answered_at`: Initial answer timestamp
- `updated_at`: Last update timestamp (for tracking changes)

**Constraints**:
- Unique combination of session_id and question_id (one answer per question per session)
- Answer value must not be empty
- Cascade delete when session is deleted
- Restrict delete when question is deleted (preserve historical data)

**Note**: `question_identifier` is denormalized for performance during document merge. This avoids JOIN with questions table when replacing placeholders.

---

### 12. generated_documents

Stores metadata about generated PDF documents.

```sql
CREATE TABLE generated_documents (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    session_id INTEGER NOT NULL REFERENCES questionnaire_sessions(id) ON DELETE CASCADE,
    template_id INTEGER NOT NULL REFERENCES document_templates(id) ON DELETE RESTRICT,
    file_path VARCHAR(500) NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    generated_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    
    CONSTRAINT file_size_positive CHECK (file_size_bytes > 0)
);

CREATE INDEX idx_generated_documents_client_id ON generated_documents(client_id);
CREATE INDEX idx_generated_documents_session_id ON generated_documents(session_id);
CREATE INDEX idx_generated_documents_template_id ON generated_documents(template_id);
CREATE INDEX idx_generated_documents_generated_at ON generated_documents(generated_at);
```

**Attributes**:
- `id`: Primary key
- `client_id`: Foreign key to clients
- `session_id`: Foreign key to questionnaire_sessions
- `template_id`: Foreign key to document_templates
- `file_path`: Path to PDF file on EC2 file system
- `file_size_bytes`: File size in bytes
- `generated_at`: Document generation timestamp
- `generated_by_user_id`: Foreign key to users (who generated the document)

**Constraints**:
- File size must be positive
- Cascade delete when client or session is deleted
- Restrict delete when template or user is deleted (preserve audit trail)

---

## Additional Tables for File Uploads

### 13. uploaded_documents

Stores metadata about uploaded Word/PDF/image files.

```sql
CREATE TABLE uploaded_documents (
    id SERIAL PRIMARY KEY,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL UNIQUE,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('docx', 'pdf', 'jpg', 'png', 'tiff')),
    file_size_bytes INTEGER NOT NULL,
    uploaded_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ocr_status VARCHAR(20) CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed')),
    ocr_completed_at TIMESTAMP,
    extracted_text TEXT,
    
    CONSTRAINT file_size_positive CHECK (file_size_bytes > 0),
    CONSTRAINT file_size_limit CHECK (file_size_bytes <= 10485760) -- 10MB
);

CREATE INDEX idx_uploaded_documents_uploaded_by ON uploaded_documents(uploaded_by_user_id);
CREATE INDEX idx_uploaded_documents_ocr_status ON uploaded_documents(ocr_status);
CREATE INDEX idx_uploaded_documents_uploaded_at ON uploaded_documents(uploaded_at);
```

**Attributes**:
- `id`: Primary key
- `original_filename`: Original filename from upload
- `stored_filename`: UUID-based filename on disk
- `file_path`: Full path to file on EC2 file system
- `file_type`: File extension/type
- `file_size_bytes`: File size in bytes
- `uploaded_by_user_id`: Foreign key to users
- `uploaded_at`: Upload timestamp
- `ocr_status`: OCR processing status (for PDFs and images)
- `ocr_completed_at`: OCR completion timestamp
- `extracted_text`: Extracted text from OCR (stored temporarily)

**Constraints**:
- File size must be positive and <= 10MB
- Stored filename must be unique

---

## Migration Strategy

### Initial Migration (Version 1)

```sql
-- Create all tables in dependency order
-- 1. Independent tables first
CREATE TABLE users (...);
CREATE TABLE clients (...);
CREATE TABLE question_groups (...);
CREATE TABLE document_templates (...);
CREATE TABLE document_flows (...);

-- 2. Tables with single foreign key
CREATE TABLE password_reset_tokens (...);
CREATE TABLE questions (...);
CREATE TABLE uploaded_documents (...);

-- 3. Tables with multiple foreign keys
CREATE TABLE flow_assignments (...);
CREATE TABLE flow_rules (...);
CREATE TABLE questionnaire_sessions (...);

-- 4. Dependent tables
CREATE TABLE answers (...);
CREATE TABLE generated_documents (...);

-- 5. Create indexes
CREATE INDEX ...;

-- 6. Insert seed data (admin user, sample flow)
INSERT INTO users (username, email, password_hash, role) VALUES (...);
```

### Future Migrations

- Use Alembic for version-controlled migrations
- Always test migrations on staging before production
- Implement rollback scripts for each migration
- Document breaking changes in migration comments

---

## Data Integrity Rules

### Referential Integrity
- All foreign keys enforce CASCADE or RESTRICT on delete
- CASCADE: Delete dependent records (e.g., answers when session deleted)
- RESTRICT: Prevent deletion if referenced (e.g., cannot delete question with answers)

### Soft Deletes
- Use `is_active` flag for user-facing entities (users, flows, groups, templates, clients)
- Preserve historical data for audit and regeneration
- Filter `is_active = TRUE` in application queries

### Optimistic Locking
- Use `version` column on editable entities
- Increment version on each update
- Check version matches before update to detect concurrent modifications

### Timestamps
- All tables have `created_at` timestamp
- Editable tables have `updated_at` timestamp
- Use database triggers or ORM events to auto-update `updated_at`

---

## Performance Considerations

### Indexes
- Primary keys automatically indexed
- Foreign keys indexed for JOIN performance
- Frequently queried columns indexed (email, username, question_identifier)
- Composite indexes for common query patterns (session_id + question_identifier)

### Query Optimization
- Use eager loading for relationships (SQLAlchemy `joinedload`, `selectinload`)
- Avoid N+1 queries with proper JOIN strategies
- Implement pagination for large result sets
- Use database connection pooling

### Data Volume Estimates
- Users: 100-500 records
- Clients: 1,000-10,000 records
- Question Groups: 50-200 records
- Questions: 500-2,000 records
- Flows: 10-50 records
- Sessions: 10,000-100,000 records
- Answers: 100,000-1,000,000 records
- Generated Documents: 10,000-100,000 records

### Archival Strategy
- Archive completed sessions older than 2 years to separate table
- Delete generated PDFs older than 30 days (can regenerate from answers)
- Implement data retention policy per compliance requirements

---

## Security Considerations

### Sensitive Data
- Password hashes: bcrypt with salt rounds = 12
- JWT secrets: stored in environment variables, never in database
- Client PII: consider encryption at rest for production

### Access Control
- Row-level security: users can only access their own sessions
- Admin users can access all data
- Implement authorization checks in service layer

### Audit Trail
- Track who created/modified records (created_by, updated_by columns if needed)
- Log all data modifications for compliance
- Preserve historical data with soft deletes

---

## Conclusion

This data model supports all functional requirements from the specification with proper normalization, constraints, and indexes. The schema enforces data integrity at the database level and provides efficient query performance for expected data volumes. Ready to proceed with API contract definition.
