import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configuration
const BATCH_SIZE = 5; // Process up to 5 jobs per cron run for reliability
const MAX_EXECUTION_TIME_MS = 50000; // Stop processing after 50 seconds to avoid timeout
const STUCK_JOB_THRESHOLD_MINUTES = 5; // Reset jobs stuck in "processing" for longer than this

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results: Array<{ job_id: string; success: boolean; error?: string }> = [];

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`🔄 [WP QUEUE WORKER] Starting batch processing (up to ${BATCH_SIZE} jobs)...`);

    // First, check for and reset any stuck jobs (processing for too long)
    const stuckThreshold = new Date(Date.now() - STUCK_JOB_THRESHOLD_MINUTES * 60 * 1000).toISOString();
    const { data: stuckJobs, error: stuckError } = await supabase
      .from("wordpress_push_jobs")
      .update({ 
        status: "queued", 
        error_message: "Reset: job was stuck in processing state",
        updated_at: new Date().toISOString()
      })
      .eq("status", "processing")
      .lt("started_at", stuckThreshold)
      .select("id");

    if (!stuckError && stuckJobs && stuckJobs.length > 0) {
      console.log(`🔧 [WP QUEUE WORKER] Reset ${stuckJobs.length} stuck jobs back to queued`);
    }

    // Check if there are already jobs being processed (prevent overlapping runs)
    const { count: processingCount } = await supabase
      .from("wordpress_push_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "processing");

    if (processingCount && processingCount > 0) {
      console.log(`⏳ [WP QUEUE WORKER] ${processingCount} jobs still processing, skipping this run`);
      return new Response(
        JSON.stringify({ success: true, message: "Previous batch still processing", skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get batch of queued jobs (ordered by priority desc, then created_at asc)
    const { data: jobs, error: fetchError } = await supabase
      .from("wordpress_push_jobs")
      .select("*")
      .eq("status", "queued")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("❌ [WP QUEUE WORKER] Error fetching jobs:", fetchError);
      throw fetchError;
    }

    if (!jobs || jobs.length === 0) {
      console.log("✅ [WP QUEUE WORKER] No jobs in queue");
      return new Response(
        JSON.stringify({ success: true, message: "No jobs to process", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📋 [WP QUEUE WORKER] Found ${jobs.length} jobs to process`);

    // Process each job in sequence
    for (const job of jobs) {
      // Check if we're running out of time
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        console.log(`⏱️ [WP QUEUE WORKER] Approaching timeout, stopping batch processing`);
        break;
      }

      // Check if job has exceeded max attempts
      if (job.attempts >= job.max_attempts) {
        console.log(`⚠️ [WP QUEUE WORKER] Job ${job.id} has exceeded max attempts, marking as failed`);
        await supabase
          .from("wordpress_push_jobs")
          .update({ status: "failed" })
          .eq("id", job.id);
        results.push({ job_id: job.id, success: false, error: "Max attempts exceeded" });
        continue;
      }

      console.log(`📋 [WP QUEUE WORKER] Processing job ${job.id} for location_keyword ${job.location_keyword_id}`);

      // Mark job as processing
      const { error: updateError } = await supabase
        .from("wordpress_push_jobs")
        .update({
          status: "processing",
          started_at: new Date().toISOString(),
          attempts: job.attempts + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (updateError) {
        console.error("❌ [WP QUEUE WORKER] Error updating job status:", updateError);
        results.push({ job_id: job.id, success: false, error: updateError.message });
        continue;
      }

      try {
        // Fetch location keyword with project and generated page data
        const { data: lkData, error: lkError } = await supabase
          .from("location_keywords")
          .select(`
            *,
            location:project_locations!location_id(name),
            keyword:keyword_variations!keyword_id(keyword),
            project:projects!project_id(wp_url, blog_url, wp_api_key, wp_page_template, wp_publish_status)
          `)
          .eq("id", job.location_keyword_id)
          .single();

        if (lkError || !lkData) {
          throw new Error(`Location keyword not found: ${job.location_keyword_id}`);
        }

        // Check if content has been generated
        if (lkData.status !== "generated" && lkData.status !== "pushed") {
          throw new Error(`Content not yet generated for: ${lkData.phrase}`);
        }

        // Fetch generated page content
        const { data: generatedPage, error: pageError } = await supabase
          .from("generated_pages")
          .select("*")
          .eq("location_keyword_id", job.location_keyword_id)
          .single();

        if (pageError || !generatedPage) {
          throw new Error(`Generated page not found for: ${job.location_keyword_id}`);
        }

        const project = lkData.project;
        // Use blog_url if available, otherwise fall back to wp_url
        const apiBaseUrl = project?.blog_url || project?.wp_url;
        if (!apiBaseUrl || !project?.wp_api_key) {
          throw new Error("WordPress URL or API Key not configured for this project");
        }

        console.log(`📤 [WP QUEUE WORKER] Pushing to WordPress: ${lkData.phrase}`);

        // Prepare WordPress API URL (use blog_url for API calls)
        let wpUrl = apiBaseUrl.trim();
        if (!wpUrl.startsWith("http://") && !wpUrl.startsWith("https://")) {
          wpUrl = "https://" + wpUrl;
        }
        wpUrl = wpUrl.replace(/\/$/, "");

        // Check if we're updating an existing page
        const isUpdate = lkData.wp_page_id ? true : false;
        const endpoint = isUpdate ? "update" : "publish";
        const apiUrl = `${wpUrl}/wp-json/geoscale/v1/${endpoint}`;

        // Prepare page data for WordPress
        const wordpressData: any = {
          title: generatedPage.title,
          content: generatedPage.content,
          meta_title: generatedPage.meta_title,
          meta_description: generatedPage.meta_description,
          status: project.wp_publish_status || "publish",
          page_template: project.wp_page_template || "",
          location: lkData.location?.name || "",
          keyword: lkData.keyword?.keyword || "",
        };

        // If updating, include the WordPress page ID
        if (isUpdate && lkData.wp_page_id) {
          wordpressData.page_id = lkData.wp_page_id;
        }

        console.log(`🌐 [WP QUEUE WORKER] Calling WordPress API: ${apiUrl}`);

        // Send to WordPress
        const wordpressResponse = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-GeoScale-API-Key": project.wp_api_key,
          },
          body: JSON.stringify(wordpressData),
        });

        if (!wordpressResponse.ok) {
          const errorText = await wordpressResponse.text();
          console.error("WordPress API error:", wordpressResponse.status, errorText);

          let errorMessage = "Failed to publish to WordPress";
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorJson.error || errorMessage;
          } catch (e) {
            errorMessage = `${errorMessage}: ${wordpressResponse.statusText}`;
          }

          throw new Error(errorMessage);
        }

        const wordpressResult = await wordpressResponse.json();
        console.log(`✅ [WP QUEUE WORKER] WordPress ${isUpdate ? 'update' : 'publish'} success:`, wordpressResult);

        // Update location_keyword with WordPress page info
        const updateData: any = {
          status: "pushed",
          wp_page_url: wordpressResult.page_url,
          updated_at: new Date().toISOString(),
        };

        // Only set wp_page_id if it's a new publish
        if (!isUpdate && wordpressResult.page_id) {
          updateData.wp_page_id = wordpressResult.page_id;
        }

        await supabase
          .from("location_keywords")
          .update(updateData)
          .eq("id", job.location_keyword_id);

        // Mark job as completed
        await supabase
          .from("wordpress_push_jobs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        // Log to api_logs
        await supabase.from("api_logs").insert({
          user_id: job.user_id,
          project_id: job.project_id,
          api_type: "wordpress",
          endpoint: apiUrl,
          method: "POST",
          status_code: 200,
          request_body: { job_id: job.id, phrase: lkData.phrase },
          response_body: { success: true, page_url: wordpressResult.page_url },
        });

        console.log(`✅ [WP QUEUE WORKER] Job ${job.id} completed successfully`);
        results.push({ job_id: job.id, success: true });

      } catch (error: any) {
        console.error(`❌ [WP QUEUE WORKER] Job ${job.id} failed:`, error);

        // Determine if we should retry
        const shouldRetry = job.attempts + 1 < job.max_attempts;
        const newStatus = shouldRetry ? "queued" : "failed";

        // Update job with error
        await supabase
          .from("wordpress_push_jobs")
          .update({
            status: newStatus,
            error_message: error.message || String(error),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        // Log error to api_logs
        await supabase.from("api_logs").insert({
          user_id: job.user_id,
          project_id: job.project_id,
          api_type: "wordpress",
          endpoint: "wordpress-push-queue",
          method: "POST",
          status_code: 500,
          request_body: { job_id: job.id },
          error_message: error.message || String(error),
        });

        results.push({ job_id: job.id, success: false, error: error.message });
      }
    }

    // Return summary of all processed jobs
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`🏁 [WP QUEUE WORKER] Batch complete: ${successCount} succeeded, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        succeeded: successCount,
        failed: failCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ [WP QUEUE WORKER] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
