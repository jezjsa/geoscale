import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OptimiseRequest {
  content: string;
  keyword: string;
  location: string;
  failedChecks: {
    name: string;
    message: string;
    currentValue?: number;
    targetValue?: number;
  }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { content, keyword, location, failedChecks }: OptimiseRequest = await req.json();

    if (!content || !failedChecks || failedChecks.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openRouterApiKey) {
      throw new Error("OPENROUTER_API_KEY not configured");
    }

    // Build specific instructions based on failed checks
    const instructions: string[] = [];
    
    for (const check of failedChecks) {
      switch (check.name) {
        case "Content Length":
          if (check.message.includes("too long")) {
            instructions.push(`REDUCE content length. Current: ~${check.currentValue} words. Target: 300-700 words. Remove redundant sentences, combine paragraphs, and trim verbose sections. Keep the core message but make it more concise.`);
          } else if (check.message.includes("slightly longer")) {
            instructions.push(`SLIGHTLY EXPAND content. Current: ~${check.currentValue} words. Add 1-2 sentences of relevant local context. Target: 300-400 words.`);
          }
          break;
          
        case "Keyword Frequency":
          if (check.message.includes("over-optimised") || check.message.includes("slightly high")) {
            instructions.push(`REDUCE keyword "${keyword}" mentions. Current: ${check.currentValue} times. Target: 2-5 times. Replace some instances with pronouns ("we", "our service") or related terms.`);
          } else if (check.message.includes("could add")) {
            instructions.push(`ADD 1-2 natural mentions of "${keyword}". Current: ${check.currentValue} times. Target: 2-4 times. Insert naturally into existing sentences.`);
          }
          break;
          
        case "Location Frequency":
          if (check.message.includes("over-optimised") || check.message.includes("slightly high")) {
            instructions.push(`REDUCE location "${location}" mentions. Current: ${check.currentValue} times. Target: 3-6 times. Replace some with "the area", "locally", "nearby" or remove redundant mentions.`);
          } else if (check.message.includes("could add")) {
            instructions.push(`ADD 1-2 natural mentions of "${location}". Current: ${check.currentValue} times. Target: 3-5 times.`);
          }
          break;
          
        case "Heading Usage":
          if (check.message.includes("too many")) {
            instructions.push(`REDUCE keyword in headings. Current: ${check.currentValue} H2/H3 headings contain the keyword. Target: 0-1. Rewrite headings to be more generic or use related terms instead of the exact keyword.`);
          }
          break;
          
        case "Sales Pressure":
          instructions.push(`REMOVE aggressive sales language. Replace words like "best", "leading", "top", "award-winning", "premier", "guaranteed" with softer alternatives. Remove or soften any pricing mentions. Convert hard sells to helpful information.`);
          break;
          
        case "Keyword in Title":
          instructions.push(`ADD the keyword "${keyword}" to the title naturally. The title should imply service availability in the area.`);
          break;
          
        case "Location in Title":
          instructions.push(`ADD the location "${location}" to the title naturally.`);
          break;
      }
    }

    if (instructions.length === 0) {
      return new Response(
        JSON.stringify({ 
          optimisedContent: content,
          message: "No optimisations needed" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const prompt = `You are an SEO content optimiser for LOCAL SUBURB SUPPORT PAGES. These pages should be LIGHTER and LESS optimised than main town pages to avoid footprint patterns at scale.

CURRENT CONTENT:
${content}

REQUIRED CHANGES (apply ALL of these):
${instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n')}

RULES:
- Make ONLY the changes listed above
- Preserve the HTML structure (h1, h2, h3, p tags)
- Keep the same general flow and sections
- Do NOT add new sections or testimonials
- Do NOT add pricing or aggressive CTAs
- Maintain a helpful, supportive tone (not salesy)
- Output ONLY the optimised HTML content, no explanations

OUTPUT THE OPTIMISED HTML:`;

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": Deno.env.get("SUPABASE_URL") || "",
          "X-Title": "GeoScale Suburb Optimiser",
        },
        body: JSON.stringify({
          model: "x-ai/grok-4.1-fast",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 4000,
          temperature: 0.3,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", errorText);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const result = await response.json();
    const optimisedContent = result.choices?.[0]?.message?.content?.trim();

    if (!optimisedContent) {
      throw new Error("No content returned from AI");
    }

    return new Response(
      JSON.stringify({ 
        optimisedContent,
        changesApplied: instructions.length,
        message: `Applied ${instructions.length} optimisation(s)` 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error optimising suburb content:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to optimise content" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
