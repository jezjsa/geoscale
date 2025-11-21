import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      combinationId,
      title,
      content,
      metaTitle,
      metaDescription,
      wordpressUrl,
      wordpressApiKey,
      pageTemplate,
      publishStatus,
      location,
      keyword,
    } = await req.json();

    if (!combinationId || !title || !content) {
      return new Response(
        JSON.stringify({
          error: "Combination ID, title, and content are required",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    if (!wordpressUrl || !wordpressApiKey) {
      return new Response(
        JSON.stringify({
          error: "WordPress URL and API Key are required",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Prepare WordPress API URL
    let wpUrl = wordpressUrl.trim();
    if (!wpUrl.startsWith("http://") && !wpUrl.startsWith("https://")) {
      wpUrl = "https://" + wpUrl;
    }
    wpUrl = wpUrl.replace(/\/$/, "");

    // Check if we're updating an existing page
    const { data: combination } = await supabase
      .from("location_keywords")
      .select("wp_page_id")
      .eq("id", combinationId)
      .single();

    const isUpdate = combination?.wp_page_id ? true : false;
    const endpoint = isUpdate ? "update" : "publish";
    const apiUrl = `${wpUrl}/wp-json/geoscale/v1/${endpoint}`;

    console.log(
      isUpdate ? "Updating WordPress page:" : "Publishing to WordPress:",
      apiUrl
    );

    // Prepare page data for WordPress
    const wordpressData: any = {
      title,
      content,
      meta_title: metaTitle,
      meta_description: metaDescription,
      status: publishStatus || "draft",
      page_template: pageTemplate || "",
      location,
      keyword,
    };

    // If updating, include the WordPress page ID
    if (isUpdate && combination?.wp_page_id) {
      wordpressData.page_id = combination.wp_page_id;
    }

    console.log("Sending data to WordPress:", {
      endpoint,
      has_template: !!pageTemplate,
      status: publishStatus,
    });

    // Send to WordPress
    const wordpressResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GeoScale-API-Key": wordpressApiKey,
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

      return new Response(
        JSON.stringify({
          error: errorMessage,
          details: errorText,
          status: wordpressResponse.status,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: wordpressResponse.status,
        }
      );
    }

    const wordpressResult = await wordpressResponse.json();
    console.log(
      isUpdate ? "WordPress update success:" : "WordPress publish success:",
      wordpressResult
    );

    // Update combination in Supabase with WordPress page info
    const updateData: any = {
      status: "pushed",
      wp_page_url: wordpressResult.page_url,
      updated_at: new Date().toISOString(),
    };

    // Only set wp_page_id if it's a new publish
    if (!isUpdate && wordpressResult.page_id) {
      updateData.wp_page_id = wordpressResult.page_id;
    }

    const { error: updateError } = await supabase
      .from("location_keywords")
      .update(updateData)
      .eq("id", combinationId);

    if (updateError) {
      console.error("Error updating combination:", updateError);
      // Don't fail the entire request, just log it
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: isUpdate
          ? "Page updated on WordPress successfully"
          : "Page published to WordPress successfully",
        page_id: wordpressResult.page_id || combination?.wp_page_id,
        edit_url: wordpressResult.edit_url,
        page_url: wordpressResult.page_url,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in publish-to-wordpress function:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return new Response(
      JSON.stringify({
        error: "Failed to publish page",
        details: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

