# Template Syntax Guide

This document describes the syntax available when writing document templates. Templates use markdown content with special placeholders that get replaced with session answers during document generation.

---

## Identifiers

Identifiers are placeholders that get replaced with the user's answers.

```
<<identifier>>
```

Example: `<<full_name>>` will be replaced with the answer to the question with identifier `full_name`.

### Dot Notation (Person Fields)

For person-type questions, use dot notation to access specific fields:

```
<<person_identifier.field>>
```

Available person fields:
- `<<person.name>>` — Full name
- `<<person.email>>` — Email address
- `<<person.phone>>` — Phone number
- `<<person.mailing_address.line1>>` — Street address
- `<<person.mailing_address.line2>>` — Apt/Suite
- `<<person.mailing_address.city>>` — City
- `<<person.mailing_address.state>>` — State
- `<<person.mailing_address.zip>>` — ZIP code
- `<<person.physical_address.line1>>` — Physical street address
- `<<person.physical_address.city>>` — Physical city
- (same pattern for other physical address fields)

---

## FOREACH Loops (Repeatable Groups)

Use `FOREACH` to repeat a section once per entry in a repeatable group.

```
{{ FOREACH identifier }}
...body repeated for each entry...
{{ END FOREACH }}
```

### Inside the loop body:

| Syntax | Description |
|--------|-------------|
| `<<identifier>>` | Resolves to the Nth element of the array |
| `##` | Replaced with the 1-based loop index (1, 2, 3, ...) |
| `<<identifier.field>>` | Extracts a specific field from person-type objects |

### Parallel Iteration

All array-valued identifiers inside the loop body resolve to their Nth element automatically. This means questions in the same repeatable group iterate in lockstep.

### Example

If you have a repeatable group with identifiers `beneficiary` (person type) and `beneficiary_share` (text), and the user entered 3 beneficiaries:

**Template:**
```
{{ FOREACH beneficiary }}
##. <<beneficiary.name>>, residing at <<beneficiary.mailing_address.line1>>, <<beneficiary.mailing_address.city>>, <<beneficiary.mailing_address.state>> <<beneficiary.mailing_address.zip>>, shall receive <<beneficiary_share>> of the estate.
{{ END FOREACH }}
```

**Output:**
```
1. John Smith, residing at 123 Main St, Austin, TX 78701, shall receive 50% of the estate.
2. Jane Doe, residing at 456 Oak Ave, Dallas, TX 75201, shall receive 30% of the estate.
3. Bob Johnson, residing at 789 Pine Rd, Houston, TX 77001, shall receive 20% of the estate.
```

---

## Conditional Sections

### IF — Include if identifier has a value

```
{{ IF <<identifier>> }}
This text appears only if the identifier has an answer.
{{ END }}
```

### IF NOT — Include if identifier is empty

```
{{ IF NOT <<identifier>> }}
This text appears only if the identifier has NO answer.
{{ END }}
```

### IF with value comparison

```
{{ IF <<identifier>> = "yes" }}
This text appears only if the identifier equals "yes".
{{ END }}
```

```
{{ IF <<identifier>> != "no" }}
This text appears only if the identifier does NOT equal "no".
{{ END }}
```

Note: Comparisons are case-insensitive.

### ELSE — Alternate content when condition is false

```
{{ IF <<identifier>> }}
Content when identifier has a value.
{{ ELSE }}
Content when identifier is empty.
{{ END }}
```

`{{ ELSE }}` works with all IF variants (`IF`, `IF NOT`, `IF =`, `IF !=`). When the condition is true, the IF body is included and the ELSE body is removed; when false, the ELSE body is included instead.

### Nested IF Blocks

IF blocks (with or without ELSE) can be nested inside other IF blocks to any depth. Each `{{ IF ... }}` must have a matching `{{ END }}`.

```
{{ IF <<has_spouse>> }}
Spouse: <<spouse_name>>

{{ IF <<has_prenup>> }}
A prenuptial agreement is in effect.
{{ ELSE }}
No prenuptial agreement exists.
{{ END }}

{{ ELSE }}
The Trustor is unmarried.
{{ END }}
```

In this example:
- If `has_spouse` is empty, only "The Trustor is unmarried." appears
- If `has_spouse` has a value, the spouse section appears with the prenup clause controlled by the inner IF/ELSE
- The prenup inner block uses ELSE to guarantee one of the two clauses always appears

---

## Inline Conditional Brackets

Use double brackets `[[ ... ]]` to conditionally include a section. If **any** identifier inside the brackets is empty/unanswered, the **entire** section is removed.

```
[[ , represented by <<attorney_name>>, located at <<attorney_address>> ]]
```

If either `attorney_name` or `attorney_address` is empty, the entire clause (including the comma and surrounding text) is removed.

---

## Auto-Incrementing Counters

| Syntax | Description |
|--------|-------------|
| `##` | Replaced with an auto-incrementing number (1, 2, 3, ...) |
| `#^.` | Replaced with the current counter value **without** incrementing |

These are useful for numbered paragraphs or clauses outside of FOREACH loops.

---

## Quick Reference

| Syntax | Purpose |
|--------|---------|
| `<<identifier>>` | Replace with answer value |
| `<<person.field>>` | Replace with person field value |
| `{{ FOREACH ident }} ... {{ END FOREACH }}` | Loop over repeatable group |
| `##` (inside FOREACH) | 1-based loop index |
| `{{ IF <<ident>> }} ... {{ END }}` | Include if has value |
| `{{ IF NOT <<ident>> }} ... {{ END }}` | Include if empty |
| `{{ IF <<ident>> = "val" }} ... {{ END }}` | Include if equals value |
| `{{ IF <<ident>> != "val" }} ... {{ END }}` | Include if not equals value |
| `{{ IF ... }} ... {{ ELSE }} ... {{ END }}` | Alternate content when condition is false |
| `[[ ... ]]` | Remove section if any identifier inside is empty |
| `##` (outside FOREACH) | Auto-incrementing counter |
| `#^.` | Current counter (no increment) |
