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

    // Get JWT from Authorization header to identify the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header is required");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Invalid authorization token");
    }

    // Get project details including blog_url and user_id
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("blog_url, wp_url, user_id")
      .eq("id", project_id)
      .single();

    if (projectError) throw projectError;

    // Get user's plan information
    const { data: userData, error: userDataError } = await supabase
      .from("users")
      .select("plan_id")
      .eq("id", project.user_id)
      .single();

    if (userDataError) throw userDataError;

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("name, rank_tracking_frequency")
      .eq("id", userData.plan_id)
      .single();

    if (planError) throw planError;

    // Check the last time rankings were checked for this project
    const { data: lastCheck } = await supabase
      .from("location_keywords")
      .select("last_position_check")
      .eq("project_id", project_id)
      .not("last_position_check", "is", null)
      .order("last_position_check", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastCheck?.last_position_check) {
      const lastCheckTime = new Date(lastCheck.last_position_check);
      const now = new Date();
      const hoursSinceLastCheck = (now.getTime() - lastCheckTime.getTime()) / (1000 * 60 * 60);

      // Enforce frequency limits based on plan
      if (plan.rank_tracking_frequency === "weekly") {
        const weekInHours = 7 * 24; // 168 hours
        if (hoursSinceLastCheck < weekInHours) {
          const hoursRemaining = Math.ceil(weekInHours - hoursSinceLastCheck);
          const daysRemaining = Math.ceil(hoursRemaining / 24);
          throw new Error(
            `Starter plan allows weekly ranking checks. Please wait ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} before checking again. Upgrade to Pro for daily checks.`
          );
        }
      } else if (plan.rank_tracking_frequency === "every_other_day") {
        const everyOtherDayInHours = 48; // 48 hours
        if (hoursSinceLastCheck < everyOtherDayInHours) {
          const hoursRemaining = Math.ceil(everyOtherDayInHours - hoursSinceLastCheck);
          if (hoursRemaining > 24) {
            const daysRemaining = Math.ceil(hoursRemaining / 24);
            throw new Error(
              `You can check rankings every other day. Please wait ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} before checking again.`
            );
          } else {
            throw new Error(
              `You can check rankings every other day. Please wait ${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''} before checking again.`
            );
          }
        }
      } else if (plan.rank_tracking_frequency === "daily") {
        const dayInHours = 24;
        if (hoursSinceLastCheck < dayInHours) {
          const hoursRemaining = Math.ceil(dayInHours - hoursSinceLastCheck);
          throw new Error(
            `You can check rankings once per day. Please wait ${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''} before checking again.`
          );
        }
      }
    }

    console.log(`✅ Plan check passed: ${plan.name} (${plan.rank_tracking_frequency})`);


    if (!project.blog_url && !project.wp_url) {
      throw new Error(
        "Project must have either blog_url or wp_url set for rank tracking"
      );
    }

    // Use blog_url if available, otherwise fall back to wp_url
    const baseUrl = project.blog_url || project.wp_url;

    // Get combinations to check - include generated_pages to get the slug
    let query = supabase
      .from("location_keywords")
      .select(
        `
        id,
        phrase,
        status,
        project_locations!inner(name, slug),
        generated_pages(slug)
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
          message: "No pushed combinations found to check. Push pages to WordPress first, then check rankings.",
          checked_count: 0,
          ranked_count: 0,
          not_ranked_count: 0,
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
      // Construct the full URL using the slug from generated_pages
      // generated_pages is an array, get the first one's slug
      const pageSlug = combo.generated_pages?.[0]?.slug || combo.phrase.toLowerCase().replace(/\s+/g, "-");
      const fullUrl = `${baseUrl.replace(/\/$/, "")}/${pageSlug}`;

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

