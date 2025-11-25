# Content Generation Queue - Setup Instructions

## Current Status

✅ **Queue system implemented**
✅ **Edge function deployed** (`process-content-queue`)
✅ **Realtime enabled** on `location_keywords` and `content_generation_jobs` tables
⚠️ **Cron job needs manual setup** (authentication issue)

## The Problem

The cron job cannot authenticate with the edge function because:
1. We can't securely store the service_role_key in database parameters
2. The anon key doesn't have permission to call edge functions
3. pg_net HTTP requests from cron need proper authentication

## Solution Options

### Option 1: Manual Cron Setup via Supabase Dashboard (RECOMMENDED)

1. Go to **Supabase Dashboard** → **Database** → **Cron Jobs**
2. Click **Create a new cron job**
3. Set:
   - **Name:** `process-content-generation-queue`
   - **Schedule:** `*/30 * * * * *` (every 30 seconds)
   - **Command:** Use the built-in HTTP request feature with proper auth

### Option 2: Temporary Manual Trigger

Until the cron is set up, you can manually trigger the queue worker:

```bash
# Get your service_role_key from Supabase Dashboard → Settings → API
curl -X POST https://ydojubhuopsyxvyzbsan.supabase.co/functions/v1/process-content-queue \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY_HERE" \
  -H "Content-Type: application/json"
```

### Option 3: Database Trigger (Alternative)

Instead of cron, we could use a database trigger that fires when jobs are inserted:

```sql
CREATE OR REPLACE FUNCTION notify_queue_worker()
RETURNS TRIGGER AS $$
BEGIN
  -- Trigger edge function via pg_net
  PERFORM net.http_post(
    url := 'https://ydojubhuopsyxvyzbsan.supabase.co/functions/v1/process-content-queue',
    headers := '{"Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_job_queued
AFTER INSERT ON content_generation_jobs
FOR EACH ROW
EXECUTE FUNCTION notify_queue_worker();
```

## How to Test

1. Click "Regenerate" on a row in the UI
2. Row status should change to `'queued'` immediately
3. Manually trigger the worker (Option 2 above)
4. Check status changes: `queued` → `generating` → `generated`

## Monitoring

### Check Queue Status
```sql
SELECT * FROM content_generation_jobs 
WHERE status IN ('queued', 'processing') 
ORDER BY created_at;
```

### Check API Logs
```sql
SELECT * FROM api_logs 
WHERE api_type = 'openai' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Edge Function Logs
Via Supabase Dashboard → Edge Functions → process-content-queue → Logs

## Next Steps

**Please set up the cron job via the Supabase Dashboard (Option 1) for automated processing.**

Once set up, the system will automatically process queued jobs every 30 seconds without any manual intervention.
