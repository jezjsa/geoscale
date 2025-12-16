import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configuration - v14 with onConflict fix
const BATCH_SIZE = 5; // Process up to 5 jobs per cron run
const MAX_EXECUTION_TIME_MS = 50000; // Stop processing after 50 seconds to avoid timeout

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results: Array<{ job_id: string; success: boolean; error?: string }> = [];

  try {
    // Note: This function is called by cron jobs, so we don't verify JWT
    // The function itself uses service role key for all operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`🔄 [QUEUE WORKER] Starting batch processing (up to ${BATCH_SIZE} jobs)...`);

    // Get batch of queued jobs (ordered by priority desc, then created_at asc)
    const { data: jobs, error: fetchError } = await supabase
      .from("content_generation_jobs")
      .select("*")
      .eq("status", "queued")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("❌ [QUEUE WORKER] Error fetching jobs:", fetchError);
      throw fetchError;
    }

    if (!jobs || jobs.length === 0) {
      console.log("✅ [QUEUE WORKER] No jobs in queue");
      return new Response(
        JSON.stringify({ success: true, message: "No jobs to process", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📋 [QUEUE WORKER] Found ${jobs.length} jobs to process`);

    // Process each job in sequence
    for (const job of jobs) {
      // Check if we're running out of time
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        console.log(`⏱️ [QUEUE WORKER] Approaching timeout, stopping batch processing`);
        break;
      }

      // Check if job has exceeded max attempts
      if (job.attempts >= job.max_attempts) {
        console.log(`⚠️ [QUEUE WORKER] Job ${job.id} has exceeded max attempts, marking as failed`);
        await supabase
          .from("content_generation_jobs")
          .update({ status: "failed" })
          .eq("id", job.id);
        results.push({ job_id: job.id, success: false, error: "Max attempts exceeded" });
        continue;
      }
    
      console.log(`📋 [QUEUE WORKER] Processing job ${job.id} for location_keyword ${job.location_keyword_id}`);

      // Mark job as processing
      const { error: updateError } = await supabase
        .from("content_generation_jobs")
        .update({
          status: "processing",
          started_at: new Date().toISOString(),
          attempts: job.attempts + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (updateError) {
        console.error("❌ [QUEUE WORKER] Error updating job status:", updateError);
        results.push({ job_id: job.id, success: false, error: updateError.message });
        continue;
      }

      // Also update location_keyword status
      await supabase
        .from("location_keywords")
        .update({ status: "generating" })
        .eq("id", job.location_keyword_id);

      try {
        // Fetch location keyword data
        const { data: lkData, error: lkError } = await supabase
          .from("location_keywords")
          .select(`
            *,
            location:project_locations!location_id(*),
            keyword:keyword_variations!keyword_id(*),
            project:projects!project_id(*)
          `)
          .eq("id", job.location_keyword_id)
          .single();

        if (lkError || !lkData) {
          throw new Error(`Location keyword not found: ${job.location_keyword_id}`);
        }

        console.log(`📝 [QUEUE WORKER] Generating content for: ${lkData.phrase}`);

        // Fetch service page URL if service is associated
        let servicePageUrl = "";
        if (lkData.service_id) {
          const { data: serviceData } = await supabase
            .from("project_services")
            .select("service_page_url")
            .eq("id", lkData.service_id)
            .single();
          if (serviceData?.service_page_url) {
            servicePageUrl = serviceData.service_page_url;
          }
        }

        // Fetch parent town data if this is a suburb page
        let parentTownData: { phrase: string; wp_page_url: string | null; location: any } | null = null;
        if (lkData.parent_location_id) {
          const { data: parentData } = await supabase
            .from("location_keywords")
            .select(`
              phrase,
              wp_page_url,
              location:project_locations!location_keywords_location_id_fkey(name)
            `)
            .eq("id", lkData.parent_location_id)
            .single();
          if (parentData) {
            parentTownData = parentData as any;
          }
        }

        // Build internal linking blocks
        const serviceName = lkData.keyword?.keyword || "service";
        const location = lkData.location?.name || "";
        const businessName = lkData.project?.company_name || lkData.project?.project_name || "Our Business";
        const phoneNumber = lkData.project?.phone_number || "";
        const contactUrl = lkData.project?.contact_url || "";
        const serviceDescription = lkData.project?.service_description || "";

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
          ] as any;
          
          const attribution = [
            randomTestimonial.customer_name,
            randomTestimonial.business_name,
          ]
            .filter(Boolean)
            .join(", ");

          testimonialBlock = `"${randomTestimonial.testimonial_text}"${attribution ? ` - ${attribution}` : ""}`;
        }

        // Fetch all project services to include in prompt
        let projectServicesBlock = "";
        const { data: projectServices, error: servicesError } = await supabase
          .from("project_services")
          .select("name, description")
          .eq("project_id", lkData.project_id);

        if (servicesError) {
          console.error("Failed to fetch project services:", servicesError);
        }

        if (projectServices && projectServices.length > 0) {
          const servicesList = projectServices
            .map((s: any) => s.description ? `- ${s.name}: ${s.description}` : `- ${s.name}`)
            .join("\n");
          projectServicesBlock = servicesList;
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
            const faqsList = (serviceFaqs as any[])
              .map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`)
              .join("\n\n");
            serviceFaqsBlock = faqsList;
          }
        }

        let internalLinkingBlock = "";
        let internalLinkingInstructions = "";

        if (parentTownData) {
          // This is a suburb page
          const parentLocation = Array.isArray(parentTownData.location) 
            ? parentTownData.location[0]?.name 
            : parentTownData.location?.name;
          
          internalLinkingBlock = `
INTERNAL LINKING DATA (Suburb Page):
- Parent Town: ${parentLocation || "Unknown"}
- Parent Town URL: ${parentTownData.wp_page_url || "Not yet published"}
${servicePageUrl ? `- Main Service Page URL: ${servicePageUrl}` : ""}`;

          internalLinkingInstructions = `
INTERNAL LINKING INSTRUCTIONS (Suburb Page):
${parentTownData.wp_page_url ? `- In the intro or summary section, include a natural link to the parent town page.
  Example: "For wider coverage across the area, see our main <a href="${parentTownData.wp_page_url}">${serviceName} in ${parentLocation}</a> page."` : "- Parent town page not yet published, skip parent link for now."}
${servicePageUrl ? `- In the CTA section, include a link to the main service page.
  Example: "Learn more about all our <a href="${servicePageUrl}">${serviceName} services</a>."` : ""}`;
        } else if (servicePageUrl) {
          // Regular page with just service page link
          internalLinkingBlock = `
INTERNAL LINKING DATA:
- Main Service Page URL: ${servicePageUrl}`;

          internalLinkingInstructions = `
INTERNAL LINKING INSTRUCTIONS:
- In the CTA or summary section, include a link to the main service page.
  Example: "Learn more about all our <a href="${servicePageUrl}">${serviceName} services</a>."`;
        }

        // Build the prompt
        const prompt = `Create a comprehensive, SEO-optimized landing page for a service business that will rank highly in Google search results.

Service: ${serviceName}
Location: ${location}
Target keyword phrase: ${serviceName} in ${location}

Business name: ${businessName}
Phone number: ${phoneNumber}
Contact page URL: ${contactUrl}
${internalLinkingBlock}

${testimonialBlock ? `Testimonial to include:\n${testimonialBlock}` : "No testimonials provided."}

${serviceDescription ? `Service description: ${serviceDescription}` : ""}

${projectServicesBlock ? `Services offered by this business:\n${projectServicesBlock}` : ""}

${serviceFaqsBlock ? `Service-specific FAQs to include:\n${serviceFaqsBlock}` : ""}
${internalLinkingInstructions}

Create a complete, engaging landing page article that includes:

**REQUIRED ELEMENTS (must be included):**
- Business name and location prominently featured
- Phone number and contact URL in the content
- At least one customer testimonial (use the provided testimonial exactly) - skip if none provided
- Clear call-to-action at the end

**CONTENT STRUCTURE (flexible but comprehensive):**
- **Introduction**: Compelling opening that explains the service benefits and includes business name
- **Why Choose Section**: 4-6 compelling reasons to choose this business (can include local expertise, unique selling points, benefits)
- **Services/Process Section**: ONLY list services from "Services offered by this business" above. If no services are provided, write general content about the main service type
- **Testimonials**: Include the provided testimonial(s) in a dedicated section - skip if none provided
- **Benefits/Value Proposition**: Additional reasons this service is valuable
- **FAQ Section**: ONLY include if "Service-specific FAQs to include:" appears above with actual FAQs. If no FAQs are provided, DO NOT create or invent any FAQ section
- **Strong Call-to-Action**: End with clear contact information and next steps

**CRITICAL RULES - DO NOT VIOLATE:**
- DO NOT invent case studies, client projects, portfolio examples, or success stories
- DO NOT fabricate statistics or metrics (e.g., "50% increase", "reduced by X%", "X+ clients served")
- DO NOT claim specific outcomes or results for unnamed clients
- DO NOT create fake testimonials - only use the exact testimonial text provided above
- DO NOT invent specific business names, project names, or client names
- Only make general claims about service quality and expertise, not specific measurable results
- All claims must be general and non-specific (e.g., "we deliver quality results" NOT "we increased sales by 50%")
- DO NOT invent service names - only use services listed in "Services offered by this business" above
- If no services list is provided, only discuss the main service type generically

**SEO REQUIREMENTS:**
- Natural keyword integration throughout (aim for 3-6 keyword mentions)
- Local relevance and location mentions (4-8 location references)
- Professional, engaging tone suitable for B2B or local business audience
- 800-1500 words of high-quality, original content
- Mobile-friendly structure
- Schema markup friendly (use proper headings, lists, etc.)

**FORMATTING:**
- Use semantic HTML: h2, h3, p, ul, li, strong, em
- Tables for comparisons if helpful
- No H1 tags (WordPress uses page title as H1)
- Proper alt text for any images mentioned
- Clean, readable structure

${internalLinkingInstructions}

Format your response as JSON:
{
  "title": "Service in Location (NO business name)",
  "meta_title": "Meta title here (can include business name)",
  "meta_description": "Meta description here (150 characters max)",
  "content": "HTML content here"
}`;

        // Call OpenRouter API
        console.log(`🤖 [QUEUE WORKER] Calling OpenRouter API...`);
        const openaiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openrouterApiKey}`,
            "HTTP-Referer": supabaseUrl,
            "X-Title": "GeoScale",
          },
          body: JSON.stringify({
            model: "x-ai/grok-4.1-fast",
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
          throw new Error(`OpenRouter API error: ${openaiResponse.status} - ${errorText}`);
        }

        const openaiData = await openaiResponse.json();
        const generatedText = openaiData.choices[0]?.message?.content;

        if (!generatedText) {
          throw new Error("No content generated from OpenRouter");
        }

        console.log(`✅ [QUEUE WORKER] OpenRouter response received`);

        // Parse JSON response
        let parsedContent;
        try {
          const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedContent = JSON.parse(jsonMatch[0]);
          } else {
            parsedContent = JSON.parse(generatedText);
          }
        } catch (parseError: any) {
          console.error("❌ [QUEUE WORKER] JSON parse error:", parseError);
          throw new Error(`Failed to parse OpenRouter response: ${parseError.message}`);
        }

        // Generate slug
        const slug = lkData.phrase
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

        // Upsert generated page
        console.log(`💾 [QUEUE WORKER] Saving generated content...`);
        const { data: generatedPage, error: insertError } = await supabase
          .from("generated_pages")
          .upsert({
            project_id: lkData.project_id,
            location_keyword_id: job.location_keyword_id,
            title: parsedContent.title,
            slug: slug,
            content: parsedContent.content,
            meta_title: parsedContent.meta_title || parsedContent.title,
            meta_description: parsedContent.meta_description || "",
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'location_keyword_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (insertError) {
          console.error("❌ [QUEUE WORKER] Error saving content:", insertError);
          throw insertError;
        }

        // Update location_keyword status to generated
        await supabase
          .from("location_keywords")
          .update({ status: "generated", updated_at: new Date().toISOString() })
          .eq("id", job.location_keyword_id);

        // Mark job as completed
        await supabase
          .from("content_generation_jobs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        // Log to api_logs
        await supabase.from("api_logs").insert({
          user_id: job.user_id,
          project_id: job.project_id,
          api_type: "openrouter",
          endpoint: "/v1/chat/completions",
          method: "POST",
          status_code: 200,
          request_body: { model: "x-ai/grok-4.1-fast", prompt_length: prompt.length, job_id: job.id },
          response_body: { success: true, generated_page_id: generatedPage.id },
        });

        console.log(`✅ [QUEUE WORKER] Job ${job.id} completed successfully`);
        results.push({ job_id: job.id, success: true });

      } catch (error: any) {
        console.error(`❌ [QUEUE WORKER] Job ${job.id} failed:`, error);

        // Determine if we should retry
        const shouldRetry = job.attempts + 1 < job.max_attempts;
        const newStatus = shouldRetry ? "queued" : "failed";

        // Update job with error
        await supabase
          .from("content_generation_jobs")
          .update({
            status: newStatus,
            error_message: error.message || String(error),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        // Update location_keyword status
        await supabase
          .from("location_keywords")
          .update({ status: "error", updated_at: new Date().toISOString() })
          .eq("id", job.location_keyword_id);

        // Log error to api_logs
        await supabase.from("api_logs").insert({
          user_id: job.user_id,
          project_id: job.project_id,
          api_type: "openrouter",
          endpoint: "/v1/chat/completions",
          method: "POST",
          status_code: 500,
          request_body: { job_id: job.id },
          error_message: error.message || String(error),
        });

        results.push({ job_id: job.id, success: false, error: error.message });
        // Continue to next job instead of throwing
      }
    } // End of for loop

    // Return summary of all processed jobs
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    console.log(`🏁 [QUEUE WORKER] Batch complete: ${successCount} succeeded, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        succeeded: successCount,
        failed: failCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ [QUEUE WORKER] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
