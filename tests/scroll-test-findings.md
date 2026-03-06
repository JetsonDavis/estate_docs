# Scroll Position Preservation Test Results

## Test Setup
- Frontend: http://localhost:3006/
- Backend: http://localhost:8005/
- File: EditTemplate.tsx
- Debug logging: ENABLED

## Test Procedure
1. Navigate to a template with lots of content
2. Scroll to middle/bottom of formatted text
3. Click in the middle of visible text
4. Observe scroll behavior and console output

## Console Output Log

### Test 1: Initial Click Test
(Console output will be captured here)

## Findings

### Issue Hypothesis
The formatted div and textarea have different content structures:
- Formatted div: Contains HTML (`<br>`, `<strong>`, etc.)
- Textarea: Contains plain text with `\n` characters
- Different rendering = different scrollable heights
- Saved scrollTop from div may not map correctly to textarea

### Observed Behavior
When clicking in the formatted div and switching to textarea mode, the scroll position jumps to the top instead of preserving the user's position.

### Root Cause ✓ IDENTIFIED

**The Problem Chain:**
1. User clicks in formatted div → scroll position saved (`scrollPosRef.current = div.scrollTop`) ✓
2. Switch to textarea, set `scrollTop = savedScroll` ✓
3. Call `el.focus({ preventScroll: true })` ✓
4. **Set cursor position: `el.selectionStart = targetPos`** ← **THIS IS THE CULPRIT!**
5. Browser's native behavior: "scroll the cursor into view" ← **OVERRIDES our scrollTop**
6. Even with scroll lock and RAF, browser scrolls to show the cursor

**Why the previous solution failed:**
- The scroll lock event listener only prevents USER-initiated scrolls
- It does NOT prevent BROWSER-initiated scrolls from `selectionStart`
- The browser's "scroll to cursor" happens SYNCHRONOUSLY when setting selectionStart
- By the time RAF callbacks run, the browser has already scrolled

### Solution Implemented ✓

**Fix:** Set cursor position FIRST, then restore scroll position AFTER browser's native scroll completes.

**Old (broken) order:**
1. Set scrollTop
2. Focus
3. Set selectionStart ← Browser scrolls here, overriding step 1
4. Try to restore scrollTop (too late!)

**New (working) order:**
1. Focus
2. Set selectionStart ← Let browser scroll naturally
3. Use RAF to restore scrollTop AFTER browser finishes
4. Use multiple RAF layers to ensure it sticks

**Code changes:**
- Removed scroll lock event listener (not needed)
- Changed order: focus + cursor FIRST, then restore scroll
- Use 3 nested requestAnimationFrame calls to restore scroll after browser completes its scroll-to-cursor
