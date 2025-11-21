# Generate Next & Regenerate Features

## Date: November 20, 2025

## Overview

Added two powerful features for testing and refining AI-generated content:
1. **Generate Next** - Generates just one pending combination at a time
2. **Regenerate** - Allows users to refresh content on individual rows

## Feature 1: Generate Next Button

### Purpose
Perfect for testing the content prompt without generating lots of articles. Generates only the first pending combination in the list.

### Location
In the action bar above the combinations table, to the left of "Generate Content" button.

### Visual Design
- **Style:** Outline button with brand green border
- **Icon:** Play icon (▶️)
- **Color:** Green outline (#006239) that fills on hover
- **Text:** "Generate Next"

### Behavior

**When Enabled:**
- At least one pending combination exists
- No generation currently in progress

**When Disabled:**
- No pending combinations available
- Generation already in progress
- Shows loading spinner

**On Click:**
1. Finds the first pending combination in the filtered list
2. Triggers generation for just that one item
3. Shows progress bar (just like batch generation)
4. Updates status in real-time
5. Shows success/error toast when complete

### Use Cases

**Testing Prompts:**
```
1. Click "Generate Next"
2. Wait for completion
3. Review generated content
4. Make adjustments to content_prompt.md if needed
5. Click "Regenerate" icon on that row
6. Repeat until satisfied
7. Then use "Generate Content" for batch processing
```

**Controlled Generation:**
- Generate pages one at a time
- Review each before continuing
- Monitor costs more carefully
- Perfect for quality control

## Feature 2: Regenerate Icon

### Purpose
Allows users to refresh content they don't like without having to delete and regenerate.

### Location
New "Actions" column (last column) in the combinations table.

### Visual Design
- **Icon:** Refresh/circular arrows icon (🔄)
- **Style:** Ghost button (minimal, only visible on hover)
- **Size:** Small icon button (32x32px)
- **Color:** Gray (muted) that turns green on hover
- **Tooltip:** "Regenerate content"

### Visibility Rules

**Shows for:**
- ✅ Status: `generated` (successfully generated)
- ❌ Status: `error` (generation failed)

**Hidden for:**
- Status: `pending` (not yet generated)
- Status: `generating` (currently in progress)
- Status: `pushed` (already sent to WordPress)

### Behavior

**On Click:**
1. Resets status to `pending`
2. Deletes existing generated page content
3. Immediately triggers new generation
4. Shows progress indicator
5. Updates in real-time
6. Toast: "Regenerating content..."

**Smart Flow:**
```
User clicks Regenerate icon
    ↓
Delete old content from generated_pages
    ↓
Update status to 'pending'
    ↓
Immediately trigger generation
    ↓
Status → 'generating'
    ↓
OpenAI creates new content
    ↓
Status → 'generated'
    ↓
New content stored
```

### Use Cases

**Content Not Good Enough:**
1. Review generated page
2. Don't like the output
3. Click regenerate icon
4. AI creates fresh content (using same data but different variations)
5. Review again

**After Updating Prompt:**
1. Modify `/content_prompt.md`
2. Click regenerate on existing pages
3. New content uses updated prompt
4. Compare old vs new

**After Adding Testimonials:**
1. Add more testimonials to project
2. Regenerate pages to include new testimonials
3. Get better variety across pages

**Error Recovery:**
1. Page shows status: `error`
2. Click regenerate to try again
3. May succeed on second attempt

## UI Layout Changes

### Action Bar (Top)
```
[Search] [Town Filter]    [Generate Next ▶️] [Generate Content 🪄] [Delete 🗑️]
                          ↑ NEW BUTTON
```

### Table Columns
```
[Phrase] [Location] [Keyword] [Volume] [Difficulty] [Status] [Actions]
                                                               ↑ NEW COLUMN
```

### Actions Column Content
```
Row with status 'generated':  [🔄]  ← Shows regenerate icon

Row with status 'pending':    [ ]   ← Empty (no action needed)

Row with status 'generating': [ ]   ← Empty (can't regenerate during generation)

Row with status 'error':      [🔄]  ← Shows regenerate icon

Row with status 'pushed':     [ ]   ← Empty (already on WordPress)
```

## Technical Implementation

### New State
No additional state needed - uses existing `generateMutation` and `regenerateMutation`.

### Regenerate Mutation
```typescript
const regenerateMutation = useMutation({
  mutationFn: async (locationKeywordId: string) => {
    // Reset to pending
    await supabase
      .from('location_keywords')
      .update({ status: 'pending' })
      .eq('id', locationKeywordId)

    // Delete old content
    await supabase
      .from('generated_pages')
      .delete()
      .eq('location_keyword_id', locationKeywordId)

    // Trigger new generation
    setGeneratingIds(new Set([locationKeywordId]))
    return await generateContent([locationKeywordId])
  }
})
```

### Generate Next Handler
```typescript
const handleGenerateNext = () => {
  // Find first pending in filtered list
  const nextPending = filteredCombinations.find(
    combo => combo.status === 'pending'
  )
  
  if (!nextPending) {
    toast.error('No pending combinations to generate')
    return
  }

  generateMutation.mutate([nextPending.id])
}
```

## User Experience Flow

### Testing Workflow
```
1. Create combinations
2. Click "Generate Next" to test one
3. Wait ~10-30 seconds for AI
4. Review the generated content
5. If not satisfied:
   - Update content_prompt.md
   - Click regenerate icon 🔄
   - Review again
6. If satisfied:
   - Click "Generate Next" again
   - Or use "Generate Content" for batch
```

### Batch with Regeneration
```
1. Generate 10 pages in batch
2. Review all pages
3. Find 3 that need improvement
4. Click regenerate icon on those 3
5. Rest remain unchanged
6. Continue when ready
```

## Benefits

### For Testing
- ✅ Test prompts one at a time
- ✅ Iterate quickly without waste
- ✅ Control costs during development
- ✅ Perfect for fine-tuning

### For Users
- ✅ Regenerate unsatisfactory content
- ✅ No need to delete and recreate
- ✅ Update content after prompt changes
- ✅ Recover from errors easily
- ✅ Fine-tune individual pages

### For Quality Control
- ✅ Review each page before proceeding
- ✅ Ensure quality before pushing to WordPress
- ✅ Spot issues early
- ✅ Better control over output

## Edge Cases Handled

### No Pending Items
- "Generate Next" button is disabled
- Shows grayed out state
- Tooltip could explain why

### Already Generating
- "Generate Next" disabled during generation
- Shows loading spinner
- Prevents duplicate requests

### Regenerate During Generation
- Icon hidden when status is 'generating'
- Can't regenerate until current generation completes
- Prevents conflicts

### Pushed to WordPress
- No regenerate icon for pushed pages
- Prevents accidental overwrites
- User must decide to push updated content manually

## Files Modified

### Updated:
- `/src/components/projects/CombinationsTable.tsx`
  - Added "Generate Next" button
  - Added "Actions" column to table
  - Added regenerate icon in rows
  - Added `regenerateMutation`
  - Added `handleGenerateNext()` handler
  - Added `handleRegenerate()` handler
  - Imported `RefreshCw` and `Play` icons

### No Changes:
- Edge Function (works as-is)
- API client (works as-is)
- Database schema (no changes)

## Testing Checklist

### Generate Next Button
- [ ] Button visible when pending items exist
- [ ] Button disabled when no pending items
- [ ] Button shows loading spinner when generating
- [ ] Finds and generates first pending item
- [ ] Progress bar shows for single item
- [ ] Toast notifications work
- [ ] Real-time status updates work

### Regenerate Icon
- [ ] Icon visible for 'generated' status
- [ ] Icon visible for 'error' status
- [ ] Icon hidden for 'pending' status
- [ ] Icon hidden for 'generating' status
- [ ] Icon hidden for 'pushed' status
- [ ] Click resets status and deletes old content
- [ ] Click triggers new generation
- [ ] Progress bar shows
- [ ] New content replaces old content
- [ ] Works multiple times on same row

### Workflow Testing
- [ ] Generate one with "Generate Next"
- [ ] Review content
- [ ] Regenerate same item
- [ ] Review new content
- [ ] Generate batch of multiple
- [ ] Regenerate individual items from batch
- [ ] All statuses update correctly

## Future Enhancements

### Possible Additions:
- [ ] "Generate Next 5" button for small batches
- [ ] Keyboard shortcut for "Generate Next" (G key)
- [ ] Preview content before regenerating
- [ ] Compare old vs new content side-by-side
- [ ] Regenerate with different AI model
- [ ] Bulk regenerate for filtered items
- [ ] Schedule regeneration for outdated content
- [ ] Confirmation dialog before regenerate (optional)

## Cost Considerations

### Generate Next
- Controlled spending - one page at a time
- Perfect for staying within budget
- Easy to stop if costs mount up
- Recommended for initial testing

### Regenerate
- Additional API calls = additional cost
- Consider warning after X regenerations
- Track regeneration count per project
- Could implement daily regeneration limits per plan

## Accessibility

- Buttons have clear labels
- Icons have tooltips
- Keyboard navigable
- Clear loading states
- Color + icon indicators (not just color)
- Screen reader friendly

---

**Implementation completed:** November 20, 2025  
**Status:** ✅ Complete  
**Perfect for:** Testing prompts and fine-tuning content quality

