# Estate Docs Documentation Index

## Project Overview
Estate Docs is a full-stack document generation platform for estate planning. Users fill out questionnaires, define templates with placeholders, and generate Word documents by merging session answers into templates.

---

## Documentation Files

### 1. CODEBASE_ANALYSIS.md (Comprehensive)
**Purpose**: Complete technical reference for understanding the entire codebase architecture

**Contents**:
- Template Structure (models, identifier extraction, types)
- Question Types (8 types, storage format, repeatable logic)
- Document Generation System (3-stage pipeline, 6-pass merge engine)
- Document Generation Flow (step-by-step process)
- Question & Session Models (data relationships)
- Document Model & S3 Storage
- Document Processor Utilities (file conversion)
- API Endpoints (all routes)
- Frontend Services & Types
- Variable Substitution & Formula System
- Recent Changes (page break macro)
- Data Flow Diagram
- File Locations (backend and frontend)

**Best For**: Understanding how things work, implementation details, architectural decisions

---

### 2. QUICK_REFERENCE.md (Practical Guide)
**Purpose**: Fast lookup for common tasks and syntax

**Contents**:
- Template Syntax Cheat Sheet
  - Variable replacement
  - FOR EACH loops
  - PEOPLELOOP
  - IF/ELSE conditionals
  - [[ ]] conditional sections
  - Counters (##, ###, ##%, ##A)
  - Page breaks and line breaks
  - Macros

- Data Types & Formatting
  - Person type (JSON with conjunctions)
  - Date type (ISO -> formatted)
  - Repeatable groups

- Key Files by Purpose (quick navigation)

- Database Schema (simplified view)

- Common Template Patterns
  - Beneficiaries
  - Conditional spouse info
  - Multiple trustees
  - Signature pages

- Identifier Naming Conventions

- Merge Process Flow (6 passes)

- Debugging Tips

- API Endpoints Quick List

- Performance Notes

**Best For**: Writing templates, quick syntax lookup, API usage, debugging

---

## Quick Navigation by Topic

### Understanding Templates
1. Start: QUICK_REFERENCE.md - "Template Syntax Cheat Sheet"
2. Deep dive: CODEBASE_ANALYSIS.md - "Template Structure" section
3. Examples: QUICK_REFERENCE.md - "Common Template Patterns"

### Data Flow & Storage
1. Overview: CODEBASE_ANALYSIS.md - "Data Flow Diagram"
2. Models: CODEBASE_ANALYSIS.md - "Question & Session Models"
3. Answers: CODEBASE_ANALYSIS.md - "Document Generation Flow"

### Document Generation
1. Quick overview: QUICK_REFERENCE.md - "Merge Process Flow"
2. Complete details: CODEBASE_ANALYSIS.md - "Document Generation System" (sections 3-4)
3. Files: CODEBASE_ANALYSIS.md - "File Locations"

### API Usage
1. Quick list: QUICK_REFERENCE.md - "API Endpoints Quick List"
2. Full docs: CODEBASE_ANALYSIS.md - "API Endpoints"
3. Frontend: CODEBASE_ANALYSIS.md - "Frontend Services & Types"

### Template Syntax
1. Cheat sheet: QUICK_REFERENCE.md - "Template Syntax Cheat Sheet"
2. Counters: QUICK_REFERENCE.md - "Counters" section
3. Conditionals: QUICK_REFERENCE.md - "IF/ELSE" section
4. Loops: QUICK_REFERENCE.md - "FOR EACH" section

### File Conversions
1. Overview: CODEBASE_ANALYSIS.md - "Document Processor Utilities"
2. Supported formats: See "File Format Conversion" subsection

### Page Break Macro
1. Recent addition: CODEBASE_ANALYSIS.md - "Recent Changes & Page Break Macro"
2. Implementation: Same section, detailed 5-step process
3. How to use: QUICK_REFERENCE.md - "Page Break" under "Special Elements"

### Debugging
1. Tips: QUICK_REFERENCE.md - "Debugging Tips"
2. Debug files: `/tmp/quill_html_debug.html` for Word generation issues
3. Preview: Use `/documents/preview` API endpoint

---

## Key Concepts at a Glance

### Template System
- **Identifiers**: `<<name>>` or `<<namespace.field>>` syntax
- **Extraction**: Automatic via regex, stored in `Template.identifiers`
- **Storage**: HTML from Quill rich text editor in `markdown_content`
- **Merging**: 6-pass engine handles macros, loops, conditionals, counters

### Data Types
- **Person**: JSON array `[{"name": "John", "conjunction": "and"}, ...]`
- **Date**: ISO format `"2024-03-28"` displayed as "March 28, 2024"
- **Repeatable**: Multiple answers grouped via `repeatable_group_id`
- **Others**: Multiple choice, free text, dropdowns, checkboxes

### Processing Pipeline
1. Collect answers from session (SessionAnswer records)
2. Build answer_map and raw_answer_map
3. Run _merge_template() with 6 passes
4. Convert HTML to Word via HTMLToWordConverter
5. Store in S3 and return .docx bytes

### No Real Formula System
- No arithmetic: `+`, `-`, `*`, `/`
- No dynamic formulas: `=A1+B1`
- No conditional calculations: `IF(x > 10, y, z)`
- Only string substitution with counters and conditionals

---

## File Organization

### Backend
```
backend/src/
├─ models/
│  ├─ template.py (Template, identifier extraction)
│  ├─ question.py (8 question types, repeatable logic)
│  ├─ document.py (GeneratedDocument, S3 key)
│  └─ session.py (InputForm, SessionAnswer)
├─ services/
│  ├─ document_service.py (merge engine, 2400+ lines)
│  ├─ template_service.py (CRUD, extraction)
│  └─ document_processor.py (file conversion)
├─ routers/
│  ├─ documents.py (API endpoints)
│  └─ templates.py (template endpoints)
└─ utils/
   └─ document_processor.py (file conversion)
```

### Frontend
```
frontend/src/
├─ types/
│  ├─ template.ts (Template interfaces)
│  └─ document.ts (Document interfaces)
├─ services/
│  ├─ documentService.ts (API client)
│  └─ templateService.ts (template API)
└─ pages/
   ├─ InputForms.tsx (questionnaire)
   └─ Documents.tsx (document list)
```

---

## Common Tasks

### Creating a Template
1. Use QUICK_REFERENCE.md - "Template Syntax Cheat Sheet"
2. Define identifiers matching question identifiers
3. Use FOR EACH for repeatable questions
4. Use IF for conditional sections
5. Preview at `/documents/preview` to check missing identifiers

### Defining Questions
1. Create QuestionGroup with identifier (e.g., "client_info")
2. Create Questions with identifiers (e.g., "client_info.name")
3. Set question_type (person, date, text, etc.)
4. If repeatable, set repeatable=true and repeatable_group_id
5. Options/database_* fields for choice questions

### Merging Documents
1. POST /documents/generate with session_id and template_id
2. Response includes markdown_content (merged)
3. Word file available at POST /documents/merge

### Debugging Template Issues
1. Use POST /documents/preview to see merged content
2. Check missing_identifiers vs available_identifiers
3. Verify question identifiers match template placeholders
4. Check /tmp/quill_html_debug.html for Word generation issues

---

## Important Files by Purpose

| Need to... | File | Section |
|-----------|------|---------|
| Understand template system | CODEBASE_ANALYSIS.md | Template Structure |
| Write templates | QUICK_REFERENCE.md | Template Syntax Cheat Sheet |
| Debug templates | QUICK_REFERENCE.md | Debugging Tips |
| Understand data flow | CODEBASE_ANALYSIS.md | Data Flow Diagram |
| Work with models | CODEBASE_ANALYSIS.md | Models sections |
| Understand merging | CODEBASE_ANALYSIS.md | Document Generation System |
| Use API endpoints | QUICK_REFERENCE.md | API Endpoints Quick List |
| Find source code | CODEBASE_ANALYSIS.md | File Locations |
| Understand page breaks | CODEBASE_ANALYSIS.md | Recent Changes |
| Debug Word generation | QUICK_REFERENCE.md | Debugging Tips |

---

## Quick Command Reference

### API Endpoints
```bash
# Generate document
POST /documents/generate
{
  "session_id": 1,
  "template_id": 1,
  "document_name": "My Document"
}

# Preview merge
POST /documents/preview?session_id=1&template_id=1

# Download Word file
POST /documents/merge
{
  "session_id": 1,
  "template_id": 1
}

# Upload template file
POST /templates/upload (multipart/form-data)
```

### Template Syntax Quick Reference
```
# Variable
<<identifier>>

# Loop
{{ FOR EACH <<id>> }}
  Content: <<id>>
{{ END FOR EACH }}

# Conditional
{{ IF <<status>> = "active" }}
  Active!
{{ END IF }}

# Counter
Beneficiary ##: <<name>>

# Page break
<p>

# Line break
<cr>
```

---

## Version & Technology Stack

**Backend**:
- Python 3.11+
- FastAPI
- SQLAlchemy ORM
- python-docx (Word generation)
- mammoth (Word to Markdown)
- pdfplumber/PyPDF2 (PDF extraction)
- OpenAI Vision API (OCR for images)

**Frontend**:
- React + TypeScript
- Axios (API client)
- Styled Components
- Quill editor (rich text)

**Storage**:
- S3 (merged document content)
- PostgreSQL (metadata and answers)

---

## Getting Help

1. **Syntax questions**: See QUICK_REFERENCE.md - "Template Syntax Cheat Sheet"
2. **Architecture**: See CODEBASE_ANALYSIS.md sections 1-12
3. **Debugging**: See QUICK_REFERENCE.md - "Debugging Tips"
4. **API usage**: See QUICK_REFERENCE.md - "API Endpoints Quick List"
5. **Data models**: See CODEBASE_ANALYSIS.md - "Models sections"

---

**Last Updated**: March 28, 2026
**Analysis Scope**: Full codebase including recent commits
**Documentation Format**: Markdown
