# Content Generation Implementation Guide

## Overview

The GeoScale content generation system uses OpenAI's `o1` model (GPT-5 Reasoning) to create geo-targeted landing pages based on location and keyword combinations.

## Architecture

### 1. Database Schema

**New Status Values for `location_keywords` table:**
- `pending` - Initial state, waiting to be generated
- `generating` - Currently being processed by OpenAI
- `generated` - Content successfully created and stored
- `error` - Generation failed
- `pushed` - Content pushed to WordPress

### 2. Supabase Edge Function

**Location:** `/supabase/functions/generate-content/index.ts`

**Purpose:** 
- Processes batch requests to generate landing page content
- Calls OpenAI API with the `o1` model
- Stores results in `generated_pages` table
- Updates status in real-time

**Required Environment Variables:**
- `OPENAI_API_KEY` - Your OpenAI API key with access to the `o1` model
- `SUPABASE_URL` - Automatically provided
- `SUPABASE_SERVICE_ROLE_KEY` - Automatically provided

### 3. Frontend Implementation

**Files Modified:**
- `src/api/content-generator.ts` - API client for Edge Function
- `src/components/projects/CombinationsTable.tsx` - UI with generation controls

**Features:**
- **Generate Content Button** - Primary action button (green #006239)
- **Real-time Status Updates** - Uses Supabase subscriptions to show live progress
- **Batch Processing** - Select multiple combinations to generate at once
- **Status Badges** - Color-coded by status:
  - Gray (secondary) - Pending
  - Outline with spinner - Generating
  - Green (default) - Generated
  - Red (destructive) - Error
  - Green (default) - Pushed

## User Flow

1. User navigates to project combinations page
2. Clicks "Generate Content" button
3. Selects one or more pending combinations (checkboxes appear)
4. Clicks "Generate (X)" to start processing
5. Status changes to "generating" with animated spinner
6. Real-time updates show when each page is complete
7. Status changes to "generated" when successful
8. Content is stored in `generated_pages` table

## Content Prompt Structure

The system uses `/content_prompt.md` as the base template and dynamically injects:

- **Service Name** - From keyword variation
- **Location** - From project location
- **Business Name** - From project.company_name
- **Phone Number** - From project.phone_number
- **Contact URL** - From project.contact_url
- **Service Description** - From project.service_description
- **Testimonial** - Randomly selected from project_testimonials table

## Generated Content Structure

The Edge Function returns JSON with:

```json
{
  "title": "Page title",
  "meta_title": "SEO meta title (60 chars max)",
  "meta_description": "SEO meta description (155 chars max)",
  "content": "Full HTML content without html/head/body tags"
}
```

## Deployment

### Deploy the Edge Function:

```bash
# Set the OpenAI API key secret
supabase secrets set OPENAI_API_KEY=your-api-key-here

# Deploy the function
supabase functions deploy generate-content
```

### Test the Edge Function:

```bash
# Test with curl
curl -L -X POST 'https://your-project-ref.supabase.co/functions/v1/generate-content' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "locationKeywordIds": ["uuid-here"]
  }'
```

## Data Sources

### From `projects` table:
- `company_name`
- `phone_number`
- `contact_url`
- `service_description`
- `base_keyword` (fallback if keyword not found)

### From `project_testimonials` table:
- `testimonial_text`
- `customer_name`
- `business_name`

One testimonial is randomly selected per page generation.

### From `project_locations` table:
- `name` - Town/city name for the landing page

### From `keyword_variations` table:
- `keyword` - Service keyword for the landing page

## API Logging

All OpenAI API calls are logged to the `api_logs` table with:
- User ID
- Project ID
- API type: `openai`
- Status code
- Request/response data
- Error messages (if any)

## Error Handling

- Individual combination failures don't stop batch processing
- Failed items update to `error` status
- Errors are logged to `api_logs` table
- User receives toast notification with counts of successes/failures

## Real-time Updates

The frontend subscribes to PostgreSQL changes on the `location_keywords` table:

```typescript
supabase
  .channel('location_keywords_changes')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'location_keywords',
    filter: `project_id=eq.${projectId}`,
  }, callback)
  .subscribe()
```

This ensures the UI updates immediately when:
- Status changes to "generating"
- Content generation completes
- Errors occur

## Next Steps

After content generation, the workflow continues with:

1. **Preview Generated Content** - View the HTML before pushing
2. **Push to WordPress** - Send content via WordPress plugin API
3. **Track Results** - Monitor which pages are live

## Troubleshooting

### Function not responding:
- Check Edge Function logs in Supabase dashboard
- Verify OPENAI_API_KEY is set correctly
- Ensure project has testimonials (at least one recommended)

### Content quality issues:
- Update the prompt in `/content_prompt.md`
- Ensure all project fields are filled (company_name, phone_number, etc.)
- Add more testimonials for better variety

### Real-time updates not working:
- Check browser console for subscription errors
- Verify RLS policies allow user to read location_keywords
- Ensure Supabase Realtime is enabled for the project

## Cost Considerations

**OpenAI o1 Model Pricing** (as of Nov 2024):
- Input: Higher cost per token than GPT-4
- Output: Higher cost per token than GPT-4
- Each landing page generates ~1500-2500 tokens

**Recommendations:**
- Generate in batches during off-peak hours
- Monitor usage in OpenAI dashboard
- Consider caching common content patterns
- Set usage limits per user plan

## Security

- Edge Function validates user authentication
- Only authenticated users can trigger generation
- RLS policies ensure users only access their own data
- API keys stored as Supabase secrets (never in code)
- Service role key only used server-side in Edge Function

