# Scroll Position Preservation - Test Scenarios

## Test Scenarios to Verify Fix

### Scenario 1: Click at Top of Content
**Setup:**
- Template with >600px of content
- Scroll position at top (scrollTop = 0)

**Steps:**
1. Ensure formatted div is at scroll position 0
2. Click in the visible text near the top
3. Switch to textarea edit mode

**Expected Result:**
- Scroll position remains at top (scrollTop ≈ 0)
- Cursor appears at clicked position

**Status:** ✓ Should work (minimal scroll restoration needed)

---

### Scenario 2: Click in Middle of Content
**Setup:**
- Template with >1200px of content
- Scroll to middle (scrollTop ≈ 400-600px)

**Steps:**
1. Scroll to middle of the formatted text
2. Click in the middle of the visible content
3. Switch to textarea edit mode

**Expected Result:**
- Scroll position preserved (scrollTop ≈ 400-600px)
- Cursor appears at clicked position
- Content visible before/after cursor should be the same

**Status:** ✓ This was the main bug - now fixed

---

### Scenario 3: Click at Bottom of Content
**Setup:**
- Template with >1200px of content
- Scroll to bottom (scrollTop = scrollHeight - clientHeight)

**Steps:**
1. Scroll to the very bottom
2. Click in the last few lines of visible text
3. Switch to textarea edit mode

**Expected Result:**
- Scroll position remains at bottom
- Cursor appears at clicked position
- Last lines should still be visible

**Status:** ✓ Should work with RAF restoration

---

### Scenario 4: Click on Control Flow Keywords
**Setup:**
- Template with IF/FOREACH blocks
- Scroll to middle where colored keywords are visible

**Steps:**
1. Scroll to see colored control flow keywords (IF, FOREACH, END)
2. Click directly on a keyword (e.g., "{{IF property_type}}")
3. Switch to textarea edit mode

**Expected Result:**
- Scroll position preserved
- Cursor positioned at start of the clicked keyword
- Same keyword should be visible in textarea

**Status:** ✓ Should work (same mechanism as regular text)

---

### Scenario 5: Click Between Lines
**Setup:**
- Template with multiple lines and paragraphs
- Scroll to a section with line breaks

**Steps:**
1. Scroll to middle of content
2. Click in the whitespace between two lines
3. Switch to textarea edit mode

**Expected Result:**
- Scroll position preserved
- Cursor appears at the line break
- Same surrounding text should be visible

**Status:** ✓ Should work (cursor position calculation handles this)

---

### Scenario 6: Rapid Click Switching
**Setup:**
- Template with >600px content

**Steps:**
1. Scroll to middle
2. Click to enter edit mode
3. Immediately click to enter edit mode again (before blur)
4. Blur and click again at a different scroll position

**Expected Result:**
- Each transition should preserve scroll position
- No scroll jumping between transitions
- textareaInitializedRef prevents re-initialization

**Status:** ✓ Should work (ref flag prevents re-runs)

---

## Edge Cases

### Edge Case 1: Very Long Content (>5000px)
**Test:** Template with extremely long content
**Expected:** Scroll position should still be preserved even with large scroll values

### Edge Case 2: Short Content (<600px)
**Test:** Template with minimal content (no scrolling needed)
**Expected:** No scroll jumping (scrollTop = 0 throughout)

### Edge Case 3: Click at Exact Start (position 0)
**Test:** Click at the very first character
**Expected:** Cursor at position 0, scroll at top

### Edge Case 4: Click at Exact End (last character)
**Test:** Click at the very last character
**Expected:** Cursor at end, scroll at bottom

---

## Browser Compatibility

### Tested Browsers
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari

### Browser-Specific Considerations

**Chrome/Edge:**
- `focus({ preventScroll: true })` - Full support
- `requestAnimationFrame` - Full support
- Expected behavior: ✓ Should work perfectly

**Firefox:**
- `focus({ preventScroll: true })` - Supported since Firefox 68
- May have different RAF timing
- Expected behavior: ✓ Should work with 3 RAF calls

**Safari:**
- `focus({ preventScroll: true })` - Supported since Safari 15.4
- Different scroll behavior than Chromium
- Expected behavior: ✓ Should work with RAF restoration

---

## Performance Considerations

**Impact of Multiple RAF Calls:**
- 3 nested RAF calls = 3 frames = ~50ms delay (at 60fps)
- User perception: Imperceptible (< 100ms is perceived as instant)
- Trade-off: Necessary to override browser's scroll-to-cursor behavior

**Memory Impact:**
- No event listeners attached (previous version had scroll lock listener)
- No timers (previous version had 100ms setTimeout)
- Overall: Better performance than previous implementation

---

## How to Test

1. Start the application:
   ```bash
   cd /Users/jeff/Documents/WWW2020/estate_docs/frontend
   npm run dev
   ```

2. Navigate to a template editor:
   - Go to http://localhost:3006/admin/templates
   - Select a template with lots of content
   - Test each scenario above

3. Verify in browser console:
   - No errors should appear
   - Scroll position should be preserved visually
   - Cursor should appear at the correct position

4. Visual verification:
   - The same text that was visible in the formatted div should remain visible in the textarea
   - No sudden jumps or repositioning
   - Smooth transition between view and edit modes
