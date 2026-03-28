# Estate Docs Quick Reference Guide

## Template Syntax Cheat Sheet

### Basic Variable Replacement
```
{{identifier}}           # Replaces with answer value
<<client_name>>         # Also works (legacy syntax)
<<person.name>>         # Dot notation: access object field
<<trustee[0].name>>     # Array index access
```

### Control Structures

#### FOR EACH - Repeat block for array elements
```
{{ FOR EACH <<children>> }}
  Child #: <<children>>
{{ END FOR EACH }}

{{ FOR EACH(1) <<trustees>> }}    # Start counter at 1
  Trustee ##: <<trustees>>
{{ END FOR EACH }}

{{ FOR EACH <<people>> WHERE <<status>> = "active" }}
  Active person: <<people>>
{{ END FOR EACH }}
```

#### PEOPLELOOP - Group people by "then" conjunction
```
{{ PEOPLELOOP <<executors>> }}
  Executor: <<executors>>
{{ END PEOPLELOOP }}
```

#### IF/ELSE - Conditional inclusion
```
{{ IF <<marital_status>> = "married" }}
  Spouse: <<spouse_name>>
{{ ELSE }}
  Single status
{{ END }}

{{ IF <<has_children>> }}
  Children: <<children>>
{{ END }}
```

#### [[ ]] - Remove section if identifier is empty
```
[[ Beneficiary: <<beneficiary_name>> ]]
```

### Counters
```
## or ##(0)      # Numeric: 1, 2, 3, ...
## or ##(+1)     # Custom increment
###              # Words: One, Two, Three, ...
##%              # Ordinal: First, Second, Third, ...
##A              # Letters: A, B, C, ..., AA, AB, ...
#/A              # Reset letter counter
```

### Special Elements

#### Page Break
```
<p>              # Type literally in template, creates Word page break
<cr>             # Line break (creates new paragraph)
<CR>             # Also works for line break
```

#### Macros
```
@@ macro_name @@ Content with <<identifiers>> and variables @@

@ macro_name @  # Use macro
```

**Example with variable:**
```
@@ jeff @@ <<trustor.name>> @@

The trustor, @ jeff @, hereby declares...
```

---

## Data Types & Formatting

### Person Type
**Stored As**: JSON array with conjunctions
```json
[
  {"name": "John", "conjunction": "and"},
  {"name": "Jane", "conjunction": "then"},
  {"name": "Bob"}
]
```

**Rendered As**: "John and Jane, then Bob"

### Date Type
**Stored As**: ISO format `"2024-03-28"`
**Rendered As**: "March 28, 2024"

**For Arrays**: `["2024-03-28", "2024-04-15"]`
**Rendered As**: "March 28, 2024 and April 15, 2024"

### Repeatable Groups
- Questions with `repeatable: true` store multiple answers
- Each instance merged via conjunctions
- Group identifier: `repeatable_group_id`

---

## Key Files by Purpose

### Need to understand...

**How answers are stored?**
- `backend/src/models/session.py` - SessionAnswer model
- `backend/src/models/question.py` - Question types & repeatable logic

**How templates are structured?**
- `backend/src/models/template.py` - Template model
- `frontend/src/types/template.ts` - Frontend types

**How merging works?**
- `backend/src/services/document_service.py` - Lines 2006-2111: `_merge_template()`
- `backend/src/services/document_service.py` - Lines 618-660: regex patterns

**How Word docs are generated?**
- `backend/src/services/document_service.py` - Lines 23-238: HTMLToWordConverter
- `backend/src/services/document_service.py` - Lines 2356-2400: merge_document()

**How file uploads are converted?**
- `backend/src/utils/document_processor.py` - Conversion methods
- `backend/src/services/template_service.py` - Lines 168-261: process_uploaded_file()

**How documents are previewed/generated?**
- `backend/src/routers/documents.py` - API endpoints
- `frontend/src/services/documentService.ts` - Frontend API client

---

## Database Schema (Simplified)

```
Users
  ├─ Templates (created by user)
  │  └─ identifiers (extracted automatically)
  │
  └─ DocumentFlows/Questionnaires
     ├─ QuestionGroups
     │  └─ Questions
     │     ├─ identifier (e.g., "group.question")
     │     ├─ question_type (person, date, text, etc.)
     │     ├─ repeatable: Boolean
     │     └─ repeatable_group_id
     │
     └─ Sessions (InputForm)
        └─ SessionAnswers
           ├─ answer_value (raw or JSON)
           └─ question_id
```

---

## Common Template Patterns

### Repeatable Beneficiaries
```
{{ FOR EACH <<beneficiaries>> }}
  Beneficiary ##: <<beneficiaries>>
  Relationship: <<beneficiary_relation>>
{{ END FOR EACH }}
```

### Conditional Spouse Info
```
{{ IF <<marital_status>> = "married" }}
  Spouse Name: <<spouse_name>>
  Spouse DOB: <<spouse_dob>>
{{ END IF }}
```

### Multiple Trustees with Alternates
```
Primary Trustees:
{{ FOR EACH <<trustees>> }}
  ##. <<trustees>>
{{ END FOR EACH }}

{{ IF <<alternate_trustee>> }}
Alternate Trustee:
  <<alternate_trustee>>
{{ END IF }}
```

### Signature Page
```
Client: ___________________________________
        <<client_name>>

Date: ___________________________________

Witnessed by:
{{ FOR EACH <<witnesses>> }}
  ##. ____________________
      <<witnesses>>
{{ END FOR EACH }}
```

---

## Identifier Naming Conventions

### Recommended Patterns
- **Namespace**: `groupname.fieldname`
  - Example: `trustee.name`, `beneficiary.amount`
- **Direct**: `field_name`
  - Example: `client_name`, `execution_date`
- **Repeatable**: Same as direct, stored as array
  - Example: `children` -> `["John", "Jane"]`
- **Person Fields**: `person.field_notation`
  - Example: `trustee.name`, `executor.address`

### Special Characters to Avoid
- No spaces
- No special punctuation (use underscores instead)
- No angle brackets in values

---

## Merge Process Flow (6 Passes)

1. **Pass 0: Macros**
   - Extract `@@ name @@ content @@` definitions
   - Replace `@ name @` usage with macro content

2. **Pass 1: FOR EACH**
   - Expand array loops
   - Apply WHERE filters
   - Support indexed access

3. **Pass 1.5: PEOPLELOOP**
   - Group by "then" conjunction
   - Handle person-specific iteration

4. **Pass 2: IF/ELSE**
   - Evaluate conditions
   - Keep/remove blocks

5. **Pass 3: [[ ]]**
   - Remove if identifier empty

6. **Pass 4: Counters**
   - Replace ##, ###, ##%, ##A

7. **Pass 5: Identifiers**
   - Replace <<id>> with values
   - Handle dot notation

**Output**: HTML → **HTMLToWordConverter** → Word (.docx)

---

## Debugging Tips

### Template Issues?
1. Check `/documents/preview` endpoint first
2. Review `missing_identifiers` list
3. Verify question identifiers match template placeholders
4. Test simple replacements before complex loops

### Word Generation Issues?
1. Check `/tmp/quill_html_debug.html` (debug file)
2. Verify HTML structure is valid
3. Test HTMLToWordConverter with simple content
4. Check Quill formatting classes (`ql-indent-*`, `ql-align-*`)

### Counter Not Working?
1. Must be in loop context (FOR EACH, etc.)
2. Each loop has its own counter
3. Use `#/A` to reset letter counter

### Repeatable Group Issues?
1. Verify `repeatable_group_id` set on all questions
2. Check conjunction field on person objects
3. Ensure all variants stored in same array

---

## API Endpoints Quick List

```
POST   /documents/generate    - Create & save document
POST   /documents/preview     - Preview merge
GET    /documents/            - List all documents
GET    /documents/{id}        - Get one document
DELETE /documents/{id}        - Delete document
POST   /documents/merge       - Merge and download Word

POST   /templates/            - Create template
GET    /templates/            - List templates
GET    /templates/{id}        - Get template
PUT    /templates/{id}        - Update template
DELETE /templates/{id}        - Delete template
POST   /templates/upload      - Upload file
```

---

## Performance Notes

- Templates with large arrays (100+ items) may slow generation
- FOR EACH WITH WHERE clause is O(n) filtering
- Complex nested conditionals tested with depth-counting regex
- S3 storage reduces database size for merged documents
- Consider pagination for template lists (default: 100 per page)

---

## Version Info

- **Python**: 3.11+
- **FastAPI**: Latest
- **SQLAlchemy**: ORM for models
- **python-docx**: Word document generation
- **mammoth**: Word to Markdown conversion
- **pdfplumber/PyPDF2**: PDF extraction
- **OpenAI**: Vision API for OCR

