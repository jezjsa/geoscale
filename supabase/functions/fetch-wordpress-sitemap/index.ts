import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wordpressUrl, wordpressApiKey } = await req.json();

    if (!wordpressUrl || !wordpressApiKey) {
      return new Response(
        JSON.stringify({
          error: "WordPress URL and API key are required",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Prepare WordPress URL
    let wpUrl = wordpressUrl.trim();
    if (!wpUrl.startsWith("http://") && !wpUrl.startsWith("https://")) {
      wpUrl = "https://" + wpUrl;
    }
    wpUrl = wpUrl.replace(/\/$/, "");

    const apiUrl = `${wpUrl}/wp-json/geoscale/v1/sitemap`;

    console.log("Fetching WordPress sitemap from:", apiUrl);

    // Fetch sitemap from WordPress
    const wordpressResponse = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "X-GeoScale-API-Key": wordpressApiKey.trim(),
      },
    });

    if (!wordpressResponse.ok) {
      const errorText = await wordpressResponse.text();
      let errorMessage = "Failed to fetch sitemap";

      if (wordpressResponse.status === 401) {
        errorMessage = "Invalid API key";
      } else if (wordpressResponse.status === 404) {
        errorMessage =
          "GeoScale plugin endpoint not found - Please install/update the GeoScale plugin";
      } else {
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch (e) {
          errorMessage = `${errorMessage} (Status: ${wordpressResponse.status})`;
        }
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          status: wordpressResponse.status,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: wordpressResponse.status,
        }
      );
    }

    const data = await wordpressResponse.json();

    console.log(
      "WordPress sitemap fetched successfully:",
      data.total_items,
      "items",
      "SEO plugin:",
      data.seo_plugin
    );

    return new Response(
      JSON.stringify({
        success: true,
        sitemap: data.sitemap || [],
        total_items: data.total_items || 0,
        seo_plugin: data.seo_plugin || "none",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error fetching WordPress sitemap:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

