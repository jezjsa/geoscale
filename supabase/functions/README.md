# Supabase Edge Functions

## Setup

### 1. Install Supabase CLI

```bash
brew install supabase/tap/supabase
```

### 2. Login to Supabase

```bash
supabase login
```

### 3. Link to your project

```bash
supabase link --project-ref ydojubhuopsyxvyzbsan
```

## Deploy Edge Functions

### Set Environment Secrets

Before deploying, set the required secrets:

```bash
# Set OpenAI API Key
supabase secrets set OPENAI_API_KEY=your-openai-api-key-here
```

### Deploy the generate-content function

```bash
# Deploy from the root of the project
supabase functions deploy generate-content

# Or deploy all functions
supabase functions deploy
```

### View function logs

```bash
supabase functions logs generate-content
```

## Testing Locally

### Start local Supabase

```bash
supabase start
```

### Serve functions locally

```bash
supabase functions serve generate-content --env-file supabase/functions/.env
```

### Create a local .env file for testing

Create `supabase/functions/.env`:

```
OPENAI_API_KEY=your-openai-api-key
```

**Important:** Never commit this file. It's already in .gitignore.

### Test with curl

```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/generate-content' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"locationKeywordIds":["uuid-here"]}'
```

## Available Functions

### generate-content

**Purpose:** Generates landing page content using OpenAI's o1 model

**Endpoint:** `https://ydojubhuopsyxvyzbsan.supabase.co/functions/v1/generate-content`

**Method:** POST

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "locationKeywordIds": ["uuid1", "uuid2", "uuid3"]
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "locationKeywordId": "uuid1",
      "success": true,
      "generatedPageId": "page-uuid"
    },
    {
      "locationKeywordId": "uuid2",
      "success": false,
      "error": "Error message"
    }
  ]
}
```

**Required Secrets:**
- `OPENAI_API_KEY` - OpenAI API key with access to o1 model

**Process:**
1. Validates user authentication
2. For each location keyword ID:
   - Updates status to 'generating'
   - Fetches project, location, keyword, and testimonial data
   - Builds prompt from content_prompt.md template
   - Calls OpenAI API with o1 model
   - Parses JSON response
   - Stores in generated_pages table
   - Updates status to 'generated' or 'error'
   - Logs API call to api_logs table

**Error Handling:**
- Individual failures don't stop batch processing
- Failed items marked as 'error'
- All errors logged to api_logs
- Returns success/failure for each item

## Monitoring

### Check function status

```bash
supabase functions list
```

### View recent logs

```bash
supabase functions logs generate-content --tail
```

### Check secrets

```bash
supabase secrets list
```

## Troubleshooting

### Function deployment fails

- Ensure you're logged in: `supabase login`
- Ensure project is linked: `supabase link`
- Check for TypeScript errors in the function code

### Function returns 401 Unauthorized

- User must be authenticated
- Check Authorization header includes valid JWT token
- Verify token is not expired

### Function returns 500 Internal Server Error

- Check function logs: `supabase functions logs generate-content`
- Verify OPENAI_API_KEY secret is set
- Check OpenAI API status and rate limits

### Real-time updates not working

- Ensure Realtime is enabled in Supabase dashboard
- Check RLS policies on location_keywords table
- Verify frontend subscription is active

## Production Checklist

- [ ] OpenAI API key set as secret
- [ ] Function deployed successfully
- [ ] Test with sample combination
- [ ] Monitor logs for errors
- [ ] Set up alerts for failures (optional)
- [ ] Document usage limits per plan
- [ ] Monitor OpenAI costs

## Future Enhancements

- Add retry logic for failed API calls
- Implement rate limiting per user/plan
- Add content caching for common variations
- Support multiple AI models (GPT-4o, Claude, etc.)
- Batch optimization for lower costs
- Schedule bulk regeneration for outdated content

