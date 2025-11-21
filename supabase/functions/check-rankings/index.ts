import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CheckRankingsRequest {
  project_id: string;
  combination_ids?: string[]; // Optional: check specific combinations only
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dataForSeoLogin = Deno.env.get("DATAFORSEO_LOGIN");
    const dataForSeoPassword = Deno.env.get("DATAFORSEO_PASSWORD");

    console.log("Environment check:", {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      hasDataForSeoLogin: !!dataForSeoLogin,
      hasDataForSeoPassword: !!dataForSeoPassword,
    });

    if (!dataForSeoLogin || !dataForSeoPassword) {
      throw new Error("DataForSEO credentials are not set");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const requestBody = await req.json();
    const { project_id, combination_ids }: CheckRankingsRequest = requestBody;

    console.log("🔍 Checking rankings for project:", project_id);

    // Get project details including blog_url
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("blog_url, wp_url")
      .eq("id", project_id)
      .single();

    if (projectError) throw projectError;

    if (!project.blog_url && !project.wp_url) {
      throw new Error(
        "Project must have either blog_url or wp_url set for rank tracking"
      );
    }

    // Use blog_url if available, otherwise fall back to wp_url
    const baseUrl = project.blog_url || project.wp_url;

    // Get combinations to check
    let query = supabase
      .from("location_keywords")
      .select(
        `
        id,
        phrase,
        status,
        slug,
        project_locations!inner(name, slug)
      `
      )
      .eq("project_id", project_id)
      .eq("status", "pushed"); // Only check pushed pages

    if (combination_ids && combination_ids.length > 0) {
      query = query.in("id", combination_ids);
    }

    const { data: combinations, error: combinationsError } = await query;

    if (combinationsError) throw combinationsError;

    if (!combinations || combinations.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No pushed combinations found to check",
          checked_count: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`📊 Found ${combinations.length} combinations to check`);

    // Create Basic Auth header for DataForSEO
    const auth = base64Encode(
      new TextEncoder().encode(`${dataForSeoLogin}:${dataForSeoPassword}`)
    );

    // Prepare tasks for DataForSEO (batch API call)
    const tasks = combinations.map((combo: any) => {
      // Construct the full URL
      const slug = combo.slug || combo.phrase.toLowerCase().replace(/\s+/g, "-");
      const fullUrl = `${baseUrl.replace(/\/$/, "")}/${slug}`;

      return {
        keyword: combo.phrase,
        url: fullUrl,
        location_code: 2826, // United Kingdom
        language_code: "en",
        device: "desktop",
        os: "windows",
      };
    });

    console.log(`🌐 Checking rankings for ${tasks.length} URLs`);
    console.log("Sample URL:", tasks[0]?.url);

    // Call DataForSEO SERP API (we'll do this in batches of 100)
    const batchSize = 100;
    const updates: any[] = [];

    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);

      // Call DataForSEO Google Organic SERP API
      const response = await fetch(
        "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            batch.map((task) => ({
              keyword: task.keyword,
              location_code: task.location_code,
              language_code: task.language_code,
              device: task.device,
              os: task.os,
              calculate_rectangles: false,
            }))
          ),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `DataForSEO API error: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();

      // Process results
      for (let j = 0; j < batch.length; j++) {
        const task = batch[j];
        const result = data.tasks?.[j];
        const combo = combinations[i + j];

        if (result?.status_code === 20000) {
          const items = result?.result?.[0]?.items || [];
          
          // Find the position of our URL in the results
          let position = null;
          for (let k = 0; k < items.length; k++) {
            const item = items[k];
            if (item.url && item.url.includes(task.url)) {
              position = item.rank_absolute || k + 1;
              break;
            }
          }

          // Get current position for comparison
          const { data: currentCombo } = await supabase
            .from("location_keywords")
            .select("position")
            .eq("id", combo.id)
            .single();

          updates.push({
            id: combo.id,
            position: position,
            previous_position: currentCombo?.position || null,
            last_position_check: new Date().toISOString(),
          });

          console.log(
            `✅ ${combo.phrase}: ${position ? `Position ${position}` : "Not ranked"}`
          );
        }
      }
    }

    // Update all combinations in database
    if (updates.length > 0) {
      for (const update of updates) {
        await supabase
          .from("location_keywords")
          .update({
            position: update.position,
            previous_position: update.previous_position,
            last_position_check: update.last_position_check,
          })
          .eq("id", update.id);
      }
    }

    const rankedCount = updates.filter((u) => u.position !== null).length;

    console.log(
      `✨ Updated ${updates.length} combinations (${rankedCount} ranked)`
    );

    return new Response(
      JSON.stringify({
        success: true,
        checked_count: updates.length,
        ranked_count: rankedCount,
        not_ranked_count: updates.length - rankedCount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error checking rankings:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

