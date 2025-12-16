import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface KeywordMetricsRequest {
  project_id: string;
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

    if (!dataForSeoLogin || !dataForSeoPassword) {
      throw new Error("DataForSEO credentials are not set");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const requestBody = await req.json();
    const { project_id }: KeywordMetricsRequest = requestBody;

    if (!project_id) {
      throw new Error("project_id is required");
    }

    console.log(`📊 Fetching keyword metrics for project: ${project_id}`);

    // Get all combinations (location_keywords) for this project that are missing volume or difficulty
    // Include parent_location_id to handle suburb->parent inheritance
    const { data: combinations, error: fetchError } = await supabase
      .from("location_keywords")
      .select("id, phrase, search_volume, difficulty, parent_location_id")
      .eq("project_id", project_id);

    if (fetchError) throw fetchError;

    if (!combinations || combinations.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No combinations found for this project",
          updated_count: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Filter combinations that need data (missing volume OR difficulty)
    const combinationsNeedingData = combinations.filter(
      (combo) => combo.search_volume === null || combo.difficulty === null
    );

    if (combinationsNeedingData.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "All combinations already have volume and difficulty data",
          updated_count: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build a map of combination IDs to their parent's phrase (for suburb->parent inheritance)
    // First, create a map of all combinations by ID for quick lookup
    const combinationById = new Map<string, any>();
    for (const combo of combinations) {
      combinationById.set(combo.id, combo);
    }

    // For combinations with a parent_location_id, we need to look up the parent's phrase
    // The parent_location_id points to another location_keywords record
    const comboIdToLookupPhrase = new Map<string, string>();
    for (const combo of combinationsNeedingData) {
      if (combo.parent_location_id) {
        // This is a suburb - use the parent's phrase for API lookup
        const parent = combinationById.get(combo.parent_location_id);
        if (parent) {
          comboIdToLookupPhrase.set(combo.id, parent.phrase);
          console.log(`🏘️ Suburb "${combo.phrase}" will inherit metrics from parent "${parent.phrase}"`);
        } else {
          // Parent not found in current results, use own phrase
          comboIdToLookupPhrase.set(combo.id, combo.phrase);
        }
      } else {
        // Not a suburb - use own phrase
        comboIdToLookupPhrase.set(combo.id, combo.phrase);
      }
    }

    // Separate combinations by what data they need - only call APIs for those missing that specific data
    const combinationsNeedingVolume = combinationsNeedingData.filter((combo) => combo.search_volume === null);
    const combinationsNeedingDifficulty = combinationsNeedingData.filter((combo) => combo.difficulty === null);

    console.log(`🔍 Found ${combinationsNeedingVolume.length} phrases needing volume, ${combinationsNeedingDifficulty.length} needing difficulty`);

    // Create Basic Auth header
    const auth = base64Encode(
      new TextEncoder().encode(`${dataForSeoLogin}:${dataForSeoPassword}`)
    );

    const locationCode = 2826; // United Kingdom
    const batchSize = 700; // Use 700 to be safe with Google Ads limit

    const volumeResults: Map<string, number> = new Map();
    const difficultyResults: Map<string, number> = new Map();

    // Only call Search Volume API if there are phrases needing volume
    if (combinationsNeedingVolume.length > 0) {
      // Clean phrases for API: remove "in " prefix for better matching
      // Use the lookup phrase (which may be parent's phrase for suburbs)
      const volumePhrases = combinationsNeedingVolume.map((combo) => {
        const lookupPhrase = comboIdToLookupPhrase.get(combo.id) || combo.phrase;
        return lookupPhrase.replace(/ in /g, " ").replace(/ near /g, " ");
      });
      const volumeBatches: string[][] = [];
      for (let i = 0; i < volumePhrases.length; i += batchSize) {
        volumeBatches.push(volumePhrases.slice(i, i + batchSize));
      }

      for (const batch of volumeBatches) {
        console.log(`📡 Fetching volume for ${batch.length} phrases...`);
        try {
          const volumeResponse = await fetch(
            "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live",
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify([
                {
                  keywords: batch,
                  location_code: locationCode,
                  language_code: "en",
                },
              ]),
            }
          );

          if (volumeResponse.ok) {
            const volumeData = await volumeResponse.json();
            if (volumeData.tasks?.[0]?.status_code === 20000) {
              const items = volumeData.tasks?.[0]?.result || [];
              for (const item of items) {
                if (item.keyword && item.search_volume !== undefined) {
                  volumeResults.set(
                    item.keyword.toLowerCase(),
                    item.search_volume || 0
                  );
                }
              }
              console.log(`✅ Got search volume for ${items.length} phrases`);
            } else {
              console.error(
                "Search volume API error:",
                volumeData.tasks?.[0]?.status_message
              );
            }
          }
        } catch (err) {
          console.error("Error fetching search volume:", err);
        }

        // Small delay between batches
        if (volumeBatches.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    // Only call Difficulty API if there are phrases needing difficulty
    if (combinationsNeedingDifficulty.length > 0) {
      // Clean phrases for API - use lookup phrase (which may be parent's phrase for suburbs)
      const difficultyPhrases = combinationsNeedingDifficulty.map((combo) => {
        const lookupPhrase = comboIdToLookupPhrase.get(combo.id) || combo.phrase;
        return lookupPhrase.replace(/ in /g, " ").replace(/ near /g, " ");
      });
      const difficultyBatches: string[][] = [];
      for (let i = 0; i < difficultyPhrases.length; i += batchSize) {
        difficultyBatches.push(difficultyPhrases.slice(i, i + batchSize));
      }

      for (const batch of difficultyBatches) {
        console.log(`📡 Fetching difficulty for ${batch.length} phrases...`);
        try {
          const difficultyResponse = await fetch(
            "https://api.dataforseo.com/v3/dataforseo_labs/google/bulk_keyword_difficulty/live",
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify([
                {
                  keywords: batch,
                  location_code: locationCode,
                  language_code: "en",
                },
              ]),
            }
          );

          if (difficultyResponse.ok) {
            const difficultyData = await difficultyResponse.json();
            if (difficultyData.tasks?.[0]?.status_code === 20000) {
              const items = difficultyData.tasks?.[0]?.result?.[0]?.items || [];
              for (const item of items) {
                if (item.keyword && item.keyword_difficulty !== undefined) {
                  difficultyResults.set(
                    item.keyword.toLowerCase(),
                    item.keyword_difficulty
                  );
                }
              }
              console.log(`✅ Got difficulty for ${items.length} phrases`);
            } else {
              console.error(
                "Difficulty API error:",
                difficultyData.tasks?.[0]?.status_message
              );
            }
          }
        } catch (err) {
          console.error("Error fetching difficulty:", err);
        }

        // Small delay between batches
        if (difficultyBatches.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    // Update combinations in database
    let updatedCount = 0;
    for (const combo of combinationsNeedingData) {
      // Use the lookup phrase (which may be parent's phrase for suburbs) for matching API results
      const lookupPhrase = comboIdToLookupPhrase.get(combo.id) || combo.phrase;
      const phraseClean = lookupPhrase.replace(/ in /g, " ").replace(/ near /g, " ").toLowerCase();
      const newVolume = volumeResults.get(phraseClean);
      const newDifficulty = difficultyResults.get(phraseClean);

      // Only update if we have new data
      if (newVolume !== undefined || newDifficulty !== undefined) {
        const updateData: { search_volume?: number; difficulty?: number } = {};

        if (newVolume !== undefined && combo.search_volume === null) {
          updateData.search_volume = newVolume;
        }
        if (newDifficulty !== undefined && combo.difficulty === null) {
          updateData.difficulty = newDifficulty;
        }

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from("location_keywords")
            .update(updateData)
            .eq("id", combo.id);

          if (!updateError) {
            updatedCount++;
          } else {
            console.error(`Failed to update combination ${combo.phrase}:`, updateError);
          }
        }
      }
    }

    console.log(`✅ Updated ${updatedCount} combinations with new data`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Updated ${updatedCount} combinations with volume/difficulty data`,
        updated_count: updatedCount,
        total_combinations: combinations.length,
        combinations_processed: combinationsNeedingData.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error getting keyword metrics:", error);
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
