import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface KeywordVariationsRequest {
  project_id: string;
  base_keyword: string;
  location?: string;
  limit?: number;
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

    // For now, skip JWT verification during development
    // TODO: Re-enable JWT verification for production

    const requestBody = await req.json();
    console.log("Request body:", requestBody);

    const {
      project_id,
      base_keyword,
      location = "GB",
      limit = 50,
    }: KeywordVariationsRequest = requestBody;

    console.log("📊 Fetching keyword variations for:", base_keyword);

    // Create Basic Auth header
    const auth = base64Encode(
      new TextEncoder().encode(`${dataForSeoLogin}:${dataForSeoPassword}`)
    );

    // Call DataForSEO Keywords For Keywords API
    const response = await fetch(
      "https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            keywords: [base_keyword],
            location_code: 2826, // United Kingdom
            language_code: "en",
            include_seed_keyword: true,
            include_serp_info: false, // Disable SERP info to reduce cost
            sort_by: "search_volume",
            filters: [
              ["search_volume", ">", 100], // Only keywords with >100 monthly searches
              ["competition_index", "<", 80], // Only low-medium competition
            ],
            limit: limit, // This limits the number of results returned
            order_by: ["search_volume,desc"], // Order by search volume descending
          },
        ]),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DataForSEO API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    console.log("DataForSEO Response:", JSON.stringify(data, null, 2));

    // Check for API errors
    if (data.tasks?.[0]?.status_code !== 20000) {
      const errorMessage = data.tasks?.[0]?.status_message || "Unknown error";
      throw new Error(`DataForSEO API error: ${errorMessage}`);
    }

    // Parse results - the result array IS the items
    const items = data.tasks?.[0]?.result || [];

    console.log(`Raw items count: ${items.length}`);
    
    // Limit results to the requested amount (DataForSEO sometimes ignores the limit parameter)
    const limitedItems = items.slice(0, limit);
    
    if (limitedItems.length > 0) {
      console.log("First item sample:", JSON.stringify(limitedItems[0], null, 2));
    }

    const keywords = limitedItems.map((item: any) => ({
      keyword: item.keyword,
      search_volume: item.search_volume || 0,
      difficulty: item.competition_index || null, // Using competition_index as difficulty
    }));

    console.log(`✅ Found ${keywords.length} keyword variations (limited from ${items.length})`);

    // Store keywords in database
    const keywordsToInsert = keywords.map((kw: any) => ({
      project_id,
      keyword: kw.keyword,
      search_volume: kw.search_volume,
      difficulty: kw.difficulty,
    }));

    // Use upsert with ignoreDuplicates to skip existing keywords
    const { data: insertData, error } = await supabase
      .from("keyword_variations")
      .upsert(keywordsToInsert, {
        onConflict: "project_id,keyword",
        ignoreDuplicates: true,
      })
      .select();

    if (error) throw error;

    console.log(
      `💾 Stored ${insertData?.length || 0} new keywords (${
        keywordsToInsert.length - (insertData?.length || 0)
      } were duplicates)`
    );

    return new Response(
      JSON.stringify({
        success: true,
        keywords_count: keywords.length,
        new_keywords_count: insertData?.length || 0,
        keywords,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error getting keyword variations:", error);
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

