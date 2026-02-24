# Implementation Tasks: Estate Doc(tor)

**Feature**: Estate Doc(tor)  
**Branch**: `001-estate-doc-generator`  
**Date**: 2026-01-18  
**Total Tasks**: 147

## Overview

This document contains all implementation tasks organized by user story priority. Each user story represents an independently testable increment that delivers value. Tasks follow Test-Driven Development (TDD) principles per the constitution.

## Task Format

```
- [ ] [TaskID] [P] [Story] Description with file path
```

- **TaskID**: Sequential identifier (T001, T002, etc.)
- **[P]**: Parallelizable task (can be done simultaneously with other [P] tasks)
- **[Story]**: User story label (US0, US1, US2, etc.)
- **Description**: Clear action with exact file path

## Dependencies & Execution Order

### User Story Completion Order

```
US0 (Authentication) → Foundation for all other stories
  ↓
US1 (Question Groups) → Required for US3, US5
  ↓
US2 (Templates) → Required for US4
US5 (Document Flows) → Enhances US1, Required for US3
  ↓
US3 (Questionnaire Sessions) → Requires US1, US5
  ↓
US4 (Document Merge) → Requires US2, US3
  ↓
US6 (Management) → Enhancement of US1, US2
```

### Parallel Execution Opportunities

**Within US0 (Authentication)**:
- T010-T013 (Backend models/schemas) can run parallel
- T020-T023 (Frontend components) can run parallel with backend

**Within US1 (Question Groups)**:
- T035-T038 (Backend models/schemas) can run parallel
- T050-T053 (Frontend components) can run parallel

**Within US2 (Templates)**:
- T065-T068 (Backend utilities) can run parallel
- T080-T083 (Frontend components) can run parallel

## MVP Scope

**Recommended MVP**: US0 + US1 only
- Delivers: Authentication + Question group creation with conditional flow
- Testable: Complete admin workflow for questionnaire design
- Value: Foundation for all other features

---

## Phase 1: Project Setup

**Goal**: Initialize project structure, dependencies, and development environment

### Backend Setup

- [X] T001 Create backend directory structure per plan.md
- [X] T002 Initialize Python 3.13 virtual environment in backend/
- [X] T003 Create backend/requirements.txt with FastAPI, SQLAlchemy, Pydantic, python-docx, PyPDF2, ReportLab, boto3, PyJWT, passlib, python-multipart, alembic
- [X] T004 Create backend/requirements-dev.txt with pytest, pytest-asyncio, pytest-cov, mypy, ruff, httpx
- [X] T005 Create backend/src/config.py for environment variable management
- [X] T006 Create backend/src/database.py for PostgreSQL connection and session management
- [X] T007 Create backend/src/main.py as FastAPI application entry point
- [X] T008 Initialize Alembic in backend/migrations/ for database migrations
- [X] T009 Create backend/pytest.ini, mypy.ini, ruff.toml configuration files

### Frontend Setup

- [X] T010 Create frontend directory structure per plan.md
- [X] T011 Initialize React 18+ TypeScript project with Vite in frontend/
- [X] T012 Create frontend/package.json with React, TypeScript, React Hook Form, React Query, Axios, React Router
- [X] T013 Add dev dependencies: Jest, React Testing Library, ESLint, Prettier, TypeScript
- [X] T014 Create frontend/tsconfig.json with strict mode enabled
- [X] T015 Create frontend/vite.config.ts for build configuration
- [X] T016 Create frontend/src/main.tsx as React app entry point
- [X] T017 Create frontend/src/App.tsx with React Router setup
- [X] T018 Create frontend/.env for environment variables (VITE_API_BASE_URL)

### Database Setup

- [ ] T019 Create PostgreSQL database: estate_docs_dev
- [ ] T020 Create PostgreSQL database: estate_docs_test
- [ ] T021 Create backend/.env with DATABASE_URL, JWT_SECRET_KEY, AWS credentials, SMTP settings

### Documentation

- [X] T022 Create backend/README.md with setup instructions
- [X] T023 Create frontend/README.md with setup instructions
- [X] T024 Create root README.md with project overview and links

---

## Phase 2: Foundational Infrastructure

**Goal**: Implement shared utilities, middleware, and base components needed across all user stories

### Backend Foundation

- [ ] T025 [P] Create backend/src/utils/security.py with password hashing (bcrypt) and JWT token generation/validation
- [ ] T026 [P] Create backend/src/utils/email.py with SMTP email sending for password reset
- [ ] T027 [P] Create backend/src/utils/file_storage.py with EC2 file system operations (save, read, delete)
- [ ] T028 [P] Create backend/src/middleware/auth_middleware.py for JWT validation on protected routes
- [ ] T029 Create backend/src/models/__init__.py with SQLAlchemy Base and common mixins (TimestampMixin, SoftDeleteMixin)

### Frontend Foundation

- [ ] T030 [P] Create frontend/src/services/api.ts with Axios instance and request/response interceptors
- [ ] T031 [P] Create frontend/src/hooks/useAuth.ts for authentication state management
- [ ] T032 [P] Create frontend/src/components/common/Button.tsx reusable button component
- [ ] T033 [P] Create frontend/src/components/common/Input.tsx reusable input component
- [ ] T034 [P] Create frontend/src/components/common/Dropdown.tsx reusable dropdown component
- [ ] T035 [P] Create frontend/src/components/layout/Header.tsx with navigation
- [ ] T036 [P] Create frontend/src/components/layout/Sidebar.tsx with menu
- [ ] T037 Create frontend/src/components/layout/Layout.tsx wrapping Header and Sidebar

---

## Phase 3: US0 - User Authentication and Management (Priority: P0)

**Goal**: Implement complete authentication system with user management

**Independent Test**: Create user account, login, logout, forgot password flow, admin user management

### Backend - Database Models

- [ ] T038 [P] [US0] Create backend/src/models/user.py with User model (id, username, email, password_hash, role, is_active, timestamps, version)
- [ ] T039 [P] [US0] Create backend/src/models/password_reset_token.py with PasswordResetToken model (id, user_id, token_hash, expires_at, used_at, created_at)
- [ ] T040 [US0] Create Alembic migration for users and password_reset_tokens tables with indexes and constraints
- [ ] T041 [US0] Run migration: alembic upgrade head

### Backend - Schemas

- [ ] T042 [P] [US0] Create backend/src/schemas/auth.py with LoginRequest, LoginResponse, ForgotPasswordRequest, ResetPasswordRequest schemas
- [ ] T043 [P] [US0] Create backend/src/schemas/user.py with User, UserCreate, UserUpdate schemas

### Backend - Services

- [ ] T044 [US0] Create backend/src/services/auth_service.py with authenticate_user, create_access_token, create_refresh_token, verify_token methods
- [ ] T045 [US0] Create backend/src/services/user_service.py with create_user, get_user_by_id, get_users, update_user, deactivate_user, generate_password_reset_token, reset_password methods

### Backend - API Endpoints

- [ ] T046 [US0] Create backend/src/api/v1/auth.py with POST /auth/login endpoint
- [ ] T047 [US0] Add POST /auth/logout endpoint to backend/src/api/v1/auth.py
- [ ] T048 [US0] Add GET /auth/me endpoint to backend/src/api/v1/auth.py
- [ ] T049 [US0] Add POST /auth/forgot-password endpoint to backend/src/api/v1/auth.py
- [ ] T050 [US0] Add POST /auth/reset-password endpoint to backend/src/api/v1/auth.py
- [ ] T051 [US0] Create backend/src/api/v1/users.py with GET /users, POST /users, GET /users/{id}, PATCH /users/{id}, DELETE /users/{id} endpoints (admin only)
- [ ] T052 [US0] Register auth and users routers in backend/src/main.py

### Backend - Tests

- [ ] T053 [US0] Create backend/tests/unit/test_auth_service.py with tests for authentication logic
- [ ] T054 [US0] Create backend/tests/unit/test_user_service.py with tests for user management logic
- [ ] T055 [US0] Create backend/tests/integration/test_api_auth.py with tests for auth endpoints
- [ ] T056 [US0] Create backend/tests/integration/test_api_users.py with tests for user management endpoints

### Frontend - Types

- [ ] T057 [P] [US0] Create frontend/src/types/auth.ts with LoginRequest, LoginResponse, User types
- [ ] T058 [P] [US0] Create frontend/src/types/user.ts with User, UserCreate, UserUpdate types

### Frontend - Services

- [ ] T059 [US0] Create frontend/src/services/authService.ts with login, logout, getCurrentUser, forgotPassword, resetPassword methods
- [ ] T060 [US0] Create frontend/src/services/userService.ts with getUsers, createUser, getUser, updateUser, deleteUser methods

### Frontend - Components

- [ ] T061 [P] [US0] Create frontend/src/components/auth/LoginForm.tsx with username/password form
- [ ] T062 [P] [US0] Create frontend/src/components/auth/ForgotPasswordForm.tsx with email input
- [ ] T063 [P] [US0] Create frontend/src/components/auth/PasswordResetForm.tsx with new password input
- [ ] T064 [P] [US0] Create frontend/src/components/admin/UserManagement.tsx with user list, create, edit, delete

### Frontend - Pages

- [ ] T065 [US0] Create frontend/src/pages/LoginPage.tsx using LoginForm component
- [ ] T066 [US0] Create frontend/src/pages/admin/UsersPage.tsx using UserManagement component
- [ ] T067 [US0] Add routes to frontend/src/App.tsx for /login, /forgot-password, /reset-password, /admin/users

### Frontend - Tests

- [ ] T068 [US0] Create frontend/tests/components/LoginForm.test.tsx
- [ ] T069 [US0] Create frontend/tests/components/UserManagement.test.tsx

### Integration Test

- [ ] T070 [US0] Create backend/tests/e2e/test_authentication_flow.py testing complete login → logout → forgot password → reset flow

---

## Phase 4: US1 - Create Question Group with Flow Logic (Priority: P1)

**Goal**: Implement question group creation with conditional flow navigation

**Independent Test**: Create two question groups, add multiple-choice question with conditional logic, verify flow works in client mode

### Backend - Database Models

- [ ] T071 [P] [US1] Create backend/src/models/question.py with QuestionGroup model (id, group_name, description, is_active, timestamps, version)
- [ ] T072 [P] [US1] Add Question model to backend/src/models/question.py (id, group_id, identifier, text, type, is_required, display_order, options, dropdown_table, dropdown_column, validation_rules, is_active, timestamps, version)
- [ ] T073 [P] [US1] Add FlowRule model to backend/src/models/question.py (id, source_question_id, answer_value, target_group_id, priority, created_at)
- [ ] T074 [US1] Create Alembic migration for question_groups, questions, flow_rules tables with indexes and constraints
- [ ] T075 [US1] Run migration: alembic upgrade head

### Backend - Schemas

- [ ] T076 [P] [US1] Create backend/src/schemas/question.py with QuestionGroup, QuestionGroupCreate, QuestionGroupUpdate, QuestionGroupDetail schemas
- [ ] T077 [P] [US1] Add Question, QuestionCreate, QuestionUpdate schemas to backend/src/schemas/question.py
- [ ] T078 [P] [US1] Add FlowRule, FlowRuleCreate schemas to backend/src/schemas/question.py

### Backend - Services

- [ ] T079 [US1] Create backend/src/services/question_service.py with create_group, get_groups, get_group_by_id, update_group, delete_group methods
- [ ] T080 [US1] Add create_question, get_questions, get_question_by_id, update_question, delete_question methods to backend/src/services/question_service.py
- [ ] T081 [US1] Add create_flow_rule, get_flow_rules, delete_flow_rule, validate_flow_no_cycles methods to backend/src/services/question_service.py

### Backend - API Endpoints

- [ ] T082 [US1] Create backend/src/api/v1/questions.py with GET /question-groups, POST /question-groups, GET /question-groups/{id}, PATCH /question-groups/{id}, DELETE /question-groups/{id} endpoints
- [ ] T083 [US1] Add POST /question-groups/{id}/questions, GET /questions/{id}, PATCH /questions/{id}, DELETE /questions/{id} endpoints to backend/src/api/v1/questions.py
- [ ] T084 [US1] Add GET /questions/{id}/flow-rules, POST /questions/{id}/flow-rules, DELETE /flow-rules/{id} endpoints to backend/src/api/v1/questions.py
- [ ] T085 [US1] Register questions router in backend/src/main.py

### Backend - Tests

- [ ] T086 [US1] Create backend/tests/unit/test_question_service.py with tests for question group and question logic
- [ ] T087 [US1] Create backend/tests/unit/test_flow_validation.py with tests for cycle detection in flow rules
- [ ] T088 [US1] Create backend/tests/integration/test_api_questions.py with tests for question endpoints

### Frontend - Types

- [ ] T089 [P] [US1] Create frontend/src/types/question.ts with QuestionGroup, Question, FlowRule, QuestionType enum types

### Frontend - Services

- [ ] T090 [US1] Create frontend/src/services/questionService.ts with getQuestionGroups, createQuestionGroup, getQuestionGroup, updateQuestionGroup, deleteQuestionGroup methods
- [ ] T091 [US1] Add createQuestion, getQuestion, updateQuestion, deleteQuestion, createFlowRule, getFlowRules, deleteFlowRule methods to frontend/src/services/questionService.ts

### Frontend - Components

- [ ] T092 [P] [US1] Create frontend/src/components/admin/QuestionGroupEditor.tsx with group form and question list
- [ ] T093 [P] [US1] Create frontend/src/components/admin/QuestionEditor.tsx with question form (type, identifier, text, options, validation)
- [ ] T094 [P] [US1] Create frontend/src/components/admin/FlowRuleEditor.tsx with flow rule form (answer value, target group)

### Frontend - Pages

- [ ] T095 [US1] Create frontend/src/pages/admin/QuestionsPage.tsx with question group list and editor
- [ ] T096 [US1] Add route to frontend/src/App.tsx for /admin/questions

### Frontend - Tests

- [ ] T097 [US1] Create frontend/tests/components/QuestionGroupEditor.test.tsx
- [ ] T098 [US1] Create frontend/tests/components/FlowRuleEditor.test.tsx

### Integration Test

- [ ] T099 [US1] Create backend/tests/e2e/test_question_flow.py testing create groups → add questions → define flow rules → validate no cycles

---

## Phase 5: US5 - Create Multiple Document Flows (Priority: P2)

**Goal**: Implement document flow management for organizing question groups into workflows

**Independent Test**: Create two flows, assign different question groups to each, verify independent navigation

### Backend - Database Models

- [ ] T100 [P] [US5] Create backend/src/models/flow.py with DocumentFlow model (id, flow_name, description, starting_group_id, is_active, timestamps, version)
- [ ] T101 [P] [US5] Add FlowAssignment model to backend/src/models/flow.py (id, flow_id, question_group_id, display_order, created_at)
- [ ] T102 [US5] Create Alembic migration for document_flows, flow_assignments tables with indexes and constraints
- [ ] T103 [US5] Run migration: alembic upgrade head

### Backend - Schemas

- [ ] T104 [P] [US5] Create backend/src/schemas/flow.py with DocumentFlow, DocumentFlowCreate, DocumentFlowUpdate, DocumentFlowDetail schemas

### Backend - Services

- [ ] T105 [US5] Create backend/src/services/flow_service.py with create_flow, get_flows, get_flow_by_id, update_flow, delete_flow methods
- [ ] T106 [US5] Add assign_question_group, remove_question_group, get_flow_question_groups, validate_flow_structure methods to backend/src/services/flow_service.py

### Backend - API Endpoints

- [ ] T107 [US5] Create backend/src/api/v1/flows.py with GET /flows, POST /flows, GET /flows/{id}, PATCH /flows/{id}, DELETE /flows/{id} endpoints
- [ ] T108 [US5] Add POST /flows/{id}/question-groups, DELETE /flows/{id}/question-groups, POST /flows/{id}/validate endpoints to backend/src/api/v1/flows.py
- [ ] T109 [US5] Register flows router in backend/src/main.py

### Backend - Tests

- [ ] T110 [US5] Create backend/tests/unit/test_flow_service.py with tests for flow management logic
- [ ] T111 [US5] Create backend/tests/integration/test_api_flows.py with tests for flow endpoints

### Frontend - Types

- [ ] T112 [P] [US5] Create frontend/src/types/flow.ts with DocumentFlow, FlowAssignment types

### Frontend - Services

- [ ] T113 [US5] Create frontend/src/services/flowService.ts with getFlows, createFlow, getFlow, updateFlow, deleteFlow, assignQuestionGroup, removeQuestionGroup, validateFlow methods

### Frontend - Components

- [ ] T114 [P] [US5] Create frontend/src/components/admin/FlowDesigner.tsx with flow form and question group assignment interface
- [ ] T115 [P] [US5] Create frontend/src/components/client/FlowSelector.tsx with dropdown to select flow when starting session

### Frontend - Pages

- [ ] T116 [US5] Create frontend/src/pages/admin/FlowsPage.tsx with flow list and designer
- [ ] T117 [US5] Add route to frontend/src/App.tsx for /admin/flows

### Frontend - Tests

- [ ] T118 [US5] Create frontend/tests/components/FlowDesigner.test.tsx

### Integration Test

- [ ] T119 [US5] Create backend/tests/e2e/test_document_flows.py testing create flows → assign groups → validate structure

---

## Phase 6: US2 - Create Document Template with Identifier Placeholders (Priority: P2)

**Goal**: Implement template creation with file upload, OCR, and identifier management

**Independent Test**: Create template with <<identifier>> placeholders, verify stored as Markdown

### Backend - Database Models

- [ ] T120 [P] [US2] Create backend/src/models/template.py with DocumentTemplate model (id, template_name, markdown_content, description, is_active, timestamps, version)
- [ ] T121 [P] [US2] Add UploadedDocument model to backend/src/models/template.py (id, original_filename, stored_filename, file_path, file_type, file_size_bytes, uploaded_by_user_id, uploaded_at, ocr_status, ocr_completed_at, extracted_text)
- [ ] T122 [US2] Create Alembic migration for document_templates, uploaded_documents tables with indexes and constraints
- [ ] T123 [US2] Run migration: alembic upgrade head

### Backend - Utilities

- [ ] T124 [P] [US2] Create backend/src/utils/ocr.py with AWS Textract integration (start_ocr_job, get_ocr_result methods)
- [ ] T125 [P] [US2] Create backend/src/utils/document_converter.py with Word to Markdown (python-docx) and PDF to Markdown (PyPDF2/pdfplumber) conversion
- [ ] T126 [P] [US2] Create backend/src/utils/template_validator.py with extract_identifiers, validate_identifiers_exist methods

### Backend - Schemas

- [ ] T127 [P] [US2] Create backend/src/schemas/template.py with DocumentTemplate, DocumentTemplateCreate, DocumentTemplateUpdate schemas
- [ ] T128 [P] [US2] Add UploadedDocument, TemplateValidationResult schemas to backend/src/schemas/template.py

### Backend - Services

- [ ] T129 [US2] Create backend/src/services/template_service.py with create_template, get_templates, get_template_by_id, update_template, delete_template methods
- [ ] T130 [US2] Add upload_document, process_upload (OCR/conversion), validate_template_identifiers methods to backend/src/services/template_service.py

### Backend - API Endpoints

- [ ] T131 [US2] Create backend/src/api/v1/templates.py with GET /templates, POST /templates, GET /templates/{id}, PATCH /templates/{id}, DELETE /templates/{id} endpoints
- [ ] T132 [US2] Add POST /templates/upload (multipart/form-data), POST /templates/{id}/validate endpoints to backend/src/api/v1/templates.py
- [ ] T133 [US2] Register templates router in backend/src/main.py

### Backend - Tests

- [ ] T134 [US2] Create backend/tests/unit/test_template_service.py with tests for template management
- [ ] T135 [US2] Create backend/tests/unit/test_document_converter.py with tests for Word/PDF conversion
- [ ] T136 [US2] Create backend/tests/unit/test_template_validator.py with tests for identifier extraction and validation
- [ ] T137 [US2] Create backend/tests/integration/test_api_templates.py with tests for template endpoints

### Frontend - Types

- [ ] T138 [P] [US2] Create frontend/src/types/template.ts with DocumentTemplate, UploadedDocument types

### Frontend - Services

- [ ] T139 [US2] Create frontend/src/services/templateService.ts with getTemplates, createTemplate, getTemplate, updateTemplate, deleteTemplate, uploadDocument, validateTemplate methods

### Frontend - Components

- [ ] T140 [P] [US2] Create frontend/src/components/admin/TemplateEditor.tsx with Markdown editor and identifier insertion
- [ ] T141 [P] [US2] Create frontend/src/components/common/FileUpload.tsx reusable file upload component
- [ ] T142 [P] [US2] Create frontend/src/components/admin/TemplateUpload.tsx with file upload and OCR status display

### Frontend - Pages

- [ ] T143 [US2] Create frontend/src/pages/admin/TemplatesPage.tsx with template list and editor
- [ ] T144 [US2] Add route to frontend/src/App.tsx for /admin/templates

### Frontend - Tests

- [ ] T145 [US2] Create frontend/tests/components/TemplateEditor.test.tsx
- [ ] T146 [US2] Create frontend/tests/components/TemplateUpload.test.tsx

### Integration Test

- [ ] T147 [US2] Create backend/tests/e2e/test_template_creation.py testing upload Word/PDF → OCR → convert to Markdown → save template

---

## Phase 7: US3 - Complete Client Questionnaire with Conditional Flow (Priority: P3)

**Goal**: Implement client-facing questionnaire with flow navigation and auto-save

**Independent Test**: Start session, answer questions, verify conditional navigation, confirm answers stored

### Backend - Database Models

- [ ] T148 [P] [US3] Create backend/src/models/client.py with Client model (id, client_name, email, phone, address, notes, is_active, timestamps, version)
- [ ] T149 [P] [US3] Create backend/src/models/session.py with QuestionnaireSession model (id, client_id, flow_id, user_id, current_group_id, status, started_at, completed_at, last_activity_at)
- [ ] T150 [P] [US3] Add Answer model to backend/src/models/session.py (id, session_id, question_id, question_identifier, answer_value, answered_at, updated_at)
- [ ] T151 [US3] Create Alembic migration for clients, questionnaire_sessions, answers tables with indexes and constraints
- [ ] T152 [US3] Run migration: alembic upgrade head

### Backend - Schemas

- [ ] T153 [P] [US3] Create backend/src/schemas/client.py with Client, ClientCreate schemas
- [ ] T154 [P] [US3] Create backend/src/schemas/session.py with QuestionnaireSession, SessionCreate, QuestionnaireSessionDetail, Answer, AnswerSubmit, NavigateRequest, NavigateResponse schemas

### Backend - Services

- [ ] T155 [US3] Create backend/src/services/session_service.py with create_session, get_sessions, get_session_by_id, update_session_status, update_current_group methods
- [ ] T156 [US3] Add submit_answer (upsert), get_session_answers, navigate_forward, navigate_backward, get_next_group_by_flow_rules methods to backend/src/services/session_service.py
- [ ] T157 [US3] Implement auto-save logic in submit_answer method (update last_activity_at timestamp)

### Backend - API Endpoints

- [ ] T158 [US3] Create backend/src/api/v1/sessions.py with GET /sessions, POST /sessions, GET /sessions/{id}, PATCH /sessions/{id} endpoints
- [ ] T159 [US3] Add POST /sessions/{id}/answers, POST /sessions/{id}/navigate endpoints to backend/src/api/v1/sessions.py
- [ ] T160 [US3] Create backend/src/api/v1/clients.py with GET /clients, POST /clients endpoints
- [ ] T161 [US3] Register sessions and clients routers in backend/src/main.py

### Backend - Tests

- [ ] T162 [US3] Create backend/tests/unit/test_session_service.py with tests for session management and navigation logic
- [ ] T163 [US3] Create backend/tests/integration/test_api_sessions.py with tests for session endpoints

### Frontend - Types

- [ ] T164 [P] [US3] Create frontend/src/types/client.ts with Client types
- [ ] T165 [P] [US3] Create frontend/src/types/session.ts with QuestionnaireSession, Answer types

### Frontend - Services

- [ ] T166 [US3] Create frontend/src/services/sessionService.ts with getSessions, createSession, getSession, updateSession, submitAnswer, navigate methods

### Frontend - Hooks

- [ ] T167 [US3] Create frontend/src/hooks/useAutoSave.ts with debounced auto-save logic (2 second debounce)

### Frontend - Components

- [ ] T168 [P] [US3] Create frontend/src/components/client/QuestionnaireView.tsx with session management and navigation
- [ ] T169 [P] [US3] Create frontend/src/components/client/QuestionGroup.tsx displaying all questions in a group
- [ ] T170 [P] [US3] Create frontend/src/components/client/QuestionRenderer.tsx rendering question based on type (multiple choice, free form, dropdown)

### Frontend - Pages

- [ ] T171 [US3] Create frontend/src/pages/client/QuestionnairePage.tsx with flow selector and questionnaire view
- [ ] T172 [US3] Add route to frontend/src/App.tsx for /questionnaire

### Frontend - Tests

- [ ] T173 [US3] Create frontend/tests/components/QuestionnaireView.test.tsx
- [ ] T174 [US3] Create frontend/tests/components/QuestionRenderer.test.tsx
- [ ] T175 [US3] Create frontend/tests/integration/questionnaire-flow.test.tsx testing complete flow navigation

### Integration Test

- [ ] T176 [US3] Create backend/tests/e2e/test_questionnaire_flow.py testing start session → answer questions → navigate with conditional logic → complete session

---

## Phase 8: US4 - Merge Client Answers into Document Template (Priority: P4)

**Goal**: Implement document merge engine and PDF generation

**Independent Test**: Select template and completed session, generate PDF with all placeholders replaced

### Backend - Database Models

- [ ] T177 [P] [US4] Create backend/src/models/document.py with GeneratedDocument model (id, client_id, session_id, template_id, file_path, file_size_bytes, generated_at, generated_by_user_id)
- [ ] T178 [US4] Create Alembic migration for generated_documents table with indexes and constraints
- [ ] T179 [US4] Run migration: alembic upgrade head

### Backend - Utilities

- [ ] T180 [P] [US4] Create backend/src/utils/pdf_generator.py with ReportLab PDF generation (markdown_to_pdf method)
- [ ] T181 [P] [US4] Add Markdown parsing and styling to backend/src/utils/pdf_generator.py (support headings, bold, italic, lists)

### Backend - Schemas

- [ ] T182 [P] [US4] Create backend/src/schemas/merge.py with MergeRequest, BatchMergeRequest, GeneratedDocument schemas

### Backend - Services

- [ ] T183 [US4] Create backend/src/services/merge_service.py with merge_template method (extract identifiers, replace with answers, handle missing values)
- [ ] T184 [US4] Add generate_pdf, generate_batch_pdfs, get_generated_document methods to backend/src/services/merge_service.py
- [ ] T185 [US4] Implement placeholder replacement logic with regex pattern `<<([a-zA-Z0-9_]+)>>`

### Backend - API Endpoints

- [ ] T186 [US4] Create backend/src/api/v1/merge.py with POST /merge, POST /merge/batch, GET /documents/{id}/download endpoints
- [ ] T187 [US4] Register merge router in backend/src/main.py

### Backend - Tests

- [ ] T188 [US4] Create backend/tests/unit/test_merge_service.py with tests for placeholder replacement and PDF generation
- [ ] T189 [US4] Create backend/tests/unit/test_pdf_generator.py with tests for Markdown to PDF conversion
- [ ] T190 [US4] Create backend/tests/integration/test_api_merge.py with tests for merge endpoints

### Frontend - Types

- [ ] T191 [P] [US4] Create frontend/src/types/merge.ts with MergeRequest, GeneratedDocument types

### Frontend - Services

- [ ] T192 [US4] Create frontend/src/services/mergeService.ts with mergeSingle, mergeBatch, downloadDocument methods

### Frontend - Components

- [ ] T193 [P] [US4] Create frontend/src/components/client/MergeInterface.tsx with template selector and merge button
- [ ] T194 [P] [US4] Create frontend/src/components/client/DocumentPreview.tsx showing generated document info and download link

### Frontend - Pages

- [ ] T195 [US4] Create frontend/src/pages/client/MergePage.tsx with client selector, template selector, and merge interface
- [ ] T196 [US4] Add route to frontend/src/App.tsx for /merge

### Frontend - Tests

- [ ] T197 [US4] Create frontend/tests/components/MergeInterface.test.tsx

### Integration Test

- [ ] T198 [US4] Create backend/tests/e2e/test_document_generation.py testing complete flow: create template → complete questionnaire → merge → download PDF

---

## Phase 9: US6 - Manage Question Groups and Templates (Priority: P6)

**Goal**: Add edit and delete capabilities for question groups and templates

**Independent Test**: Edit question group, verify changes reflected in new sessions, old data intact

### Backend - Services Enhancement

- [ ] T199 [US6] Enhance backend/src/services/question_service.py update methods to handle version conflicts (optimistic locking)
- [ ] T200 [US6] Enhance backend/src/services/template_service.py update methods to handle version conflicts
- [ ] T201 [US6] Add soft delete logic to question_service.py (set is_active = false, preserve historical data)
- [ ] T202 [US6] Add soft delete logic to template_service.py

### Backend - Tests

- [ ] T203 [US6] Add tests to backend/tests/unit/test_question_service.py for edit and delete operations
- [ ] T204 [US6] Add tests to backend/tests/unit/test_template_service.py for edit and delete operations
- [ ] T205 [US6] Create backend/tests/integration/test_version_conflicts.py testing optimistic locking

### Frontend - Components Enhancement

- [ ] T206 [US6] Enhance frontend/src/components/admin/QuestionGroupEditor.tsx with edit and delete buttons
- [ ] T207 [US6] Enhance frontend/src/components/admin/TemplateEditor.tsx with edit and delete buttons
- [ ] T208 [US6] Add confirmation dialogs for delete operations

### Frontend - Tests

- [ ] T209 [US6] Add edit and delete tests to frontend/tests/components/QuestionGroupEditor.test.tsx
- [ ] T210 [US6] Add edit and delete tests to frontend/tests/components/TemplateEditor.test.tsx

### Integration Test

- [ ] T211 [US6] Create backend/tests/e2e/test_management_operations.py testing edit → verify changes → delete → verify soft delete

---

## Phase 10: Polish & Cross-Cutting Concerns

**Goal**: Add production-ready features, error handling, logging, and documentation

### Error Handling & Validation

- [ ] T212 [P] Add comprehensive error handling to all backend services with custom exception classes
- [ ] T213 [P] Add request validation error responses with detailed field-level errors
- [ ] T214 [P] Add frontend error boundaries for graceful error display
- [ ] T215 [P] Add toast notifications for user feedback on frontend

### Logging & Monitoring

- [ ] T216 [P] Add structured logging to backend with JSON format (use Python logging module)
- [ ] T217 [P] Add request/response logging middleware to backend
- [ ] T218 [P] Add performance monitoring for slow queries (log queries >100ms)
- [ ] T219 [P] Add frontend error logging to backend endpoint

### Security Enhancements

- [ ] T220 [P] Add rate limiting to authentication endpoints (5 attempts per 15 minutes)
- [ ] T221 [P] Add CORS configuration in backend for frontend origin
- [ ] T222 [P] Add Content-Security-Policy headers
- [ ] T223 [P] Add file type validation by magic bytes (not just extension)
- [ ] T224 [P] Add SQL injection prevention verification (ensure all queries use ORM)

### Performance Optimization

- [ ] T225 [P] Add database query optimization with eager loading for relationships
- [ ] T226 [P] Add pagination to all list endpoints
- [ ] T227 [P] Add caching for frequently accessed data (flow rules, question groups)
- [ ] T228 [P] Add database connection pooling configuration

### Documentation

- [ ] T229 [P] Generate OpenAPI documentation at /docs endpoint (FastAPI automatic)
- [ ] T230 [P] Add API usage examples to OpenAPI docs
- [ ] T231 [P] Create deployment guide in docs/deployment.md
- [ ] T232 [P] Create troubleshooting guide in docs/troubleshooting.md

### Testing & Quality

- [ ] T233 Run full test suite: pytest --cov=src --cov-report=html
- [ ] T234 Run type checking: mypy src/
- [ ] T235 Run linting: ruff check src/
- [ ] T236 Run frontend tests: npm test
- [ ] T237 Run frontend type checking: npm run type-check
- [ ] T238 Run frontend linting: npm run lint
- [ ] T239 Verify all tests pass and coverage >80%

### Deployment Preparation

- [ ] T240 Create backend/Dockerfile for containerization
- [ ] T241 Create frontend/Dockerfile for containerization
- [ ] T242 Create docker-compose.yml for local development
- [ ] T243 Create deployment scripts for EC2
- [ ] T244 Configure environment variables for production
- [ ] T245 Set up database backup scripts
- [ ] T246 Configure CloudWatch logging
- [ ] T247 Create health check endpoint: GET /health

---

## Task Summary

### By Phase

- **Phase 1 (Setup)**: 24 tasks
- **Phase 2 (Foundation)**: 13 tasks
- **Phase 3 (US0 - Authentication)**: 33 tasks
- **Phase 4 (US1 - Question Groups)**: 29 tasks
- **Phase 5 (US5 - Document Flows)**: 20 tasks
- **Phase 6 (US2 - Templates)**: 28 tasks
- **Phase 7 (US3 - Questionnaire Sessions)**: 29 tasks
- **Phase 8 (US4 - Document Merge)**: 22 tasks
- **Phase 9 (US6 - Management)**: 13 tasks
- **Phase 10 (Polish)**: 36 tasks

**Total**: 247 tasks

### By User Story

- **US0 (Authentication)**: 33 tasks
- **US1 (Question Groups)**: 29 tasks
- **US2 (Templates)**: 28 tasks
- **US3 (Questionnaire Sessions)**: 29 tasks
- **US4 (Document Merge)**: 22 tasks
- **US5 (Document Flows)**: 20 tasks
- **US6 (Management)**: 13 tasks
- **Setup & Foundation**: 37 tasks
- **Polish**: 36 tasks

### Parallelizable Tasks

73 tasks marked with [P] can be executed in parallel within their phase.

---

## Implementation Strategy

### MVP Delivery (Weeks 1-2)

Focus on US0 + US1 for initial MVP:
- Complete Phase 1 (Setup)
- Complete Phase 2 (Foundation)
- Complete Phase 3 (US0 - Authentication)
- Complete Phase 4 (US1 - Question Groups)
- **Deliverable**: Admin can create question groups with conditional flow logic

### Iteration 2 (Weeks 3-4)

Add template and flow management:
- Complete Phase 5 (US5 - Document Flows)
- Complete Phase 6 (US2 - Templates)
- **Deliverable**: Admin can create flows and templates

### Iteration 3 (Weeks 5-6)

Add client-facing features:
- Complete Phase 7 (US3 - Questionnaire Sessions)
- Complete Phase 8 (US4 - Document Merge)
- **Deliverable**: End-to-end document generation

### Iteration 4 (Week 7)

Add management and polish:
- Complete Phase 9 (US6 - Management)
- Complete Phase 10 (Polish)
- **Deliverable**: Production-ready system

---

## Notes

- All tasks follow TDD: write test → implement → verify
- Each user story is independently testable
- Parallelizable tasks marked with [P] can run simultaneously
- Version conflicts handled with optimistic locking (version column)
- Soft deletes preserve historical data (is_active flag)
- Auto-save implemented with 30-second debounce
- File uploads limited to 10MB
- JWT tokens expire after 1 hour with refresh mechanism
- All passwords hashed with bcrypt (12 rounds)
- Database migrations use Alembic
- API documentation auto-generated by FastAPI at /docs
