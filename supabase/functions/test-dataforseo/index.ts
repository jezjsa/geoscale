import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const dataForSeoLogin = Deno.env.get("DATAFORSEO_LOGIN");
    const dataForSeoPassword = Deno.env.get("DATAFORSEO_PASSWORD");

    console.log("Testing DataForSEO credentials...");
    console.log("Login exists:", !!dataForSeoLogin);
    console.log("Password exists:", !!dataForSeoPassword);
    
    if (dataForSeoLogin) {
      console.log("Login (first 4 chars):", dataForSeoLogin.substring(0, 4) + "***");
    }

    if (!dataForSeoLogin || !dataForSeoPassword) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "DataForSEO credentials are not set in Supabase secrets",
          hasLogin: !!dataForSeoLogin,
          hasPassword: !!dataForSeoPassword,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Basic Auth header
    const auth = base64Encode(
      new TextEncoder().encode(`${dataForSeoLogin}:${dataForSeoPassword}`)
    );

    console.log("Making test request to DataForSEO...");

    // Make a simple test request to DataForSEO to verify credentials
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
            keywords: ["test"],
            location_code: 2826, // United Kingdom
            language_code: "en",
            limit: 5,
          },
        ]),
      }
    );

    const responseText = await response.text();
    console.log("Response status:", response.status);
    console.log("Response:", responseText.substring(0, 500));

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "DataForSEO API returned an error",
          status: response.status,
          statusText: response.statusText,
          response: responseText,
          diagnosis: response.status === 401 
            ? "Credentials are invalid. Please check your DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in Supabase secrets."
            : "API error. Please check the response details.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = JSON.parse(responseText);

    // Check for API-level errors
    if (data.tasks?.[0]?.status_code !== 20000) {
      const errorMessage = data.tasks?.[0]?.status_message || "Unknown error";
      return new Response(
        JSON.stringify({
          success: false,
          error: `DataForSEO API error: ${errorMessage}`,
          taskStatusCode: data.tasks?.[0]?.status_code,
          fullResponse: data,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "✅ DataForSEO credentials are working correctly!",
        testResults: {
          status: response.status,
          statusCode: data.tasks?.[0]?.status_code,
          statusMessage: data.tasks?.[0]?.status_message,
          keywordsReturned: data.tasks?.[0]?.result?.[0]?.items?.length || 0,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error testing DataForSEO credentials:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

