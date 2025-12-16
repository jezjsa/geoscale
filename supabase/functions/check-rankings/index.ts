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
      .select("name, rank_check_daily_base, rank_check_per_site")
      .eq("id", userData.plan_id)
      .single();

    if (planError) throw planError;

    // Check if plan allows rank tracking
    if (plan.rank_check_daily_base === 0 && plan.rank_check_per_site === 0) {
      throw new Error("Rank tracking is not available on your plan. Please upgrade to Pro or Agency.");
    }

    // Count user's active projects to calculate daily quota
    const { count: projectCount, error: projectCountError } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", project.user_id);

    if (projectCountError) throw projectCountError;

    // Calculate daily quota: base + (per_site * number_of_projects)
    const dailyQuota = plan.rank_check_daily_base + (plan.rank_check_per_site * (projectCount || 1));

    console.log(`📊 Daily quota: ${plan.rank_check_daily_base} base + (${plan.rank_check_per_site} × ${projectCount} sites) = ${dailyQuota}`);

    // Get or create user_credits record
    let { data: credits, error: creditsError } = await supabase
      .from("user_credits")
      .select("*")
      .eq("user_id", project.user_id)
      .single();

    if (creditsError && creditsError.code === "PGRST116") {
      // No record exists, create one
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const { data: newCredits, error: insertError } = await supabase
        .from("user_credits")
        .insert({
          user_id: project.user_id,
          rank_checks_used_today: 0,
          rank_checks_reset_date: tomorrow.toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error("Failed to create user_credits:", insertError);
        throw new Error("Failed to initialize usage tracking");
      }
      credits = newCredits;
    } else if (creditsError) {
      throw new Error("Failed to check usage limits");
    }

    // Check if daily quota needs to be reset (new day)
    const now = new Date();
    const resetDate = new Date(credits.rank_checks_reset_date);
    
    if (now >= resetDate) {
      // Reset daily usage
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const { error: resetError } = await supabase
        .from("user_credits")
        .update({
          rank_checks_used_today: 0,
          rank_checks_reset_date: tomorrow.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("user_id", project.user_id);

      if (resetError) {
        console.error("Failed to reset daily usage:", resetError);
      } else {
        credits.rank_checks_used_today = 0;
        credits.rank_checks_reset_date = tomorrow.toISOString();
      }
    }

    // Calculate remaining checks for today
    const usedToday = credits.rank_checks_used_today || 0;
    const remainingToday = dailyQuota - usedToday;

    console.log(`📊 Usage today: ${usedToday}/${dailyQuota} (${remainingToday} remaining)`);

    if (remainingToday <= 0) {
      throw new Error(`You have used all ${dailyQuota} rank checks for today. Your quota resets at midnight.`);
    }

    console.log(`✅ Plan check passed: ${plan.name} (${dailyQuota} daily quota)`);


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

    // Limit combinations to remaining daily quota
    let combinationsToCheck = combinations;
    if (combinations.length > remainingToday) {
      console.log(`⚠️ Limiting to ${remainingToday} combinations (daily quota remaining)`);
      combinationsToCheck = combinations.slice(0, remainingToday);
    }

    // Create Basic Auth header for DataForSEO
    const auth = base64Encode(
      new TextEncoder().encode(`${dataForSeoLogin}:${dataForSeoPassword}`)
    );

    // Prepare tasks for DataForSEO (batch API call)
    const tasks = combinationsToCheck.map((combo: any) => {
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
        const combo = combinationsToCheck[i + j];

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

    // Update all combinations in database and record history
    if (updates.length > 0) {
      const historyRecords: any[] = [];
      
      for (const update of updates) {
        await supabase
          .from("location_keywords")
          .update({
            position: update.position,
            previous_position: update.previous_position,
            last_position_check: update.last_position_check,
          })
          .eq("id", update.id);

        // Add to history records
        historyRecords.push({
          location_keyword_id: update.id,
          project_id: project_id,
          position: update.position,
          checked_at: update.last_position_check,
        });
      }

      // Insert all history records
      if (historyRecords.length > 0) {
        const { error: historyError } = await supabase
          .from("position_history")
          .insert(historyRecords);

        if (historyError) {
          console.error("Failed to insert position history:", historyError);
        } else {
          console.log(`📈 Recorded ${historyRecords.length} position history entries`);
        }
      }
    }

    const rankedCount = updates.filter((u) => u.position !== null).length;

    // Update daily usage count
    const checksPerformed = updates.length;
    if (checksPerformed > 0) {
      const { error: usageError } = await supabase
        .from("user_credits")
        .update({
          rank_checks_used_today: (credits.rank_checks_used_today || 0) + checksPerformed,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", project.user_id);

      if (usageError) {
        console.error("Failed to update daily usage:", usageError);
      } else {
        console.log(`📊 Updated daily usage: ${usedToday} + ${checksPerformed} = ${usedToday + checksPerformed}/${dailyQuota}`);
      }
    }

    const newRemainingToday = remainingToday - checksPerformed;

    console.log(
      `✨ Updated ${updates.length} combinations (${rankedCount} ranked)`
    );

    return new Response(
      JSON.stringify({
        success: true,
        checked_count: updates.length,
        ranked_count: rankedCount,
        not_ranked_count: updates.length - rankedCount,
        daily_quota: dailyQuota,
        used_today: usedToday + checksPerformed,
        remaining_today: newRemainingToday,
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

