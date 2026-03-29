# Template Formatting: Tabs and Alignment

## Issue
Users needed to add tab characters and text alignment (center, right, indent) in templates and input forms, but these formatting options weren't appearing in the generated Word documents.

## Root Cause Analysis

### Backend (✓ Already Working)
The backend HTMLToWordConverter in [document_service.py](../backend/src/services/document_service.py) already correctly handled:
- **Text alignment**: Both class-based (`ql-align-center`) and style-based (`text-align: center`) formats (lines 59-64, 252-258)
- **Tab characters**: Proper preservation of `\t` characters in Word output (lines 162-170)

### Template System (❌ Main Issue)
The template syntax in [TEMPLATE_SYNTAX.md](../docs/TEMPLATE_SYNTAX.md) had no support for:
- **Center or right alignment**: No way to center text like "LAST WILL AND TESTAMENT"
- **Tab characters**: No syntax to insert tabs for columns or indentation
- **Paragraph indentation**: No way to indent specific paragraphs

### Frontend (❌ Secondary Issues)

**Issue 1: Template Editor**
The Quill editor configuration in [RichTextEditor.tsx](../frontend/src/components/common/RichTextEditor.tsx) didn't insert tab characters when users pressed Tab.

**Issue 2: Input Forms**
The input forms in [InputForms.tsx](../frontend/src/pages/InputForms.tsx) used a plain `<textarea>` for free_text questions instead of a rich text editor.

## Solution

### Fix 1: Added Template Syntax for Formatting (PRIMARY FIX)

Added new template tags to [document_service.py](../backend/src/services/document_service.py) in Pass 6 of template processing:

**New Template Tags:**
- `<center>text</center>` - Center-align paragraphs
- `<right>text</right>` - Right-align paragraphs
- `<indent>text</indent>` - Indent paragraphs
- `<tab>` - Insert tab character

**Example Template Usage:**
```
<center>LAST WILL AND TESTAMENT</center>
<cr>
<center>OF</center>
<cr>
<center><<trustor.name>></center>
<cr>
<cr>
<center>ARTICLE ##</center>
<cr>
<indent>This paragraph will be indented in the Word output.</indent>
<cr>
Name<tab>Address<tab>Phone
```

### Fix 2: Added Tab Character Support to RichTextEditor
Modified [RichTextEditor.tsx](../frontend/src/components/common/RichTextEditor.tsx) to add a custom keyboard binding that inserts actual tab characters (`\t`) when users press the Tab key:

```typescript
keyboard: {
  bindings: {
    tab: {
      key: 9, // Tab key code
      handler: function(this: any, range: any) {
        // Insert a tab character
        this.quill.insertText(range.index, '\t')
        // Move cursor after the tab
        this.quill.setSelection(range.index + 1)
        return false // Prevent default behavior
      }
    }
  }
}
```

### Fix 3: Replaced Textarea with RichTextEditor in Input Forms
Modified [InputForms.tsx](../frontend/src/pages/InputForms.tsx) to use `RichTextEditor` instead of plain `<textarea>` for free_text questions. This enables:
- Tab character support via the Tab key
- Text alignment via the toolbar
- Proper HTML formatting that preserves these features in Word output

The change replaces the simple textarea with the full Quill editor, giving users access to all formatting features including tabs and alignment.

### Text Alignment
Text alignment now works in both templates and input forms:
- The toolbar has the alignment button: `[{ 'align': [] }]`
- Users can click the alignment dropdown and choose left/center/right/justify
- Quill stores it as `class="ql-align-center"` etc.
- Backend correctly converts it to Word format

## Testing

Created comprehensive test suites:

1. **[test_quill_formatting.py](../backend/tests/unit/test_quill_formatting.py)**:
   - Tests basic alignment (center, right, justify)
   - Tests tab character preservation
   - Tests combined scenarios

2. **[test_quill_tab_alignment_integration.py](../backend/tests/unit/test_quill_tab_alignment_integration.py)**:
   - Real-world scenarios (table headers with tabs, label-value pairs)
   - Mixed formatting (alignment + tabs + bold/italic)
   - Edge cases (tabs at start/end of paragraphs)

All tests pass ✓

## Usage

### In Templates (Recommended - Most Control)

Use the template syntax tags directly in your template text:

**Center a title:**
```
<center>LAST WILL AND TESTAMENT</center>
```

**Right-align page numbers or dates:**
```
<right>Page ##</right>
<right>Date: <<current_date>></right>
```

**Indent a paragraph:**
```
<indent>This indented paragraph represents a subsection or note.</indent>
```

**Create columns with tabs:**
```
Name<tab>Address<tab>Phone
<<trustee.name>><tab><<trustee.address>><tab><<trustee.phone>>
```

### In Rich Text Editors (Input Forms and Template Editor)

**Tabs (when using Quill editor):**
- Press the `Tab` key to insert a tab character
- Tab characters will appear in the Word output

**Text Alignment (when using Quill editor):**
1. Select the text you want to align
2. Click the alignment button in the toolbar
3. Choose: Left, Center, Right, or Justify
4. Alignment will appear in the generated Word document

### Example Use Cases

1. **Creating tabbed table headers:**
   ```
   Name    Address    Phone     [Center-aligned]
   John    123 Main   555-1234  [Left-aligned]
   Jane    456 Oak    555-5678  [Left-aligned]
   ```

2. **Right-aligned label-value pairs:**
   ```
   Date:     2024-03-28    [Right-aligned]
   Amount:   $1,000.00     [Right-aligned]
   ```

## Files Modified

**Backend (Template Processing):**
- ✅ [backend/src/services/document_service.py](../backend/src/services/document_service.py) - Added `_process_formatting_tags()` method (Pass 6)
- ✅ [docs/TEMPLATE_SYNTAX.md](../docs/TEMPLATE_SYNTAX.md) - Documented new formatting tags

**Frontend (Rich Text Editor):**
- ✅ [frontend/src/components/common/RichTextEditor.tsx](../frontend/src/components/common/RichTextEditor.tsx) - Added tab key binding
- ✅ [frontend/src/pages/InputForms.tsx](../frontend/src/pages/InputForms.tsx) - Replaced textarea with RichTextEditor for free_text questions

**Tests:**
- ✅ [backend/tests/unit/test_template_formatting_tags.py](../backend/tests/unit/test_template_formatting_tags.py) - Tests for template formatting tags (8 tests)
- ✅ [backend/tests/unit/test_quill_formatting.py](../backend/tests/unit/test_quill_formatting.py) - Tests for Quill HTML parsing (11 tests)
- ✅ [backend/tests/unit/test_quill_tab_alignment_integration.py](../backend/tests/unit/test_quill_tab_alignment_integration.py) - Integration tests (6 tests)

## Verification

Run the tests to verify everything works:
```bash
cd backend
source venv/bin/activate

# Test template formatting tags
pytest tests/unit/test_template_formatting_tags.py -v

# Test Quill HTML parsing
pytest tests/unit/test_quill_formatting.py -v
pytest tests/unit/test_quill_tab_alignment_integration.py -v
```

All 25 tests should pass ✓ (8 + 11 + 6)
