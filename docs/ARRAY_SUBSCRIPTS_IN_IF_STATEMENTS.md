# Array Subscripts in IF Statements

## Issue Report
User reported: "subscripts are not working in the if statement"

## Investigation Results

**Finding**: Array subscripts ARE working correctly in IF statements. The issue was a **misunderstanding about comparison behavior**, not a bug.

## How IF Comparisons Work

IF statement comparisons are **exact** (case-insensitive), NOT partial matches.

### ✅ Correct Usage

```
{{ IF <<names[1]>> = "Alice" }}
First name is Alice
{{ END }}
```

**When it works**: If `names[1]` contains exactly `"Alice"` (or any case variant like `"alice"`, `"ALICE"`)

### ❌ Common Mistake

```
{{ IF <<trustee[1].name>> = "Alice" }}
First trustee is Alice
{{ END }}
```

**Why it fails**: If the `name` field contains `"Alice Smith"`, this comparison fails because:
- Actual value: `"Alice Smith"`
- Expected value: `"Alice"`
- Result: `"alice smith" != "alice"` → **False**

### ✅ Correct Fix

```
{{ IF <<trustee[1].name>> = "Alice Smith" }}
First trustee is Alice
{{ END }}
```

**Why it works**: Now comparing `"Alice Smith"` with `"Alice Smith"` → **True**

## Supported Array Subscript Syntax in IF Statements

### 1. Simple Array Elements

```
{{ IF <<names[1]>> = "Alice" }}
{{ IF <<names[2]>> != "Bob" }}
{{ IF <<beneficiary[3]>> }}
{{ IF NOT <<beneficiary[10]>> }}
```

### 2. Person Fields with Array Subscripts

```
{{ IF <<trustee[1].name>> = "John Smith" }}
{{ IF <<trustee[1].email>> }}
{{ IF <<beneficiary[2].phone>> != "" }}
```

### 3. Nested Address Fields

```
{{ IF <<trustee[1].mailing_address.city>> = "Austin" }}
{{ IF <<beneficiary[2].physical_address.state>> = "TX" }}
```

### 4. Out-of-Bounds Handling

```
{{ IF <<names[10]>> }}
  Has 10th element
{{ ELSE }}
  No 10th element (out of bounds treated as empty)
{{ END }}
```

### 5. Nested IF Statements

```
{{ IF <<trustee[1]>> }}
  Primary trustee: <<trustee[1].name>>
  {{ IF <<trustee[1].name>> = "Alice Smith" }}
    Alice is the primary trustee
  {{ END }}
{{ END }}
```

## Test Coverage

Created comprehensive test suite: [test_if_with_array_index.py](../backend/tests/unit/test_if_with_array_index.py)

**8 tests covering**:
- ✅ Equals comparison with array subscripts
- ✅ Not-equals comparison
- ✅ False condition handling
- ✅ Person fields with array subscripts
- ✅ Empty/existence checks
- ✅ Out-of-bounds array indices
- ✅ `IF NOT` with array subscripts
- ✅ Nested IF statements with array subscripts

**All tests pass** ✓

## Implementation Details

### Code Location
Array subscript resolution in IF statements is handled by:

1. **[document_service.py:1387-1435](../backend/src/services/document_service.py#L1387-L1435)**: `_resolve_identifier_value()`
   - Regex pattern: `^([^\[]+)\[(\d+)\](?:\.(.+))?$`
   - Supports: `identifier[N]`, `identifier[N].field`, `identifier[N].nested.field`
   - Converts 1-based index to 0-based for array access

2. **[document_service.py:1465-1578](../backend/src/services/document_service.py#L1465-L1578)**: `_evaluate_if_condition()`
   - Extracts identifier from IF condition
   - Calls `_resolve_identifier_value()` to get the value
   - Performs case-insensitive exact comparison

### How It Works

```python
# For: {{ IF <<trustee[1].name>> = "Alice Smith" }}

1. Parse condition: '<<trustee[1].name>> = "Alice Smith"'
2. Extract identifier: 'trustee[1].name'
3. Resolve value:
   - Base: 'trustee'
   - Index: 1 (converted to 0 for array)
   - Field: 'name'
   - Result: "Alice Smith" (from raw_answer_map)
4. Compare: "alice smith" == "alice smith" → True
5. Include IF body in output
```

## Important Notes

1. **Comparisons are exact**: Use the full value stored in the field
2. **Case-insensitive**: `"Alice"`, `"alice"`, and `"ALICE"` all match
3. **No partial matching**: `"Alice Smith"` does NOT match `"Alice"`
4. **1-based indexing**: `[1]` refers to the first element
5. **Out-of-bounds = empty**: `[99]` on a 3-element array evaluates as empty

## Documentation Updates

Updated [TEMPLATE_SYNTAX.md](TEMPLATE_SYNTAX.md) with:
- New section: "IF with array subscripts" with examples
- New section: "IF with out-of-bounds array indices"
- Updated Quick Reference table to include array subscript syntax
- Clarified that comparisons are exact, not partial

## Summary

**No bug found**. Array subscripts work correctly in IF statements. The reported issue was due to comparing full names (like "Alice Smith") with partial names (like "Alice").

**Solution**: Use the exact value stored in the field when writing IF conditions.

**Example Fix**:
- ❌ Before: `{{ IF <<trustee[1].name>> = "Alice" }}`
- ✅ After: `{{ IF <<trustee[1].name>> = "Alice Smith" }}`
