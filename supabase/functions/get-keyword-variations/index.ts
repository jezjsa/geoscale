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

// Cache duration in days
const CACHE_DAYS = 30;

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

    if (!dataForSeoLogin || !dataForSeoPassword) {
      throw new Error("DataForSEO credentials are not set");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const requestBody = await req.json();
    const {
      project_id,
      base_keyword,
      location = "GB",
      limit = 20,
    }: KeywordVariationsRequest = requestBody;

    const seedKeyword = base_keyword.toLowerCase().trim();
    const locationCode = 2826; // United Kingdom

    console.log(`📊 Checking cache for: "${seedKeyword}"`);

    // Check cache first - look for keywords updated within CACHE_DAYS
    const cacheThreshold = new Date();
    cacheThreshold.setDate(cacheThreshold.getDate() - CACHE_DAYS);

    const { data: cachedKeywords, error: cacheError } = await supabase
      .from("keyword_cache")
      .select("keyword, search_volume, difficulty, updated_at")
      .eq("seed_keyword", seedKeyword)
      .eq("location_code", locationCode)
      .gte("updated_at", cacheThreshold.toISOString())
      .order("search_volume", { ascending: false })
      .limit(limit);

    if (!cacheError && cachedKeywords && cachedKeywords.length >= limit) {
      console.log(`✅ Cache HIT! Found ${cachedKeywords.length} cached keywords for "${seedKeyword}"`);
      
      const keywords = cachedKeywords.map((kw) => ({
        keyword: kw.keyword,
        search_volume: kw.search_volume || 0,
        difficulty: kw.difficulty || null,
      }));

      // Still store in project's keyword_variations for their use
      const keywordsToInsert = keywords.map((kw) => ({
        project_id,
        keyword: kw.keyword,
        search_volume: kw.search_volume,
        difficulty: kw.difficulty,
      }));

      await supabase
        .from("keyword_variations")
        .upsert(keywordsToInsert, {
          onConflict: "project_id,keyword",
          ignoreDuplicates: true,
        });

      return new Response(
        JSON.stringify({
          success: true,
          keywords_count: keywords.length,
          new_keywords_count: 0,
          keywords,
          from_cache: true,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`🔍 Cache MISS for "${seedKeyword}", calling DataForSEO API...`);

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
            location_code: locationCode,
            language_code: "en",
            include_seed_keyword: true,
            include_serp_info: false,
            sort_by: "search_volume",
            limit: limit,
          },
        ]),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DataForSEO API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.tasks?.[0]?.status_code !== 20000) {
      const errorMessage = data.tasks?.[0]?.status_message || "Unknown error";
      throw new Error(`DataForSEO API error: ${errorMessage}`);
    }

    // Parse results - enforce limit client-side
    const allItems = data.tasks?.[0]?.result || [];
    const items = allItems.slice(0, limit);

    console.log(`📥 DataForSEO returned ${allItems.length} items, using ${items.length}`);

    const keywords = items.map((item: any) => ({
      keyword: item.keyword,
      search_volume: item.search_volume || 0,
      difficulty: item.competition_index || null,
    }));

    // Store in global cache for future users
    const cacheEntries = keywords.map((kw: any) => ({
      seed_keyword: seedKeyword,
      location_code: locationCode,
      keyword: kw.keyword,
      search_volume: kw.search_volume,
      difficulty: kw.difficulty,
      updated_at: new Date().toISOString(),
    }));

    const { error: cacheInsertError } = await supabase
      .from("keyword_cache")
      .upsert(cacheEntries, {
        onConflict: "seed_keyword,location_code,keyword",
      });

    if (cacheInsertError) {
      console.error("Failed to cache keywords:", cacheInsertError);
    } else {
      console.log(`💾 Cached ${cacheEntries.length} keywords for "${seedKeyword}"`);
    }

    // Store in project's keyword_variations
    const keywordsToInsert = keywords.map((kw: any) => ({
      project_id,
      keyword: kw.keyword,
      search_volume: kw.search_volume,
      difficulty: kw.difficulty,
    }));

    const { data: insertData, error } = await supabase
      .from("keyword_variations")
      .upsert(keywordsToInsert, {
        onConflict: "project_id,keyword",
        ignoreDuplicates: true,
      })
      .select();

    if (error) throw error;

    console.log(`✅ Stored ${insertData?.length || 0} keywords for project`);

    return new Response(
      JSON.stringify({
        success: true,
        keywords_count: keywords.length,
        new_keywords_count: insertData?.length || 0,
        keywords,
        from_cache: false,
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

