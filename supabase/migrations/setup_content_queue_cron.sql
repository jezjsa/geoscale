-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a cron job to process the content generation queue every 30 seconds
-- This will call the process-content-queue edge function
SELECT cron.schedule(
  'process-content-generation-queue',  -- job name
  '*/30 * * * * *',                    -- every 30 seconds (cron format with seconds)
  $$
  SELECT
    net.http_post(
      url:='https://ydojubhuopsyxvyzbsan.supabase.co/functions/v1/process-content-queue',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Note: The service_role_key needs to be set as a custom setting
-- You can set it via the Supabase dashboard or with:
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';
