# Question Groups Architecture Documentation

This document provides a comprehensive overview of how the Question Groups feature works in Estate Doc(tor), including the code structure, data models, and storage mechanisms.

## Table of Contents

1. [Overview](#overview)
2. [Data Models](#data-models)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend Architecture](#backend-architecture)
5. [API Endpoints](#api-endpoints)
6. [Question Logic System](#question-logic-system)
7. [Auto-Save Mechanism](#auto-save-mechanism)
8. [Key Workflows](#key-workflows)

---

## Overview

Question Groups are collections of questions that can be used to gather information for document generation. The system supports:

- **Multiple question types**: Text input, multiple choice, checkboxes, dropdowns, person selection, and date pickers
- **Conditional logic**: Questions can be shown/hidden based on answers to previous questions
- **Nested questions**: Questions can be nested inside conditionals
- **Repeatable questions**: Questions that can have multiple entries (e.g., listing multiple beneficiaries)
- **Auto-save**: Questions are automatically saved as the user types

---

## Data Models

### Database Schema (PostgreSQL/SQLite)

#### `question_groups` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `name` | VARCHAR(255) | Display name of the group |
| `description` | TEXT | Optional description |
| `identifier` | VARCHAR(100) | Unique identifier (used for namespacing questions) |
| `display_order` | INTEGER | Order in which groups are displayed |
| `question_logic` | JSON | Stores the ordering and conditional logic structure |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |
| `is_active` | BOOLEAN | Soft delete flag |

#### `questions` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `question_group_id` | INTEGER | Foreign key to question_groups |
| `question_text` | TEXT | The question displayed to users |
| `question_type` | VARCHAR(50) | Type: `free_text`, `multiple_choice`, `checkbox_group`, `dropdown`, `person`, `date`, `database_dropdown` |
| `identifier` | VARCHAR(100) | Unique namespaced identifier (format: `group_identifier.question_identifier`) |
| `repeatable` | BOOLEAN | Whether the question can have multiple entries |
| `repeatable_group_id` | VARCHAR(100) | Groups repeatable questions together |
| `display_order` | INTEGER | Order within the group |
| `is_required` | BOOLEAN | Whether an answer is required |
| `help_text` | TEXT | Optional help text |
| `options` | JSON | For multiple choice: `[{"value": "yes", "label": "Yes"}, ...]` |
| `database_table` | VARCHAR(100) | For database dropdowns: source table |
| `database_value_column` | VARCHAR(100) | Column for option values |
| `database_label_column` | VARCHAR(100) | Column for option labels |
| `person_display_mode` | VARCHAR(20) | `autocomplete` or `dropdown` |
| `include_time` | BOOLEAN | For date questions: include time picker |
| `validation_rules` | JSON | Custom validation rules |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |
| `is_active` | BOOLEAN | Soft delete flag |

### Backend Models

**Location**: `backend/src/models/question.py`

```python
class QuestionGroup(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "question_groups"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    identifier = Column(String(100), unique=True, nullable=False)
    display_order = Column(Integer, default=0)
    question_logic = Column(JSON, nullable=True)
    
    questions = relationship("Question", back_populates="question_group")

class Question(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "questions"
    
    id = Column(Integer, primary_key=True)
    question_group_id = Column(Integer, ForeignKey("question_groups.id"))
    question_text = Column(Text, nullable=False)
    question_type = Column(String(50), nullable=False)
    identifier = Column(String(100), unique=True, nullable=False)
    # ... additional fields
```

### Frontend Types

**Location**: `frontend/src/types/question.ts`

```typescript
export type QuestionType = 
  | 'multiple_choice' 
  | 'free_text' 
  | 'database_dropdown' 
  | 'checkbox_group' 
  | 'dropdown' 
  | 'person' 
  | 'date'

export interface Question {
  id: number
  question_group_id: number
  question_text: string
  question_type: QuestionType
  identifier: string
  repeatable: boolean
  repeatable_group_id: string | null
  display_order: number
  is_required: boolean
  options: QuestionOption[] | null
  // ... additional fields
}

export interface QuestionLogicItem {
  id: string
  type: 'question' | 'conditional'
  questionId?: number
  conditional?: {
    ifIdentifier: string
    operator?: ConditionalOperator
    value: string
    nestedItems: QuestionLogicItem[]
  }
  depth?: number
}
```

---

## Frontend Architecture

### Main Component

**Location**: `frontend/src/pages/admin/QuestionGroups.tsx`

The `QuestionGroups` component handles multiple views:

1. **List View** (`/admin/question-groups`) - Shows all question groups
2. **Create View** (`/admin/question-groups/new`) - Create new group
3. **Edit View** (`/admin/question-groups/:id/edit`) - Edit existing group

### Component Structure

```
QuestionGroups (main component)
├── List View (renders group cards)
└── CreateQuestionGroupForm (create/edit form)
    ├── Group Information Section
    │   ├── Name input
    │   └── Description input
    └── Questions Section
        ├── Question cards (main level)
        ├── Conditional blocks
        │   └── Nested questions
        └── Add Question / Add Conditional buttons
```

### Key State Variables

```typescript
// In CreateQuestionGroupForm
const [name, setName] = useState('')
const [description, setDescription] = useState('')
const [questions, setQuestions] = useState<QuestionFormData[]>([])
const [questionLogic, setQuestionLogic] = useState<QuestionLogicItem[]>([])
const [savedGroupId, setSavedGroupId] = useState<number | null>(null)
const savedGroupIdRef = useRef<number | null>(null)
const nestedQuestionIdsRef = useRef<Set<string>>(new Set())
```

### QuestionFormData Interface

This is the frontend representation of a question being edited:

```typescript
interface QuestionFormData {
  id: string                    // Local ID (timestamp-based)
  question_text: string
  question_type: QuestionType
  identifier: string            // User-entered identifier (without namespace)
  repeatable: boolean
  repeatable_group_id?: string
  is_required: boolean
  options: QuestionOption[]
  person_display_mode?: string
  include_time?: boolean
  dbId?: number                 // Database ID (set after save)
  isSaving?: boolean
  lastSaved?: Date
  isDuplicateIdentifier?: boolean
  isCheckingIdentifier?: boolean
}
```

---

## Backend Architecture

### Service Layer

**Location**: `backend/src/services/question_service.py`

```python
class QuestionGroupService:
    @staticmethod
    def create_question_group(db, group_data) -> QuestionGroup
    
    @staticmethod
    def update_question_group(db, group_id, group_data) -> QuestionGroup
    
    @staticmethod
    def delete_question_group(db, group_id) -> bool

class QuestionService:
    @staticmethod
    def create_question(db, question_data) -> Question
    
    @staticmethod
    def update_question(db, question_id, question_data) -> Question
    
    @staticmethod
    def delete_question(db, question_id) -> bool
```

### Identifier Namespacing

Questions have namespaced identifiers to ensure global uniqueness:

```
Format: {group_identifier}.{question_identifier}
Example: trust_agreement.beneficiary_name
```

The frontend displays only the question identifier (e.g., `beneficiary_name`), while the backend stores the full namespaced version.

---

## API Endpoints

**Base URL**: `/api/v1/question-groups`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all question groups |
| GET | `/{group_id}` | Get group with all questions |
| POST | `/` | Create new question group |
| PUT | `/{group_id}` | Update question group |
| DELETE | `/{group_id}` | Delete question group |
| POST | `/{group_id}/questions` | Create question in group |
| GET | `/{group_id}/questions` | List questions in group |
| PUT | `/questions/{question_id}` | Update question |
| DELETE | `/questions/{question_id}` | Delete question |
| GET | `/questions/check-identifier` | Check identifier uniqueness |

### Request/Response Examples

**Create Question Group**
```json
POST /api/v1/question-groups
{
  "name": "Trust Agreement",
  "description": "Questions for trust documents",
  "identifier": "trust_agreement",
  "display_order": 0
}
```

**Create Question**
```json
POST /api/v1/question-groups/1/questions
{
  "question_group_id": 1,
  "question_text": "What is the beneficiary's name?",
  "question_type": "free_text",
  "identifier": "beneficiary_name",
  "repeatable": false,
  "is_required": true,
  "display_order": 0
}
```

**Update Question Logic**
```json
PUT /api/v1/question-groups/1
{
  "question_logic": [
    { "id": "1", "type": "question", "questionId": 101 },
    { "id": "2", "type": "question", "questionId": 102 },
    {
      "id": "3",
      "type": "conditional",
      "conditional": {
        "ifIdentifier": "has_spouse",
        "operator": "equals",
        "value": "yes",
        "nestedItems": [
          { "id": "4", "type": "question", "questionId": 103 }
        ]
      }
    }
  ]
}
```

---

## Question Logic System

The `question_logic` field stores the display order and conditional structure of questions.

### Structure

```typescript
interface QuestionLogicItem {
  id: string                    // Unique ID for this logic item
  type: 'question' | 'conditional'
  questionId?: number           // Database ID of the question (for type='question')
  conditional?: {
    ifIdentifier: string        // Identifier of the question to check
    operator?: ConditionalOperator  // 'equals', 'not_equals', 'count_greater_than', etc.
    value: string               // Value to compare against
    nestedItems: QuestionLogicItem[]  // Questions shown when condition is true
    endFlow?: boolean           // Stop the flow if condition is met
  }
  depth?: number                // Nesting level (0 = root)
}
```

### Example Question Logic

```json
[
  {
    "id": "1708123456789",
    "type": "question",
    "questionId": 101
  },
  {
    "id": "1708123456790",
    "type": "question",
    "questionId": 102
  },
  {
    "id": "1708123456791",
    "type": "conditional",
    "conditional": {
      "ifIdentifier": "marital_status",
      "operator": "equals",
      "value": "married",
      "nestedItems": [
        {
          "id": "1708123456792",
          "type": "question",
          "questionId": 103
        },
        {
          "id": "1708123456793",
          "type": "question",
          "questionId": 104
        }
      ]
    }
  },
  {
    "id": "1708123456794",
    "type": "question",
    "questionId": 105
  }
]
```

This represents:
1. Question 101 (always shown)
2. Question 102 (always shown)
3. Conditional: If marital_status equals "married"
   - Question 103 (nested)
   - Question 104 (nested)
4. Question 105 (always shown)

### Conditional Operators

| Operator | Description |
|----------|-------------|
| `equals` | Value matches exactly |
| `not_equals` | Value does not match |
| `count_greater_than` | For repeatable questions: entry count > value |
| `count_equals` | For repeatable questions: entry count = value |
| `count_less_than` | For repeatable questions: entry count < value |

---

## Auto-Save Mechanism

Questions are automatically saved when the user enters an identifier.

### Flow

1. User types in identifier field
2. `updateQuestion()` is called with the new value
3. `checkIdentifierUniqueness()` verifies the identifier is unique
4. `triggerAutoSave()` debounces the save (1 second delay)
5. `autoSaveQuestion()` makes the API call

### Key Functions

```typescript
// Trigger auto-save with debounce
const triggerAutoSave = (question: QuestionFormData) => {
  const currentGroupId = savedGroupIdRef.current
  if (!currentGroupId) return
  
  // Clear existing timeout
  if (autoSaveTimeoutRefs.current[question.id]) {
    clearTimeout(autoSaveTimeoutRefs.current[question.id])
  }
  
  // Set new timeout (1 second debounce)
  autoSaveTimeoutRefs.current[question.id] = setTimeout(() => {
    autoSaveQuestion(question)
  }, 1000)
}

// Perform the actual save
const autoSaveQuestion = async (question: QuestionFormData) => {
  const currentGroupId = savedGroupIdRef.current
  if (!currentGroupId) return
  if (!question.identifier.trim()) return
  if (question.isDuplicateIdentifier) return
  
  if (question.dbId) {
    // Update existing question
    await questionGroupService.updateQuestion(question.dbId, {...})
  } else {
    // Create new question
    const created = await questionGroupService.createQuestion(currentGroupId, {...})
    // Store the database ID
    question.dbId = created.id
    // Update questionLogic with the new questionId
    updateQuestionLogicWithDbId(question.id, created.id)
  }
}
```

### Handling Nested Questions

Nested questions (inside conditionals) use a ref to track their IDs immediately:

```typescript
const nestedQuestionIdsRef = useRef<Set<string>>(new Set())

// When adding a nested question
if (parentPath && parentPath.length > 0) {
  nestedQuestionIdsRef.current.add(newQuestion.id)
  // ... add to questionLogic
}

// When computing main level questions
const mainLevelQuestions = questions.filter(q => {
  if (nestedQuestionIdsRef.current.has(q.id)) return false
  // ... other filters
})
```

---

## Key Workflows

### Creating a New Question Group

1. User enters group name
2. System generates identifier from name (lowercase, underscores)
3. System checks if identifier is unique
4. Group is saved to database
5. User can now add questions

### Adding a Question

1. User clicks "Add Question"
2. New `QuestionFormData` is created with local ID
3. New `QuestionLogicItem` is added to `questionLogic`
4. User enters identifier
5. System checks identifier uniqueness
6. Question is auto-saved to database
7. `questionLogic` is updated with database ID

### Adding a Conditional

1. User clicks "Add Conditional"
2. New conditional `QuestionLogicItem` is created
3. A nested question is automatically created inside
4. User configures the condition (ifIdentifier, operator, value)
5. User can add more nested questions

### Editing an Existing Group

1. Group data is loaded from API
2. Questions are loaded and converted to `QuestionFormData`
3. `questionLogic` is loaded (or reconstructed from questions)
4. Changes are auto-saved as user edits

### Deleting a Question

1. User clicks delete button
2. Question is removed from `questions` state
3. Question is removed from `questionLogic`
4. API call deletes from database

---

## File Structure

```
backend/
├── src/
│   ├── models/
│   │   └── question.py          # QuestionGroup and Question models
│   ├── schemas/
│   │   └── question.py          # Pydantic schemas for validation
│   ├── services/
│   │   └── question_service.py  # Business logic
│   └── routers/
│       └── question_groups.py   # API endpoints

frontend/
├── src/
│   ├── types/
│   │   └── question.ts          # TypeScript interfaces
│   ├── services/
│   │   └── questionService.ts   # API client
│   └── pages/
│       └── admin/
│           ├── QuestionGroups.tsx   # Main component
│           └── QuestionGroups.css   # Styles
```

---

## Important Implementation Notes

1. **Identifier Namespacing**: Question identifiers are stored with a namespace prefix (`group.question`) but displayed without it to users.

2. **Question Logic vs Questions**: The `questions` array holds the question data, while `questionLogic` holds the display order and conditional structure. Both must be kept in sync.

3. **Local IDs vs Database IDs**: Questions have a local `id` (timestamp-based string) used for React keys and tracking, and a `dbId` (number) that's set after saving to the database.

4. **Nested Question Tracking**: The `nestedQuestionIdsRef` ref is used to immediately track which questions are nested, preventing them from appearing at the root level during React's batched state updates.

5. **Soft Delete**: Both question groups and questions use soft delete (`is_active` flag) rather than hard delete, preserving data integrity.

6. **Optimistic Updates**: Deletions are optimistic - the UI updates immediately while the API call happens in the background.
