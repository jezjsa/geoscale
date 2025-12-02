import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GenerateContentRequest {
  locationKeywordIds: string[];
}

interface ProjectData {
  id: string;
  company_name: string | null;
  phone_number: string | null;
  contact_url: string | null;
  service_description: string | null;
  base_keyword: string | null;
}

interface LocationKeywordData {
  id: string;
  phrase: string;
  location: {
    name: string;
  };
  keyword: {
    keyword: string;
  };
  project_id: string;
  service_id: string | null;
}

interface TestimonialData {
  testimonial_text: string;
  customer_name: string | null;
  business_name: string | null;
}

interface ServiceFaqData {
  question: string;
  answer: string;
  sort_order: number | null;
}

interface GeneratedContent {
  title: string;
  content: string;
  meta_title: string;
  meta_description: string;
}

/**
 * Generate WordPress-style slug from title
 * Strips out the business name to ensure clean, keyword-focused URLs
 * Example: "Acme Corp Doncaster Web Design" -> "doncaster-web-design"
 */
function generateSlug(title: string, businessName?: string): string {
  let cleanTitle = title.trim();
  
  // Remove business name if provided
  if (businessName) {
    const businessNamePattern = new RegExp(
      businessName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), // Escape special regex chars
      'gi'
    );
    cleanTitle = cleanTitle.replace(businessNamePattern, '').trim();
  }
  
  return cleanTitle
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/--+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Verify the user
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Invalid token");
    }

    // Parse request body
    const { locationKeywordIds }: GenerateContentRequest = await req.json();

    if (!locationKeywordIds || !Array.isArray(locationKeywordIds)) {
      throw new Error("Invalid request: locationKeywordIds array is required");
    }

    const results = [];

    // Process each location keyword
    for (const locationKeywordId of locationKeywordIds) {
      try {
        // Update status to 'generating'
        await supabase
          .from("location_keywords")
          .update({ status: "generating", updated_at: new Date().toISOString() })
          .eq("id", locationKeywordId);

        // Fetch location keyword details with related data
        const { data: locationKeyword, error: lkError } = await supabase
          .from("location_keywords")
          .select(
            `
            id,
            phrase,
            project_id,
            service_id,
            location:project_locations!location_keywords_location_id_fkey(name),
            keyword:keyword_variations!location_keywords_keyword_id_fkey(keyword)
          `
          )
          .eq("id", locationKeywordId)
          .single();

        if (lkError || !locationKeyword) {
          throw new Error(`Failed to fetch location keyword: ${lkError?.message}`);
        }

        const lkData = locationKeyword as unknown as LocationKeywordData;

        // Fetch project details
        const { data: project, error: projectError } = await supabase
          .from("projects")
          .select("id, company_name, phone_number, contact_url, service_description, base_keyword")
          .eq("id", lkData.project_id)
          .single();

        if (projectError || !project) {
          throw new Error(`Failed to fetch project: ${projectError?.message}`);
        }

        const projectData = project as ProjectData;

        // Fetch a random testimonial for this project
        const { data: testimonials, error: testimonialsError } = await supabase
          .from("project_testimonials")
          .select("testimonial_text, customer_name, business_name")
          .eq("project_id", lkData.project_id);

        if (testimonialsError) {
          console.error("Failed to fetch testimonials:", testimonialsError);
        }

        // Select a random testimonial if available
        let testimonialBlock = "";
        if (testimonials && testimonials.length > 0) {
          const randomTestimonial = testimonials[
            Math.floor(Math.random() * testimonials.length)
          ] as TestimonialData;
          
          const attribution = [
            randomTestimonial.customer_name,
            randomTestimonial.business_name,
          ]
            .filter(Boolean)
            .join(", ");

          testimonialBlock = `"${randomTestimonial.testimonial_text}"${attribution ? ` - ${attribution}` : ""}`;
        }

        // Fetch service-specific FAQs if a service is associated
        let serviceFaqsBlock = "";
        if (lkData.service_id) {
          const { data: serviceFaqs, error: faqsError } = await supabase
            .from("service_faqs")
            .select("question, answer, sort_order")
            .eq("service_id", lkData.service_id)
            .order("sort_order", { ascending: true });

          if (faqsError) {
            console.error("Failed to fetch service FAQs:", faqsError);
          }

          if (serviceFaqs && serviceFaqs.length > 0) {
            const faqsList = (serviceFaqs as ServiceFaqData[])
              .map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`)
              .join("\n\n");
            serviceFaqsBlock = `Service-specific FAQs to include:\n${faqsList}`;
          }
        }

        // Build the prompt
        const serviceName = lkData.keyword.keyword || projectData.base_keyword || "service";
        const location = lkData.location.name;
        const businessName = projectData.company_name || "Our Business";
        const phoneNumber = projectData.phone_number || "";
        const contactUrl = projectData.contact_url || "";
        const serviceDescription = projectData.service_description || "";

        const prompt = `Create a complete geo targeted landing page for a service business.

Service: ${serviceName}
Location: ${location}
Target keyword phrase: ${serviceName} in ${location}

Business name: ${businessName}
Phone number: ${phoneNumber}
Contact page URL: ${contactUrl}

${testimonialBlock ? `Testimonial to include:\n${testimonialBlock}` : "No testimonials provided."}

${serviceDescription ? `Service description: ${serviceDescription}` : ""}

${serviceFaqsBlock || "No service-specific FAQs provided."}

Instructions:

1. DO NOT include an H1 heading in the content - WordPress will use the page title as the H1.

2. Write an intro paragraph wrapped in <div class="geo-intro">:
   - Explains what the service is and why it benefits local customers.
   - Mentions the business name.
   - Invites users to call the phone number${phoneNumber ? ` (${phoneNumber})` : ""} or use the contact page URL${contactUrl ? ` (${contactUrl})` : ""}.
   - Optionally includes a short testimonial sentence if it fits naturally.
   - Close with </div>

3. Create a section wrapped in <div class="geo-why-choose"> with a natural-sounding H2 heading about why to choose the business.
   - Use natural phrasing like "Why Choose ${businessName} for Web Design in ${location}" or "Why Choose ${businessName} as Your Web Design Agency in ${location}".
   - Adapt the phrasing to make grammatical sense with the service type (e.g., add "your" or rephrase as needed).
   - Include 5 to 7 bullet points.
   - You may reference outcomes that match the testimonials, but do not rewrite or change the testimonial quotes themselves.
   - Close with </div>

4. Create a section wrapped in <div class="geo-services"> with an H2 heading about the services offered.
   - Use natural phrasing like "Our Web Design Services" or "Web Design Services in ${location}".
   - Include 3 to 5 service sub headings with short paragraphs.
   - Close with </div>

5. Create a section wrapped in <div class="geo-testimonials"> titled: "What Our Clients Say".
   - Use the supplied testimonial if available.
   - Quote the testimonial exactly as provided inside quotation marks.
   - Wrap each testimonial in a div with class "testimonial" for proper HTML formatting.
   - Inside the div, use a blockquote for the quote and a p tag with class "testimonial-author" for attribution.
   - Example format: 
     <div class="testimonial">
       <blockquote>"Full testimonial quote here."</blockquote>
       <p class="testimonial-author"><em>- Name, Company/Role</em></p>
     </div>
   - Close with </div>

6. Create a clear call to action section wrapped in <div class="geo-cta">.
   - Tell users to call the phone number and link to the contact page URL.
   - You may briefly refer to the testimonial as social proof.
   - Close with </div>

7. Create an SEO friendly FAQ section wrapped in <div class="geo-faq">:
   - ONLY include this section if service-specific FAQs are provided above.
   - If service-specific FAQs are provided, use those questions and answers exactly as given, adapting only to include the location name where appropriate.
   - If NO service-specific FAQs are provided, DO NOT include any FAQ section at all - skip this section entirely.
   - Format each FAQ as an H3 for the question and a paragraph for the answer.
   - Close with </div>

8. Finish with a short summary wrapped in <div class="geo-summary"> reinforcing the main keyword and location.
   - Remind users they can call the phone number or use the contact page URL.
   - Close with </div>

Rules:
- All non testimonial text must be original, human sounding, and helpful.
- Use natural UK english.
- Do not invent prices or discounts unless clearly suggested in the input.
- Use the phone number, contact page URL, and testimonial exactly as provided.
- Do not fabricate or modify testimonial quotes.
- DO NOT create a "Recent Local Projects" section or any section with specific project examples.
- DO NOT invent specific businesses, projects, or case studies.
- Only use the 8 sections specified in the instructions above - do not add additional sections.
- Output ONLY valid HTML content (no markdown, no explanation text).
- DO NOT include an H1 tag in the content - start with the intro paragraph.
- Use semantic HTML tags (h2, h3, p, ul, li, etc.) but NO H1 tags.
- Include proper HTML structure but NO html, head, or body tags - just the content.

Also provide:
- A page title (will be used as the H1 heading by WordPress) - DO NOT include the business name in this title, just use the service and location (e.g., "Web Design in ${location}")
- A meta title (60 characters max) - CAN include the business name for SEO purposes
- A meta description (155 characters max)

Format your response as JSON:
{
  "title": "Service in Location (NO business name)",
  "meta_title": "Meta title here (can include business name)",
  "meta_description": "Meta description here",
  "content": "HTML content here"
}`;

        // Call OpenAI API with GPT-4 Turbo model
        const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4-turbo",
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
          }),
        });

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text();
          throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`);
        }

        const openaiData = await openaiResponse.json();
        const generatedText = openaiData.choices[0]?.message?.content;

        if (!generatedText) {
          throw new Error("No content generated from OpenAI");
        }

        // Parse the JSON response
        let generatedContent: GeneratedContent;
        try {
          // Try to extract JSON from the response (in case it's wrapped in markdown)
          const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            generatedContent = JSON.parse(jsonMatch[0]);
          } else {
            generatedContent = JSON.parse(generatedText);
          }
        } catch (parseError) {
          console.error("Failed to parse OpenAI response:", generatedText);
          throw new Error(`Failed to parse generated content: ${parseError.message}`);
        }

        // Generate WordPress-style slug from title (excluding business name)
        const slug = generateSlug(generatedContent.title, businessName);

        // Insert or update into generated_pages table
        const { data: generatedPage, error: insertError } = await supabase
          .from("generated_pages")
          .upsert({
            project_id: lkData.project_id,
            location_keyword_id: locationKeywordId,
            title: generatedContent.title,
            slug: slug,
            content: generatedContent.content,
            meta_title: generatedContent.meta_title,
            meta_description: generatedContent.meta_description,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'location_keyword_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (insertError) {
          throw new Error(`Failed to insert generated page: ${insertError.message}`);
        }

        // Update status to 'generated'
        await supabase
          .from("location_keywords")
          .update({ status: "generated", updated_at: new Date().toISOString() })
          .eq("id", locationKeywordId);

        // Log successful API call
        await supabase.from("api_logs").insert({
          user_id: user.id,
          project_id: lkData.project_id,
          api_type: "openai",
          endpoint: "/v1/chat/completions",
          method: "POST",
          status_code: 200,
          request_body: { model: "gpt-4-turbo", prompt_length: prompt.length },
          response_body: { success: true },
        });

        results.push({
          locationKeywordId,
          success: true,
          generatedPageId: generatedPage.id,
        });
      } catch (error) {
        console.error(`Error generating content for ${locationKeywordId}:`, error);

        // Update status to 'error'
        await supabase
          .from("location_keywords")
          .update({ status: "error", updated_at: new Date().toISOString() })
          .eq("id", locationKeywordId);

        // Log failed API call
        const { data: lkData } = await supabase
          .from("location_keywords")
          .select("project_id")
          .eq("id", locationKeywordId)
          .single();

        await supabase.from("api_logs").insert({
          user_id: user.id,
          project_id: lkData?.project_id,
          api_type: "openai",
          endpoint: "/v1/chat/completions",
          method: "POST",
          status_code: 500,
          error_message: error.message,
        });

        results.push({
          locationKeywordId,
          success: false,
          error: error.message,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in generate-content function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

