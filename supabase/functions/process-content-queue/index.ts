import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Note: This function is called by cron jobs, so we don't verify JWT
    // The function itself uses service role key for all operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("🔄 [QUEUE WORKER] Starting queue processing...");

    // Get the next queued job (ordered by priority desc, then created_at asc)
    const { data: jobs, error: fetchError } = await supabase
      .from("content_generation_jobs")
      .select("*")
      .eq("status", "queued")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1);

    if (fetchError) {
      console.error("❌ [QUEUE WORKER] Error fetching jobs:", fetchError);
      throw fetchError;
    }

    if (!jobs || jobs.length === 0) {
      console.log("✅ [QUEUE WORKER] No jobs in queue");
      return new Response(
        JSON.stringify({ success: true, message: "No jobs to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const job = jobs[0];
    
    // Check if job has exceeded max attempts
    if (job.attempts >= job.max_attempts) {
      console.log(`⚠️ [QUEUE WORKER] Job ${job.id} has exceeded max attempts, skipping`);
      await supabase
        .from("content_generation_jobs")
        .update({ status: "failed" })
        .eq("id", job.id);
      return new Response(
        JSON.stringify({ success: true, message: "Job exceeded max attempts" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`📋 [QUEUE WORKER] Processing job ${job.id} for location_keyword ${job.location_keyword_id}`);

    // Mark job as processing
    const { error: updateError } = await supabase
      .from("content_generation_jobs")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
        attempts: job.attempts + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (updateError) {
      console.error("❌ [QUEUE WORKER] Error updating job status:", updateError);
      throw updateError;
    }

    // Also update location_keyword status
    await supabase
      .from("location_keywords")
      .update({ status: "generating" })
      .eq("id", job.location_keyword_id);

    try {
      // Fetch location keyword data
      const { data: lkData, error: lkError } = await supabase
        .from("location_keywords")
        .select(`
          *,
          location:project_locations!location_id(*),
          keyword:keyword_variations!keyword_id(*),
          project:projects!project_id(*)
        `)
        .eq("id", job.location_keyword_id)
        .single();

      if (lkError || !lkData) {
        throw new Error(`Location keyword not found: ${job.location_keyword_id}`);
      }

      console.log(`📝 [QUEUE WORKER] Generating content for: ${lkData.phrase}`);

      // Build the prompt
      const prompt = `You are an expert SEO content writer. Create a comprehensive, engaging landing page for the following:

Business: ${lkData.project.company_name || lkData.project.project_name}
Service: ${lkData.project.service_description || lkData.keyword.keyword}
Location: ${lkData.location.name}
Target Keyword: "${lkData.phrase}"
${lkData.project.contact_name ? `Contact: ${lkData.project.contact_name}` : ''}
${lkData.project.phone_number ? `Phone: ${lkData.project.phone_number}` : ''}
${lkData.project.contact_url ? `Website: ${lkData.project.contact_url}` : ''}

Create a landing page with:
- A compelling H1 title (DO NOT include the business name in the H1)
- Well-structured HTML content with proper headings (h2, h3)
- Natural keyword integration
- Local relevance for ${lkData.location.name}
- Clear call-to-action
- Professional, engaging tone
- 800-1200 words
- A meta title (can include business name)
- A meta description (155 characters max)

Format your response as JSON:
{
  "title": "Service in Location (NO business name)",
  "meta_title": "Meta title here (can include business name)",
  "meta_description": "Meta description here",
  "content": "HTML content here"
}`;

      // Call OpenAI API
      console.log(`🤖 [QUEUE WORKER] Calling OpenAI API...`);
      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4-turbo",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`);
      }

      const openaiData = await openaiResponse.json();
      const generatedText = openaiData.choices[0]?.message?.content;

      if (!generatedText) {
        throw new Error("No content generated from OpenAI");
      }

      console.log(`✅ [QUEUE WORKER] OpenAI response received`);

      // Parse JSON response
      let parsedContent;
      try {
        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedContent = JSON.parse(jsonMatch[0]);
        } else {
          parsedContent = JSON.parse(generatedText);
        }
      } catch (parseError) {
        console.error("❌ [QUEUE WORKER] JSON parse error:", parseError);
        throw new Error(`Failed to parse OpenAI response: ${parseError.message}`);
      }

      // Generate slug
      const slug = lkData.phrase
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      // Upsert generated page
      console.log(`💾 [QUEUE WORKER] Saving generated content...`);
      const { data: generatedPage, error: insertError } = await supabase
        .from("generated_pages")
        .upsert({
          project_id: lkData.project_id,
          location_keyword_id: job.location_keyword_id,
          title: parsedContent.title,
          slug: slug,
          content: parsedContent.content,
          meta_title: parsedContent.meta_title || parsedContent.title,
          meta_description: parsedContent.meta_description || "",
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("❌ [QUEUE WORKER] Error saving content:", insertError);
        throw insertError;
      }

      // Update location_keyword status to generated
      await supabase
        .from("location_keywords")
        .update({ status: "generated", updated_at: new Date().toISOString() })
        .eq("id", job.location_keyword_id);

      // Mark job as completed
      await supabase
        .from("content_generation_jobs")
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
        api_type: "openai",
        endpoint: "/v1/chat/completions",
        method: "POST",
        status_code: 200,
        request_body: { model: "gpt-4-turbo", prompt_length: prompt.length, job_id: job.id },
        response_body: { success: true, generated_page_id: generatedPage.id },
      });

      console.log(`✅ [QUEUE WORKER] Job ${job.id} completed successfully`);

      return new Response(
        JSON.stringify({
          success: true,
          job_id: job.id,
          location_keyword_id: job.location_keyword_id,
          generated_page_id: generatedPage.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      console.error(`❌ [QUEUE WORKER] Job ${job.id} failed:`, error);

      // Determine if we should retry
      const shouldRetry = job.attempts + 1 < job.max_attempts;
      const newStatus = shouldRetry ? "queued" : "failed";

      // Update job with error
      await supabase
        .from("content_generation_jobs")
        .update({
          status: newStatus,
          error_message: error.message || String(error),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      // Update location_keyword status
      await supabase
        .from("location_keywords")
        .update({ status: "error", updated_at: new Date().toISOString() })
        .eq("id", job.location_keyword_id);

      // Log error to api_logs
      await supabase.from("api_logs").insert({
        user_id: job.user_id,
        project_id: job.project_id,
        api_type: "openai",
        endpoint: "/v1/chat/completions",
        method: "POST",
        status_code: 500,
        request_body: { job_id: job.id },
        error_message: error.message || String(error),
      });

      throw error;
    }
  } catch (error: any) {
    console.error("❌ [QUEUE WORKER] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
