# Estate Docs Codebase - Comprehensive Analysis

## Project Overview
Estate Docs is a full-stack estate planning document generation platform that enables users to:
- Fill out questionnaires (input forms) with hierarchical question groups
- Define document templates with placeholder identifiers
- Merge session answers into templates to generate Word documents (.docx)
- Support complex logic including conditionals, loops, and variable substitution

---

## 1. TEMPLATE STRUCTURE

### Template Model (`backend/src/models/template.py`)
```python
class Template(Base, TimestampMixin, SoftDeleteMixin):
    id: Integer (primary key)
    name: String(255) - unique template name
    description: Text - optional description
    template_type: String(50) - 'word', 'pdf', 'image', or 'direct'
    original_filename: String(255) - source file name
    original_file_path: String(500) - path to uploaded file
    markdown_content: Text - MAIN CONTENT (stores HTML from Quill editor)
    identifiers: Text - comma-separated list of found identifiers (e.g., "client_name,client_dob,trustee_name")
    created_by: Integer (FK to users)
    created_at, updated_at, is_active
```

### Template Identifier Extraction
- **Pattern**: `<<identifier>>` or `<<namespace.field>>`
- **Regex**: `r'<<([^>]+)>>'`
- **Examples**:
  - `<<client_name>>` - direct identifier
  - `<<person.name>>` - dot notation for person object field access
  - `<<trustee_address>>` - repeatable identifier

**Key Method**: `Template.extract_identifiers()` returns unique identifiers from markdown

### Frontend Template Types (`frontend/src/types/template.ts`)
- `TemplateCreate` - new template creation request
- `TemplateUpdate` - partial template updates
- `TemplateListResponse` - paginated template list
- `TemplateIdentifiersResponse` - list of identifiers in a template

---

## 2. QUESTION TYPES & DATA PROCESSING

### Question Types (`backend/src/models/question.py`)
```python
class QuestionType(str, enum.Enum):
    MULTIPLE_CHOICE = "multiple_choice"
    FREE_TEXT = "free_text"
    DATABASE_DROPDOWN = "database_dropdown"
    PERSON = "person"                    # Special: stores JSON array of person objects
    PERSON_BACKUP = "person_backup"      # Alternative person type
    DATE = "date"                        # Special: stores ISO date strings
    CHECKBOX_GROUP = "checkbox_group"
    DROPDOWN = "dropdown"
```

### Question Model Structure
```python
class Question:
    question_group_id: Integer (FK)
    question_text: Text
    question_type: String(50)
    identifier: String(100) - UNIQUE within group (e.g., "group.subquestion")
    repeatable: Boolean - whether question can be answered multiple times
    repeatable_group_id: String(100) - groups repeatable questions together
    display_order: Integer
    is_required: Boolean
    help_text: Text
    options: JSON - for multiple choice: [{"value": "m", "label": "Male"}, ...]
    database_table: String - for database dropdown type
    database_value_column: String
    database_label_column: String
    person_display_mode: String - 'autocomplete' or 'dropdown'
    include_time: Boolean - for date type
    validation_rules: JSON - {"min_length": 5, "max_length": 100, "pattern": "regex"}
```

### Data Storage Format

#### Person Type Answers
Stored as JSON array with conjunctions:
```json
[
  {"name": "John Smith", "conjunction": "and"},
  {"name": "Jane Doe", "conjunction": "then"},
  {"name": "Bob Wilson"}
]
```

#### Date Type Answers
- Single date: `"2024-03-28"` (ISO format)
- Array of dates: `["2024-03-28", "2024-04-15"]` (repeatable)
- **Display Format**: "March 28, 2024" (built by `_format_answer_value()`)

#### Repeatable Questions
- Multiple instances stored as JSON arrays
- Each instance can be filtered by `repeatable_group_id`
- Tracked via `repeatable_group_id` for conjunction-based formatting

---

## 3. DOCUMENT GENERATION SYSTEM

### Architecture: Three Main Components

#### A. Template Merging (`DocumentService._merge_template()`)
Processes template in 6 sequential passes:

**Pass 0: Macros**
- Extract and expand `@@ macro_name @@ content @@` definitions
- Macro usage: `@ macro_name @`
- Macros can contain identifiers like `<<trustor.name>>` which are resolved in Pass 5

**Pass 1: FOR EACH Loops**
```
{{ FOR EACH identifier }}
  ... content repeated for each array element ...
{{ END FOR EACH }}
```
- Supports indexed arrays: `{{ FOR EACH(1) <<id>> }}`
- Supports WHERE filtering: `{{ FOR EACH <<id>> WHERE <<field>> = "value" }}`
- Pre-compiled regex: `_FOREACH_OPEN_RE`, `_FOREACH_CLOSE_RE`

**Pass 1.5: PEOPLELOOP**
```
{{ PEOPLELOOP <<person_identifier>> }}
  ... repeated for each person, grouped by "then" conjunctions ...
{{ END PEOPLELOOP }}
```

**Pass 2: IF/ELSE Conditionals**
```
{{ IF condition }}
  ... content if true ...
{{ ELSE }}
  ... content if false ...
{{ END }}
```
- Supports: `<<identifier>>`, `<<identifier>> = "value"`, `<<identifier>> != "value"`

**Pass 3: Conditional Sections**
```
[[ <<identifier>> content ]]
```
- Removed if identifier is empty/null

**Pass 4: Counter Tokens**
- `##` - numeric counter (1, 2, 3, ...)
- `###` - word counter (One, Two, Three, ...)
- `##%` - ordinal counter (First, Second, Third, ...)
- `##A` - letter counter (A, B, C, ..., AA, AB, ...)
- Syntax: `##` or `##(+5)` to increment by custom amount

**Pass 5: Identifier Replacement**
- Replace `<<identifier>>` with formatted answer value
- Support for dot notation: `<<person.name>>` extracts field from person object

#### B. HTML-to-Word Conversion (`HTMLToWordConverter`)
Custom HTML parser that converts merged HTML to Word (.docx):

**Supported HTML Tags**:
- `<p>` - paragraph (creates Word paragraph)
- `<br>` - line break (converts to paragraph break)
- `<pagebreak>` or `<p>` marker - PAGE BREAK MACRO (inserts Word page break)
- `<strong>`, `<b>` - bold
- `<em>`, `<i>` - italic
- `<u>` - underline
- `<span>` - inline styling
- `<ul>`, `<ol>`, `<li>` - lists
- Style attribute support for font-size, color, text-align

**Special Handling**:
- Quill classes: `ql-indent-*`, `ql-align-*`, `ql-size-*`
- Tab preservation via explicit `\t` characters
- Font size from CSS: extracts px values and converts to Word Pt

#### C. Page Break Macro (`<p>`)
**Recent Addition** (commit 0be7250):
- User types `<p>` in template text
- Stored as `&lt;p&gt;` in HTML from Quill editor
- Protected before HTML unescaping via: `r'&lt;[pP]&gt;' -> '__PAGE_BREAK__'`
- Converted to: `</p><pagebreak/><p>` before Word generation
- HTMLToWordConverter handles `<pagebreak>` tag via `WD_BREAK.PAGE`

---

## 4. DOCUMENT GENERATION FLOW

### Backend Pipeline (`backend/src/services/document_service.py`)

#### Step 1: Data Collection
```python
DocumentService.generate_document(db, request, user_id):
  - Fetch template from DB
  - Fetch session and all answers
  - Join answer_question_pairs via SQLAlchemy ORM
```

#### Step 2: Build Maps
```python
# answer_map: identifier -> formatted_value
# Examples: {"client_name": "John Doe", "client_dob": "March 15, 1980"}
answer_map = _build_answer_map(answer_pairs)

# raw_answer_map: identifier -> raw_value (for array parsing)
# Preserves JSON arrays for FOR EACH loops
raw_answer_map = _build_raw_answer_map(answer_pairs)

# conjunction_map: repeatable_group_id -> [conjunctions]
# identifier_group_map: identifier -> repeatable_group_id
conj_map, id_grp_map = _build_conjunction_info(answer_pairs)
```

#### Step 3: Format Answers
**Person Type Formatting** (`_format_answer_value()`):
```
Input: [{"name": "John", "conjunction": "and"}, {"name": "Jane"}]
Output: "John and Jane"
```

**Date Type Formatting**:
```
Input: "2024-03-28"
Output: "March 28, 2024"
```

#### Step 4: Merge Template
```python
merged_content = _merge_template(
    template.markdown_content,
    answer_map,
    raw_answer_map,
    conj_map,
    id_grp_map
)
# Output: HTML with all identifiers replaced
```

#### Step 5: Generate Word Document
```python
doc = Document()
parser = HTMLToWordConverter(doc)
parser.feed(merged_content)
# Output: .docx bytes
```

#### Step 6: Store in S3
```python
s3_key = s3_service.upload_markdown(merged_content, document.id, user_id)
document.s3_key = s3_key
document.markdown_content = merged_content  # Also attach to response
```

---

## 5. QUESTION & SESSION MODELS

### QuestionGroup Model
```python
class QuestionGroup:
    name: String
    identifier: String (unique) - e.g., "client_info", "trustees"
    description: Text
    display_order: Integer
    question_logic: JSON - [
        { "type": "question", "questionId": 1 },
        { "type": "conditional", "ifIdentifier": "marital_status", 
          "value": "married", "nestedItems": [...] }
    ]
    collapsed_items: JSON - UI state of collapsed conditionals
```

### Session (InputForm) Model
```python
class InputForm:
    client_identifier: String - display name for the questionnaire
    user_id: Integer (FK) - who owns this session
    flow_id: Integer (FK) - which flow/questionnaire this is for
    current_group_id: Integer (FK) - current position in questionnaire
    is_completed: Boolean
    completed_at: DateTime
    answers: Relationship to SessionAnswer objects
```

### SessionAnswer Model
```python
class SessionAnswer:
    session_id: Integer (FK)
    question_id: Integer (FK)
    answer_value: Text - the actual answer (JSON for person/date arrays)
```

---

## 6. DOCUMENT MODEL & S3 STORAGE

### GeneratedDocument Model
```python
class GeneratedDocument:
    session_id: Integer (FK)
    template_id: Integer (FK)
    document_name: String
    s3_key: String - S3 path to stored markdown
    markdown_content: Text (legacy, now in S3)
    pdf_content: LargeBinary (legacy)
    pdf_file_path: String (legacy)
    generated_by: Integer (FK to users)
    generated_at: DateTime
```

### S3 Service Integration
- Markdown content uploaded to S3 to reduce DB size
- Each document has unique S3 key
- Lazy-loaded when retrieving documents via `s3_service.download_markdown()`

---

## 7. DOCUMENT PROCESSOR UTILITIES

### File Format Conversion (`backend/src/utils/document_processor.py`)

#### Supported Input Formats
1. **Word** (.docx) - via `mammoth` library (primary) or `python-docx` (fallback)
2. **PDF** - via `pdfplumber` (primary) or `PyPDF2` (fallback)
3. **Text** (.txt) - raw text pass-through
4. **Images** (.jpg, .png, .tiff, .bmp) - via OpenAI Vision API for OCR
5. **PDF Images** (scanned PDFs) - via OpenAI Vision API for OCR

#### Key Methods
```python
DocumentProcessor.word_to_markdown(file_path) -> str
DocumentProcessor.pdf_to_markdown(file_path) -> str
DocumentProcessor.text_to_markdown(file_path) -> str
DocumentProcessor.ocr_image_with_openai(file_path) -> str
DocumentProcessor.extract_identifiers(content) -> list[str]
DocumentProcessor.save_uploaded_file(...) -> file_path
DocumentProcessor.save_markdown_file(...) -> file_path
```

#### Identifier Detection
After conversion, template service calls `template.extract_identifiers()` to find all placeholders.

---

## 8. API ENDPOINTS

### Template Endpoints
- `POST /templates/` - Create template
- `GET /templates/` - List templates (paginated)
- `GET /templates/{id}` - Get template
- `PUT /templates/{id}` - Update template
- `DELETE /templates/{id}` - Soft delete
- `POST /templates/upload` - Upload file and convert to template
- `GET /templates/{id}/identifiers` - Get identifiers in template

### Document Endpoints
- `POST /documents/generate` - Generate and save document
- `POST /documents/preview` - Preview merge without saving
- `GET /documents/` - List generated documents
- `GET /documents/{id}` - Get document
- `DELETE /documents/{id}` - Delete document
- `POST /documents/merge` - Merge and return Word file

---

## 9. FRONTEND SERVICES & TYPES

### documentService.ts
```typescript
generateDocument(data: GenerateDocumentRequest) -> Promise<GeneratedDocument>
previewDocument(sessionId, templateId) -> Promise<DocumentPreview>
getDocuments(page, pageSize) -> Promise<GeneratedDocumentListResponse>
getDocument(documentId) -> Promise<GeneratedDocument>
deleteDocument(documentId) -> Promise<void>
```

### Key Types
```typescript
interface Template {
  id, name, description, template_type, markdown_content, identifiers, ...
}

interface GeneratedDocument {
  id, session_id, template_id, document_name, markdown_content, ...
}

interface DocumentPreview {
  template_name, session_client, markdown_content,
  missing_identifiers, available_identifiers
}
```

---

## 10. VARIABLE SUBSTITUTION & FORMULA SYSTEM

### Identifier Types

#### 1. Direct Identifiers
```
<<client_name>> -> "John Smith"
<<client_dob>> -> "March 15, 1980"
```

#### 2. Namespaced Identifiers
```
<<person.name>> -> extract "name" field from person object
<<trustee.address>> -> extract "address" field
```

#### 3. Indexed Array Access (in FOR EACH)
```
{{ FOR EACH <<trustees>> }}
  Trustee: <<trustees[0]>>  (specific index)
  Or: <<trustees>>          (current loop instance)
{{ END FOR EACH }}
```

#### 4. Conjunctions & Formatting
```
[{"name": "John", "conjunction": "and"}, {"name": "Jane"}]
-> Formatted: "John and Jane"

[{"name": "A"}, {"name": "B", "conjunction": "then"}, {"name": "C"}]
-> Formatted: "A, then B, and C"
```

### Calculation/Formula Capabilities

#### Counter Tokens (Pseudo-Formulas)
```
## -> running number (1, 2, 3, ...)
### -> word number (One, Two, Three, ...)
##% -> ordinal (First, Second, Third, ...)
##A -> letter (A, B, C, ..., AA, AB, ...)
```

#### Conditional Logic (IF/ELSE)
```
{{ IF <<marital_status>> = "married" }}
  Spouse name: <<spouse_name>>
{{ ELSE }}
  No spouse information
{{ END }}
```

#### Array Iteration (FOR EACH)
```
{{ FOR EACH <<children>> }}
  Child: <<children>>
{{ END FOR EACH }}
```

#### Filtering (WHERE clause)
```
{{ FOR EACH <<beneficiaries>> WHERE <<status>> = "active" }}
  Active beneficiary: <<beneficiaries>>
{{ END FOR EACH }}
```

### NOT True Calculation System
- **No arithmetic** (no `+`, `-`, `*`, `/`)
- **No dynamic formulas** (no `=A1+B1` style Excel formulas)
- **No conditional calculations** (no `IF(x > 10, y, z)`)
- **String substitution only** with:
  - Variable replacement
  - Conditional inclusion/exclusion
  - Array iteration
  - Counter generation
  - Person conjunction formatting

---

## 11. RECENT CHANGES & PAGE BREAK MACRO

### Commit 0be7250: Page Break Macro
**Feature**: Users can type `<p>` in template to insert Word page breaks

**Implementation**:
1. User enters `<p>` in Quill rich text editor
2. Stored as `&lt;p&gt;` (HTML entity)
3. During template merge, protected: `r'&lt;[pP]&gt;' -> '__PAGE_BREAK__'`
4. After identifier replacement: `'__PAGE_BREAK__' -> '</p><pagebreak/><p>'`
5. HTMLToWordConverter handles `<pagebreak>` tag via `WD_BREAK.PAGE`

### Commit 1bd89c6: Insert Button Positioning
- Added insert buttons above Question 1
- Fixed Insert Conditional button placement (now inserts after current question)

---

## 12. DATA FLOW DIAGRAM

```
User Session (InputForms.tsx)
    ↓
    ├─→ Answer storage (SessionAnswer)
    │   - Links to Question via FK
    │   - Stores formatted/raw answer_value
    │
    ├─→ Template with identifiers (Template)
    │   - markdown_content from Quill editor
    │   - Contains <<identifier>> placeholders
    │   - identifiers field lists found placeholders
    │
    └─→ Document Generation
        1. Fetch template + all session answers
        2. Build answer_map (identifier -> formatted_value)
        3. Build raw_answer_map (for array parsing)
        4. _merge_template() with 6 passes:
           - Macros
           - FOR EACH loops
           - IF/ELSE conditionals
           - [[ ]] conditional sections
           - Counter tokens
           - Identifier replacement
        5. HTMLToWordConverter.feed(merged_html)
        6. Document.save() -> Word file bytes
```

---

## 13. FILE LOCATIONS

### Backend Core
- `/backend/src/models/template.py` - Template ORM model
- `/backend/src/models/question.py` - Question, QuestionGroup models
- `/backend/src/models/document.py` - GeneratedDocument model
- `/backend/src/models/session.py` - InputForm, SessionAnswer models
- `/backend/src/services/document_service.py` - Main merge & generation logic
- `/backend/src/services/template_service.py` - Template CRUD & extraction
- `/backend/src/utils/document_processor.py` - File conversion utilities
- `/backend/src/routers/documents.py` - Document API endpoints
- `/backend/src/routers/templates.py` - Template API endpoints

### Frontend Core
- `/frontend/src/types/template.ts` - TypeScript interfaces
- `/frontend/src/types/document.ts` - Document interfaces
- `/frontend/src/services/documentService.ts` - Frontend API client
- `/frontend/src/services/templateService.ts` - Template API client
- `/frontend/src/pages/InputForms.tsx` - Main questionnaire page
- `/frontend/src/pages/Documents.tsx` - Generated documents list

---

## Summary: Template System Architecture

| Component | Purpose | Location |
|-----------|---------|----------|
| **Template** | Stores markdown with `<<identifier>>` placeholders | `models/template.py` |
| **Identifier** | Placeholder syntax: `<<name>>` or `<<namespace.field>>` | `Template.extract_identifiers()` |
| **Question** | Stores answer options and validation rules | `models/question.py` |
| **SessionAnswer** | Actual user-provided answer to a question | `models/session.py` |
| **Merge Engine** | 6-pass template processing (FOR EACH, IF, counters, etc.) | `document_service._merge_template()` |
| **HTML-to-Word** | Converts merged HTML to .docx with formatting | `document_service.HTMLToWordConverter` |
| **Page Break Macro** | `<p>` inserts Word page break | Protected & converted in merge pass |
| **S3 Storage** | Merged markdown stored in cloud | `document.s3_key` |

