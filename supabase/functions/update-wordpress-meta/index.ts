import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pageId, metaTitle, metaDescription, wordpressUrl, wordpressApiKey } = await req.json();

    if (!pageId || !wordpressUrl || !wordpressApiKey) {
      return new Response(
        JSON.stringify({
          error: "Page ID, WordPress URL and API key are required",
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

    const apiUrl = `${wpUrl}/wp-json/geoscale/v1/update-meta`;

    console.log("Updating WordPress page meta:", pageId);

    // Update meta in WordPress
    const wordpressResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "X-GeoScale-API-Key": wordpressApiKey.trim(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        page_id: pageId,
        meta_title: metaTitle,
        meta_description: metaDescription,
      }),
    });

    if (!wordpressResponse.ok) {
      const errorText = await wordpressResponse.text();
      let errorMessage = "Failed to update page meta";

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

    console.log("WordPress page meta updated successfully:", pageId);

    return new Response(
      JSON.stringify({
        success: true,
        message: data.message || "Page meta updated successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error updating WordPress page meta:", error);
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
