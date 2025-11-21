# Fixes Applied - Real-time Progress & Row Positioning

## Date: November 20, 2025

## Issues Fixed

### Issue 1: Progress Bar Not Moving in Real-Time
**Problem:** Progress bar stays at 0%, then jumps to 100% and disappears immediately.

**Root Cause:** 
- Edge Function updates status very quickly
- Real-time subscription might miss intermediate "generating" state
- React Query cache not updating fast enough

**Fixes Applied:**

1. **Added delay to real-time subscription** (100ms)
   - Ensures database write is complete before refetch
   - Catches intermediate states better

2. **Added console logging** to real-time updates
   - Can debug what status changes are being received
   - Check browser console for: "Real-time update received"

3. **Immediate refetch on generation start** (500ms delay)
   - Manually triggers refetch to show "generating" status
   - Ensures UI updates before API call completes

4. **Increased completion display time** (2s → 3s)
   - Progress bar stays at 100% longer
   - Users can see completion state
   - Toast notifications appear during this time

### Issue 2: Row Moves to Bottom During Update
**Problem:** When a row's status updates, it jumps to the bottom of the table.

**Root Cause:**
- Combinations sorted by `created_at DESC`
- When status updates, `updated_at` timestamp changes
- This might cause re-sorting (though we're not sorting by `updated_at`)

**Fixes Applied:**

1. **Added stable secondary sort** (by `id`)
   - Primary sort: `created_at DESC` (newest first)
   - Secondary sort: `id ASC` (consistent order within same timestamp)
   - Rows now maintain stable position even when updated

2. **Preserved DESC order**
   - Kept newest combinations at top
   - Matches user expectation
   - Consistent with other tables in app

### Issue 3: View Button Navigation
**Problem:** View button doesn't navigate to content page.

**Debugging Added:**

1. **Console logging** in handleViewContent
   - Logs projectId and locationKeywordId
   - Shows when button is clicked

2. **Try-catch with fallback**
   - If TanStack Router navigation fails
   - Falls back to direct window.location.href
   - Error logged to console

3. **Button should work when status is:**
   - ✅ `generated`
   - ✅ `pushed`
   - ❌ Disabled for all other statuses

## Files Modified

### 1. `/src/api/combinations.ts`
- Added secondary sort by `id`
- Ensures stable row ordering

### 2. `/src/components/projects/CombinationsTable.tsx`
- Added console logging to real-time subscription
- Added 100ms delay before refetch
- Added immediate refetch on generation start (500ms)
- Increased completion display time to 3 seconds
- Added debugging to handleViewContent
- Added try-catch with fallback navigation

## Testing Instructions

### Test Progress Bar

1. **Start Generation:**
   - Click "Generate Next" button
   - Check browser console for logs
   - Progress bar should appear immediately

2. **Watch Progress:**
   - Progress bar should show 0% initially
   - Should update to higher percentages
   - Check console for "Real-time update received" messages

3. **Completion:**
   - Bar should reach 100%
   - "Generation Complete!" message appears
   - Bar stays visible for 3 seconds
   - Toast notification appears
   - Bar disappears automatically

### Test Row Positioning

1. **Before Generation:**
   - Note the row position of a pending item
   - Remember neighboring rows

2. **During Generation:**
   - Status changes to "generating"
   - **Row should NOT move**
   - Check if it stays in same position

3. **After Generation:**
   - Status changes to "generated"
   - **Row should STILL not move**
   - Verify same neighbors

4. **Multiple Generations:**
   - Generate several items
   - Each should stay in original position
   - No re-sorting or jumping

### Test View Button

1. **Generated Content:**
   - Find a row with status "generated"
   - Eye icon should be normal color (not greyed)
   - Click the eye icon
   - Check browser console for:
     ```
     Navigating to view content: {projectId: '...', locationKeywordId: '...'}
     ```

2. **Expected Behavior:**
   - Should navigate to `/projects/:projectId/content/:locationKeywordId`
   - ViewContentPage should load
   - Should show title, slug, meta data, content

3. **If Navigation Fails:**
   - Check console for "Navigation error"
   - Fallback should kick in (window.location.href)
   - Page should still navigate

4. **Disabled States:**
   - Pending items: eye icon greyed, button disabled
   - Generating items: eye icon greyed, button disabled
   - Error items: eye icon greyed, button disabled

## Debugging

### Browser Console Checks

Open browser console (F12) and look for:

1. **Real-time updates:**
   ```
   Real-time update received: {old: {...}, new: {...}}
   ```

2. **View button clicks:**
   ```
   Navigating to view content: {projectId: '...', locationKeywordId: '...'}
   ```

3. **Navigation errors:**
   ```
   Navigation error: ...
   ```

### Network Tab Checks

1. **Edge Function calls:**
   - Look for POST to `/functions/v1/generate-content`
   - Should return 200 status
   - Check response time

2. **Supabase queries:**
   - Multiple SELECT queries as status updates
   - Should see rapid queries during generation

## Known Limitations

### Progress Bar

**Real-time updates depend on:**
- Supabase Realtime being enabled
- Websocket connection active
- Database triggers working
- Network latency

**If progress bar still jumps:**
- This might be unavoidable for very fast operations (<1 second)
- The Edge Function processes in one go
- Database updates are atomic
- Real-time subscription might miss the "generating" state if it's too brief

**Potential Solution (if needed):**
- Break Edge Function into multiple steps
- Update status after each step
- Add artificial delays (not recommended)
- Use polling instead of real-time (less efficient)

### Row Positioning

**Still might move if:**
- React Query cache invalidates and re-sorts
- Browser memory pressure causes re-render
- Large number of combinations (pagination would help)

## Future Improvements

### Progress Bar
- [ ] Add estimated time remaining
- [ ] Show which specific item is being generated
- [ ] Add progress percentage per item (OpenAI streaming)
- [ ] Visual indicator of which row is currently generating

### Row Stability
- [ ] Add pagination (prevent full list re-render)
- [ ] Use React.memo() for table rows
- [ ] Implement virtual scrolling for large lists
- [ ] Add row highlighting during generation

### View Navigation
- [ ] Add loading state while navigating
- [ ] Preload content page data
- [ ] Add transition animation
- [ ] Breadcrumb navigation

## If Issues Persist

### Progress Bar Still Jumping
1. Check Supabase Realtime is enabled in dashboard
2. Check browser console for websocket errors
3. Try increasing the 500ms delay in generateMutation
4. Consider switching to polling (less real-time but more reliable)

### Rows Still Moving
1. Check if `created_at` timestamps are identical
2. Try sorting by `id` only (more stable but less logical)
3. Implement pagination to reduce re-renders
4. Add `key={combo.id}` to table rows (React optimization)

### View Button Not Working
1. Check console for navigation errors
2. Verify ViewContentPage is imported in router
3. Check if route is in routeTree array
4. Try direct URL: `/projects/{projectId}/content/{locationKeywordId}`
5. Verify content exists in `generated_pages` table

---

**Status:** ✅ Fixes applied and ready for testing  
**Next:** Test each scenario and report results

