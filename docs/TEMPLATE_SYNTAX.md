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

## Macros

Macros allow you to define reusable content that can contain template variables.

### Syntax

**Definition:**
```
@@ macro_name @@ Content with <<identifiers>> and text @@
```

**Usage:**
```
@ macro_name @
```

### How Macros Work

1. Macro definitions are extracted in **Pass 0** (first pass of merge)
2. All `@ macro_name @` usages are replaced with the macro's content
3. Identifiers inside macros (like `<<trustor.name>>`) are replaced in **Pass 5**

### Examples

#### Simple Macro
```
@@ company @@ Estate Planning Associates, LLC @@

This document prepared by @ company @.
```

**Output:**
```
This document prepared by Estate Planning Associates, LLC.
```

#### Macro with Variables
```
@@ jeff @@ <<trustor.name>> @@

The trustor, @ jeff @, hereby declares...
```

If `trustor.name` = "John Smith", **Output:**
```
The trustor, John Smith, hereby declares...
```

#### Macro with Complex Content
```
@@ signature_block @@

Signed: _________________________________
        <<client.name>>

Date: _________________________________

@@

@ signature_block @
```

### Important Notes

- Macro definitions are **removed** from final output
- Only macro **usages** appear in the final document
- Macros can contain **any** template syntax: `<<identifiers>>`, `{{ IF }}`, counters, etc.
- Macros are processed **before** loops and conditionals
- Macro names must be single words (no spaces)

---

## FOR EACH Loops (Repeatable Groups)

Use `FOR EACH` to repeat a section once per entry in a repeatable group.

```
{{ FOR EACH identifier }}
...body repeated for each entry...
{{ END FOR EACH }}
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
{{ FOR EACH beneficiary }}
##. <<beneficiary.name>>, residing at <<beneficiary.mailing_address.line1>>, <<beneficiary.mailing_address.city>>, <<beneficiary.mailing_address.state>> <<beneficiary.mailing_address.zip>>, shall receive <<beneficiary_share>> of the estate.
{{ END FOR EACH }}
```

**Output:**
```
1. John Smith, residing at 123 Main St, Austin, TX 78701, shall receive 50% of the estate.
2. Jane Doe, residing at 456 Oak Ave, Dallas, TX 75201, shall receive 30% of the estate.
3. Bob Johnson, residing at 789 Pine Rd, Houston, TX 77001, shall receive 20% of the estate.
```

### WHERE Clause (Filtered Loops)

Add a `WHERE` clause to only iterate over entries that match a condition:

```
{{ FOR EACH identifier WHERE filter_identifier = 'value' }}
...body...
{{ END FOR EACH }}
```

Supported operators: `=` (equals) and `!=` (not equals). Comparisons are case-insensitive.

**Example:**

If you have a repeatable group with `trustor` (person), `trustor_deceased` (dropdown: Yes/No), and the user entered:

| trustor | trustor_deceased |
|---------|-----------------|
| Bill    | Yes             |
| Jib     | Yes             |
| Andrew  | No              |

**Template:**
```
{{ FOR EACH trustor WHERE trustor_deceased = 'Yes' }}
<<trustor.name>> is deceased.
{{ END FOR EACH }}
```

**Output:**
```
Bill is deceased.
Jib is deceased.
```

Andrew is excluded because `trustor_deceased` is "No".

The `!=` operator inverts the filter:

```
{{ FOR EACH trustor WHERE trustor_deceased != 'Yes' }}
<<trustor.name>> is living.
{{ END FOR EACH }}
```

Would produce only: `Andrew is living.`

### Inline Usage (Outside FOR EACH)

When a repeatable group identifier is used **outside** a FOR EACH loop (e.g., `<<beneficiary_share>>`), the array values are automatically joined using the **conjunction** set on the person entries in the same repeatable group.

The conjunction (and, or, then) is configured per-entry on the person question's "Relationship to Previous Entry" dropdown during data input.

**Example:**

If `beneficiary` has 3 entries with conjunctions "and" between them, and `beneficiary_share` is in the same repeatable group with values `["50%", "30%", "20%"]`:

```
The shares shall be <<beneficiary_share>>.
```

**Output:**
```
The shares shall be 50%, 30%, and 20%.
```

Formatting rules:
- **2 items**: `A and B` (or `A or B`, `A, then B`)
- **3+ items with "and"/"or"**: Oxford comma — `A, B, and C`
- **"then"**: Always comma-separated — `A, then B, then C`

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

### IF ANY / IF NONE — Aggregate checks on repeatable groups

Use `IF ANY` to include content when **at least one** entry in a repeatable group matches a value. Use `IF NONE` to include content when **no** entries match.

```
{{ IF ANY <<identifier>> = "value" }}
This text appears if ANY entry in the repeatable group equals "value".
{{ END }}
```

```
{{ IF NONE <<identifier>> = "value" }}
This text appears if NO entries in the repeatable group equal "value".
{{ END }}
```

Both support `{{ ELSE }}` blocks:

```
{{ IF ANY <<trustee_type>> = "individual" }}
At least one trustee is an individual.
{{ ELSE }}
All trustees are entities.
{{ END }}
```

**Example — Estate distribution with special handling:**

Suppose `beneficiary_type` is a repeatable dropdown (individual / charity / trust) in the same group as `beneficiary`:

```
{{ IF ANY <<beneficiary_type>> = "charity" }}
CHARITABLE PROVISIONS: The following charitable distributions shall be made in accordance with IRS guidelines...
{{ END }}

{{ IF NONE <<beneficiary_type>> = "trust" }}
No sub-trust provisions are required.
{{ END }}
```

- If any beneficiary is a "charity", the charitable provisions paragraph is included
- If no beneficiary is a "trust", the sub-trust paragraph is skipped

Note: Comparisons are case-insensitive. If the identifier holds a single (non-array) value, `IF ANY` and `IF NONE` treat it as a one-element list.

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

These are useful for numbered paragraphs or clauses outside of FOR EACH loops.

---

## Formatting Tags

Use these tags to format text in the Word output:

### Text Alignment

```
<center>This text will be centered</center>
<right>This text will be right-aligned</right>
```

**Example:**
```
<center>LAST WILL AND TESTAMENT</center>
<cr>
<center>OF</center>
<cr>
<center><<trustor.name>></center>
```

### Tabs and Indentation

```
<tab>     Insert a tab character (useful for columns or indentation)
<indent>This paragraph will be indented</indent>
```

**Example with tabs:**
```
Name<tab>Address<tab>Phone
<<trustee.name>><tab><<trustee.mailing_address.line1>><tab><<trustee.phone>>
```

**Example with indentation:**
```
<indent>This paragraph will appear indented in the Word document, useful for nested clauses or sub-sections.</indent>
```

---

## Quick Reference

| Syntax | Purpose |
|--------|---------|
| `@@ name @@ content @@` | Define macro (processed in Pass 0) |
| `@ name @` | Use macro |
| `<<identifier>>` | Replace with answer value (arrays joined with group conjunction) |
| `<<person.field>>` | Replace with person field value |
| `{{ FOR EACH ident }} ... {{ END FOR EACH }}` | Loop over repeatable group |
| `{{ FOR EACH ident WHERE filter = 'val' }}` | Loop with filtered entries (`=` or `!=`) |
| `##` (inside FOR EACH) | 1-based loop index |
| `{{ IF <<ident>> }} ... {{ END }}` | Include if has value |
| `{{ IF NOT <<ident>> }} ... {{ END }}` | Include if empty |
| `{{ IF <<ident>> = "val" }} ... {{ END }}` | Include if equals value |
| `{{ IF <<ident>> != "val" }} ... {{ END }}` | Include if not equals value |
| `{{ IF ANY <<ident>> = "val" }} ... {{ END }}` | Include if any repeatable entry equals value |
| `{{ IF NONE <<ident>> = "val" }} ... {{ END }}` | Include if no repeatable entry equals value |
| `{{ IF ... }} ... {{ ELSE }} ... {{ END }}` | Alternate content when condition is false |
| `[[ ... ]]` | Remove section if any identifier inside is empty |
| `##` (outside FOR EACH) | Auto-incrementing counter |
| `#^.` | Current counter (no increment) |
| `<cr>` or `<CR>` | Explicit line break (paragraph break) |
| `<p>` or `<P>` | Page break (starts a new page in Word output) |
| `<center>text</center>` or `<CENTER>text</CENTER>` | Center-align text |
| `<right>text</right>` or `<RIGHT>text</RIGHT>` | Right-align text |
| `<indent>text</indent>` or `<INDENT>text</INDENT>` | Indent paragraph |
| `<tab>` or `<TAB>` | Insert tab character |
