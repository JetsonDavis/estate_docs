# E2E Test Suite

**Total Tests: 66** | **Test Files: 14** | **Browser: Chromium**

---

## Summary by Category

| Category | File | Tests |
|----------|------|-------|
| FOR EACH Template Merge | `foreach-loop.spec.ts` | 3 |
| Conditional Insertion | `insert-conditional-button.spec.ts` | 2 |
| Multiple Repeatable Groups | `multiple-repeatable-groups.spec.ts` | 4 |
| Nested Question Persistence | `nested-question-persistence.spec.ts` | 1 |
| Person Name Persistence | `person-name-persistence.spec.ts` | 2 |
| Comprehensive | `question-group-comprehensive.spec.ts` | 3 |
| Conditionals | `question-group-conditionals.spec.ts` | 4 |
| Deletion | `question-group-deletion.spec.ts` | 8 |
| Randomized / Stress | `question-group-randomized.spec.ts` | 5 |
| Reordering & Insertion | `question-group-reordering.spec.ts` | 5 |
| Repeatables (Admin UI) | `question-group-repeatables.spec.ts` | 4 |
| Repeatable Input Deletion | `repeatable-input-deletion.spec.ts` | 7 |
| Repeatable Input Persistence | `repeatable-input-persistence.spec.ts` | 5 |
| Repeatable Nested Conditionals | `repeatable-nested-conditionals.spec.ts` | 9 |
| Repeatable Person Deletion | `repeatable-person-deletion.spec.ts` | 5 |
| | **Total** | **66** |

---

## Full Test List

### 1. FOR EACH Loop Template Merge (`foreach-loop.spec.ts`)

| # | Test Name |
|---|-----------|
| 1 | FOR EACH should expand repeatable answers into repeated blocks |
| 2 | FOR EACH should expand person-type repeatable answers via preview |
| 3 | FOR EACH WHERE should filter repeatable entries by condition |

### 2. Insert Conditional Button (`insert-conditional-button.spec.ts`)

| # | Test Name |
|---|-----------|
| 3 | should insert conditional at ROOT level with gray background |
| 4 | should insert follow-on conditional inside parent conditional |

### 3. Multiple Repeatable Groups (`multiple-repeatable-groups.spec.ts`)

| # | Test Name |
|---|-----------|
| 5 | should persist multiple repeatable groups independently |
| 6 | should handle deletion in one group without affecting others |
| 7 | should handle complex operations across multiple groups |
| 8 | should handle adding instances to multiple groups simultaneously |

### 4. Nested Question Persistence (`nested-question-persistence.spec.ts`)

| # | Test Name |
|---|-----------|
| 9 | nested question inside conditional should remain nested after page refresh |

### 5. Person Name Persistence (`person-name-persistence.spec.ts`)

| # | Test Name |
|---|-----------|
| 10 | should persist person name after entering and reloading |
| 11 | should persist multiple person names with conjunctions after reload |

### 6. Question Group Comprehensive Tests (`question-group-comprehensive.spec.ts`)

| # | Test Name |
|---|-----------|
| 12 | should handle complex nested structure with multiple features |
| 13 | should handle rapid question creation and deletion |
| 14 | should persist group metadata and questions together |

### 7. Question Group Conditionals (`question-group-conditionals.spec.ts`)

| # | Test Name |
|---|-----------|
| 15 | should handle conditional deletion and preserve remaining structure |
| 16 | should update conditional values and persist changes |
| 17 | should create multi-level nested conditionals |
| 18 | should handle different conditional operators |

### 8. Question Group Deletion Tests (`question-group-deletion.spec.ts`)

| # | Test Name |
|---|-----------|
| 19 | Test 1: Create 3 questions, delete 2nd, verify 2 remain |
| 20 | Test 2: Delete first question |
| 21 | Test 3: Delete last question |
| 22 | Test 4: Delete all questions one by one |
| 23 | Test 5: Delete multiple questions preserves order |
| 24 | Test 6: Create single question and delete it |
| 25 | Test 7: Add and delete conditional |
| 26 | Test 8: Delete second of two questions |

### 9. Question Group Randomized / Stress (`question-group-randomized.spec.ts`)

| # | Test Name |
|---|-----------|
| 27 | should handle random sequence of add/delete/insert operations |
| 28 | should correctly add questions at end after inserting in middle (bug regression) |
| 29 | should handle rapid add/delete cycles |
| 30 | should maintain correct order with mixed insert positions |
| 31 | should handle many questions without breaking |

### 10. Question Group Reordering & Insertion (`question-group-reordering.spec.ts`)

| # | Test Name |
|---|-----------|
| 32 | should insert question at the beginning |
| 33 | should insert question in the middle |
| 34 | should maintain question order after multiple operations |
| 35 | should handle question deletion and preserve order |
| 36 | should handle adding questions after conditional |

### 11. Question Group Repeatables — Admin UI (`question-group-repeatables.spec.ts`)

| # | Test Name |
|---|-----------|
| 37 | should display repeatable checkbox for questions |
| 38 | should toggle repeatable checkbox state |
| 39 | should display checkboxes for multiple questions |
| 40 | should handle repeatable question with conditional |

### 12. Repeatable Input Deletion (`repeatable-input-deletion.spec.ts`)

| # | Test Name |
|---|-----------|
| 41 | should delete first instance and persist remaining 4 |
| 42 | should delete middle instance (index 2 of 5) and persist remaining |
| 43 | should delete last instance and persist remaining |
| 44 | should delete multiple middle instances (index 1 and 3 of 5) |
| 45 | should delete all but one instance |
| 46 | should delete instance, add new one, then delete again |
| 47 | should handle deletion of middle instance with person type |

### 13. Repeatable Input Persistence (`repeatable-input-persistence.spec.ts`)

| # | Test Name |
|---|-----------|
| 48 | should persist 5 repeatable text inputs after reload |
| 49 | should persist 4 repeatable date inputs after reload |
| 50 | should persist 3 repeatable person inputs after reload |
| 51 | should persist 5 repeatable radio selections after reload |
| 52 | should handle mixed repeatable and non-repeatable fields |

### 14. Repeatable Nested Conditionals (`repeatable-nested-conditionals.spec.ts`)

| # | Test Name |
|---|-----------|
| 53 | Level 1: selecting "other" on repeatable question shows follow-up |
| 54 | Level 2: selecting "other2" inside follow-up shows deeper nested question |
| 55 | Level 1 alternative: selecting "car" shows different follow-up |
| 56 | Deep chain: all 3 levels of conditionals fire in sequence |
| 57 | Multiple instances: conditionals work independently per repeatable instance |
| 58 | All 10 levels of nested conditionals fire sequentially |
| 59 | Selecting "stop" at level 5 hides levels 6-10 |
| 60 | Answers at levels 4, 5, and 6 persist after page reload |
| 61 | Nested repeatable followup Q4 has its own Add Another that adds Q4, not Q2 |

### 15. Repeatable Person Deletion (`repeatable-person-deletion.spec.ts`)

| # | Test Name |
|---|-----------|
| 62 | should delete MIDDLE instance (index 1 of 3) and persist remaining 2 |
| 63 | should delete MIDDLE instance (index 2 of 5) and persist remaining 4 |
| 64 | should delete FIRST instance and persist remaining |
| 65 | should delete LAST instance and persist remaining |
| 66 | should handle multiple middle deletions (delete index 1, then index 1 again) |

---

## Running Tests

```bash
# Run all tests
cd frontend
npx playwright test e2e/ --reporter=line --timeout=120000

# Run a specific test file
npx playwright test e2e/foreach-loop.spec.ts --reporter=line --timeout=120000

# Run a specific test by name
npx playwright test e2e/ -g "should persist 5 repeatable text inputs" --reporter=line --timeout=120000

# List all tests without running them
npx playwright test e2e/ --list
```
