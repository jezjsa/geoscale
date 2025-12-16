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
  parent_location_id: string | null;
}

interface ParentTownData {
  phrase: string;
  wp_page_url: string | null;
  location: {
    name: string;
  };
}

interface SuburbPageData {
  phrase: string;
  wp_page_url: string | null;
  location: {
    name: string;
  };
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

/**
 * Calculate Local Support Score for suburb pages and return failed checks
 */
function calculateLocalSupportScore(
  content: string,
  keyword: string,
  location: string
): { score: number; failedChecks: { name: string; message: string; currentValue?: number }[] } {
  const failedChecks: { name: string; message: string; currentValue?: number }[] = [];
  const plainText = content.replace(/<[^>]*>/g, ' ');
  const lowerPlainText = plainText.toLowerCase();
  const wordCount = plainText.split(/\s+/).filter(w => w.length > 0).length;
  
  // Extract keyword part (without location)
  const keywordPart = keyword.replace(new RegExp(`\\s*(in|for|near|around)\\s+${location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), '').trim();
  const lowerKeyword = keywordPart.toLowerCase();
  const lowerLocation = location.toLowerCase();

  let totalScore = 0;

  // 1. Content length (max 20 points) - 300-700 words ideal
  if (wordCount >= 300 && wordCount <= 700) {
    totalScore += 20;
  } else if (wordCount < 300) {
    totalScore += 10;
    failedChecks.push({ name: 'Content Length', message: `${wordCount} words (could be slightly longer)`, currentValue: wordCount });
  } else if (wordCount <= 800) {
    totalScore += 10;
    failedChecks.push({ name: 'Content Length', message: `${wordCount} words (slightly long for suburb page)`, currentValue: wordCount });
  } else {
    failedChecks.push({ name: 'Content Length', message: `${wordCount} words (too long - risk of competing with town page)`, currentValue: wordCount });
  }

  // 2. Keyword frequency (max 15 points) - 2-5 ideal
  const keywordRegex = new RegExp(lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const keywordCount = (lowerPlainText.match(keywordRegex) || []).length;
  if (keywordCount >= 2 && keywordCount <= 5) {
    totalScore += 15;
  } else if (keywordCount < 2) {
    totalScore += 5;
    failedChecks.push({ name: 'Keyword Frequency', message: `Keyword appears ${keywordCount} times (could add 1-2 more)`, currentValue: keywordCount });
  } else if (keywordCount <= 6) {
    totalScore += 10;
    failedChecks.push({ name: 'Keyword Frequency', message: `Keyword appears ${keywordCount} times (slightly high)`, currentValue: keywordCount });
  } else {
    failedChecks.push({ name: 'Keyword Frequency', message: `Keyword appears ${keywordCount} times (over-optimised)`, currentValue: keywordCount });
  }

  // 3. Location frequency (max 15 points) - 3-6 ideal
  const locationRegex = new RegExp(lowerLocation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const locationCount = (lowerPlainText.match(locationRegex) || []).length;
  if (locationCount >= 3 && locationCount <= 6) {
    totalScore += 15;
  } else if (locationCount < 3) {
    totalScore += 8;
    failedChecks.push({ name: 'Location Frequency', message: `Location appears ${locationCount} times (could add 1-2 more)`, currentValue: locationCount });
  } else if (locationCount <= 8) {
    totalScore += 8;
    failedChecks.push({ name: 'Location Frequency', message: `Location appears ${locationCount} times (slightly high)`, currentValue: locationCount });
  } else {
    failedChecks.push({ name: 'Location Frequency', message: `Location appears ${locationCount} times (over-optimised)`, currentValue: locationCount });
  }

  // 4. Heading usage (max 15 points) - 0-1 keyword headings ideal
  const headings = content.match(/<h[2-3][^>]*>(.*?)<\/h[2-3]>/gi) || [];
  const headingsWithKeyword = headings.filter(h => h.toLowerCase().includes(lowerKeyword)).length;
  if (headingsWithKeyword <= 1) {
    totalScore += 15;
  } else {
    totalScore += 5;
    failedChecks.push({ name: 'Heading Usage', message: `${headingsWithKeyword} keyword headings (too many - footprint risk)`, currentValue: headingsWithKeyword });
  }

  // 5. Sales pressure detection (max 15 points)
  const salesTerms = ['best', 'leading', 'top', 'award-winning', 'premier', 'number one', '#1', 'guaranteed', 'unbeatable', 'cheapest', 'lowest price'];
  const foundSalesTerms = salesTerms.filter(term => lowerPlainText.includes(term));
  const hasPricing = /\$|£|€|price|pricing|cost|quote|fee/i.test(plainText);
  const hasTestimonial = /<blockquote|class="testimonial"|"testimonial/i.test(content);
  
  let salesPressure = 0;
  if (foundSalesTerms.length > 0) salesPressure += foundSalesTerms.length * 2;
  if (hasPricing) salesPressure += 3;
  if (hasTestimonial) salesPressure += 3;
  
  const salesPoints = Math.max(0, 15 - salesPressure * 2);
  totalScore += salesPoints;
  if (salesPressure > 3) {
    failedChecks.push({ name: 'Sales Pressure', message: 'High sales pressure (reduce for suburb page)' });
  }

  // Add points for title checks (simplified - just add base points)
  totalScore += 20; // Keyword + Location in title

  return { score: totalScore, failedChecks };
}

/**
 * Auto-optimise suburb content based on failed Local Support Score checks
 */
async function optimiseSuburbContent(
  content: string,
  keyword: string,
  location: string,
  failedChecks: { name: string; message: string; currentValue?: number }[],
  openrouterApiKey: string
): Promise<string> {
  if (failedChecks.length === 0) {
    return content; // No optimisation needed
  }

  // Build specific instructions based on failed checks
  const instructions: string[] = [];
  
  for (const check of failedChecks) {
    switch (check.name) {
      case 'Content Length':
        if (check.message.includes('too long')) {
          instructions.push(`REDUCE content length. Current: ~${check.currentValue} words. Target: 300-700 words. Remove redundant sentences, combine paragraphs, and trim verbose sections.`);
        } else if (check.message.includes('slightly longer')) {
          instructions.push(`SLIGHTLY EXPAND content. Current: ~${check.currentValue} words. Add 1-2 sentences of relevant local context. Target: 300-400 words.`);
        }
        break;
        
      case 'Keyword Frequency':
        if (check.message.includes('over-optimised') || check.message.includes('slightly high')) {
          instructions.push(`REDUCE keyword "${keyword}" mentions. Current: ${check.currentValue} times. Target: 2-5 times. Replace some instances with pronouns or related terms.`);
        } else if (check.message.includes('could add')) {
          instructions.push(`ADD 1-2 natural mentions of "${keyword}". Current: ${check.currentValue} times. Target: 2-4 times.`);
        }
        break;
        
      case 'Location Frequency':
        if (check.message.includes('over-optimised') || check.message.includes('slightly high')) {
          instructions.push(`REDUCE location "${location}" mentions. Current: ${check.currentValue} times. Target: 3-6 times. Replace some with "the area", "locally", "nearby".`);
        } else if (check.message.includes('could add')) {
          instructions.push(`ADD 1-2 natural mentions of "${location}". Current: ${check.currentValue} times. Target: 3-5 times.`);
        }
        break;
        
      case 'Heading Usage':
        if (check.message.includes('too many')) {
          instructions.push(`REDUCE keyword in headings. Current: ${check.currentValue} H2/H3 headings contain the keyword. Target: 0-1. Rewrite headings to be more generic.`);
        }
        break;
        
      case 'Sales Pressure':
        instructions.push(`REMOVE aggressive sales language. Replace words like "best", "leading", "top", "award-winning" with softer alternatives. Remove pricing mentions.`);
        break;
    }
  }

  if (instructions.length === 0) {
    return content;
  }

  const prompt = `You are an SEO content optimiser for LOCAL SUBURB SUPPORT PAGES. These pages should be LIGHTER and LESS optimised than main town pages.

CURRENT CONTENT:
${content}

REQUIRED CHANGES (apply ALL):
${instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n')}

RULES:
- Make ONLY the changes listed above
- Preserve the HTML structure (h1, h2, h3, p tags)
- Keep the same general flow and sections
- Do NOT add new sections or testimonials
- Do NOT add pricing or aggressive CTAs
- Maintain a helpful, supportive tone
- Output ONLY the optimised HTML content, no explanations

OUTPUT THE OPTIMISED HTML:`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': Deno.env.get('SUPABASE_URL') || '',
        'X-Title': 'GeoScale Auto-Optimiser',
      },
      body: JSON.stringify({
        model: 'x-ai/grok-4.1-fast',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('Auto-optimise API error:', await response.text());
      return content; // Return original on error
    }

    const result = await response.json();
    const optimisedContent = result.choices?.[0]?.message?.content?.trim();

    if (optimisedContent) {
      console.log(`Auto-optimised suburb content: applied ${instructions.length} fix(es)`);
      return optimisedContent;
    }
  } catch (error) {
    console.error('Auto-optimise error:', error);
  }

  return content; // Return original on error
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
    const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY");

    if (!openrouterApiKey) {
      throw new Error("OPENROUTER_API_KEY is not set");
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
            parent_location_id,
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

        // Fetch service-specific FAQs and service page URL if a service is associated
        let serviceFaqsBlock = "";
        let servicePageUrl = "";
        if (lkData.service_id) {
          // Fetch service details including page URL
          const { data: serviceData, error: serviceError } = await supabase
            .from("project_services")
            .select("service_page_url")
            .eq("id", lkData.service_id)
            .single();

          if (serviceError) {
            console.error("Failed to fetch service:", serviceError);
          } else if (serviceData?.service_page_url) {
            servicePageUrl = serviceData.service_page_url;
          }

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
            .map((s: { name: string; description: string | null }) => 
              s.description ? `- ${s.name}: ${s.description}` : `- ${s.name}`
            )
            .join("\n");
          projectServicesBlock = servicesList;
        }

        // Fetch parent town data if this is a suburb page
        let parentTownData: ParentTownData | null = null;
        if (lkData.parent_location_id) {
          const { data: parentData, error: parentError } = await supabase
            .from("location_keywords")
            .select(`
              phrase,
              wp_page_url,
              location:project_locations!location_keywords_location_id_fkey(name)
            `)
            .eq("id", lkData.parent_location_id)
            .single();

          if (parentError) {
            console.error("Failed to fetch parent town:", parentError);
          } else if (parentData) {
            parentTownData = parentData as unknown as ParentTownData;
          }
        }

        // Fetch suburb pages if this is a main town page (no parent)
        let suburbPages: SuburbPageData[] = [];
        if (!lkData.parent_location_id) {
          const { data: suburbData, error: suburbError } = await supabase
            .from("location_keywords")
            .select(`
              phrase,
              wp_page_url,
              location:project_locations!location_keywords_location_id_fkey(name)
            `)
            .eq("parent_location_id", locationKeywordId)
            .in("status", ["generated", "pushed"]);

          if (suburbError) {
            console.error("Failed to fetch suburb pages:", suburbError);
          } else if (suburbData && suburbData.length > 0) {
            suburbPages = suburbData as unknown as SuburbPageData[];
          }
        }

        // Build the prompt
        const serviceName = lkData.keyword.keyword || projectData.base_keyword || "service";
        const location = lkData.location.name;
        const businessName = projectData.company_name || "Our Business";
        const phoneNumber = projectData.phone_number || "";
        const contactUrl = projectData.contact_url || "";
        const serviceDescription = projectData.service_description || "";

        // Build internal linking blocks
        let internalLinkingBlock = "";
        let internalLinkingInstructions = "";

        // Determine page type and build appropriate linking data
        const isSuburbPage = !!parentTownData;
        const isMainTownWithSuburbs = !isSuburbPage && suburbPages.length > 0;

        if (isSuburbPage && parentTownData) {
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
        } else if (isMainTownWithSuburbs) {
          const suburbList = suburbPages
            .map(s => {
              const suburbLocation = Array.isArray(s.location) 
                ? s.location[0]?.name 
                : s.location?.name;
              return `- ${suburbLocation}: ${s.wp_page_url || "Not yet published"}`;
            })
            .join("\n");

          internalLinkingBlock = `
INTERNAL LINKING DATA (Main Town Page):
${servicePageUrl ? `- Main Service Page URL: ${servicePageUrl}` : ""}
- Suburb Pages We Cover:
${suburbList}`;

          internalLinkingInstructions = `
INTERNAL LINKING INSTRUCTIONS (Main Town Page):
${servicePageUrl ? `- In the CTA section, include a link to the main service page.
  Example: "Learn more about all our <a href="${servicePageUrl}">${serviceName} services</a>."` : ""}
- Add a section wrapped in <div class="geo-areas-covered"> with an H2 heading like "Areas We Also Cover" or "Nearby Areas We Serve".
  - List all suburb pages as a bulleted list with links.
  - Only include suburbs that have a URL (are published).
  - Example format:
    <ul>
      <li><a href="[suburb_url]">${serviceName} in [Suburb Name]</a></li>
    </ul>
  - Close with </div>`;
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

        // Determine content intent based on page type
        const contentIntent = isSuburbPage ? "suburb-support" : (isMainTownWithSuburbs ? "primary-town" : "standard-service");
        
        // Get parent location name for suburb pages
        const parentLocation = isSuburbPage && parentTownData 
          ? (Array.isArray(parentTownData.location) ? parentTownData.location[0]?.name : parentTownData.location?.name)
          : null;

        // Build the prompt based on content intent
        let prompt: string;

        if (contentIntent === "suburb-support") {
          // SUBURB PAGE PROMPT - Shorter, supportive, defers to parent
          prompt = `Create a suburb-level service coverage page that reinforces local relevance while supporting the main town page.

PAGE TYPE: Suburb/Local Coverage Page
This is NOT a primary sales landing page. This is a local relevance amplifier.
This page must support the main town page, not compete with it.

Service: ${serviceName}
Suburb Location: ${location}
Parent Town: ${parentLocation || "Main town"}
Target keyword phrase: ${serviceName} services available in ${location}

Business name: ${businessName}
Phone number: ${phoneNumber}
Contact page URL: ${contactUrl}
${internalLinkingBlock}

${serviceDescription ? `Brief service context: ${serviceDescription}` : ""}
${internalLinkingInstructions}

**SUBURB PAGE CONSTRAINTS (MUST FOLLOW):**
- Limit total content to 500-750 words maximum (hard cap)
- Use FEWER sections than the main town page (maximum 3 H2 sections)
- Avoid full testimonials or case-study style proof - no testimonials by default
- Avoid detailed service breakdowns - summarise at high level only
- Emphasise proximity, availability, and coverage
- Clearly position the main town page as the primary service hub
- The page should feel like a local relevance and coverage confirmation, not a primary sales landing page
- DO NOT list advanced or specialist services (e.g., SaaS development, bespoke software) - refer to main town page for full capabilities

**CONTENT INTENT (CRITICAL):**
This page exists to:
- Confirm service availability in ${location}
- Reinforce proximity to ${parentLocation || "the main town"}
- Support the main town page, NOT compete with it
- Provide local reassurance to users searching from ${location}

This page should NOT:
- Be a full sales landing page
- Repeat detailed service explanations from the town page
- Over-optimise for the primary town keyword
- Position itself as the main service page for the wider area
- Look conversion-complete (no full testimonials, no detailed feature lists)

**CONTENT STRUCTURE (Suburb Page - Minimal, max 3 H2 sections):**
- **Short Introduction** (2-3 paragraphs): Confirm service coverage in ${location}, mention proximity to ${parentLocation || "main town"}
- **Local Coverage Section**: Brief explanation of how you serve ${location} as part of your ${parentLocation || "main town"} coverage. Use heading like "Supporting ${location} as part of our ${parentLocation || "main town"} service area"
- **Optional: Nearby Areas** (only if relevant): A brief mention like "Close to ${parentLocation || "main town"} town centre" or "Serving surrounding areas" - keeps it factual and light
- **Soft CTA**: Direct users to contact or to the main ${parentLocation || "town"} page for full details

**TITLE/H1 REQUIREMENTS:**
- The title should imply service AVAILABILITY or COVERAGE, not primary ownership
- Use: "${serviceName} services available in ${location}" or "${serviceName} support for businesses in ${location}"
- DO NOT use: "Professional ${serviceName} in ${location}" or ownership-style headlines

**TESTIMONIAL HANDLING:**
${testimonialBlock ? `- You may briefly reference this testimonial, but DO NOT include it in full
- Instead, paraphrase or use a short excerpt
- Or reference generally: "Clients across ${parentLocation || "the area"} and surrounding areas trust us for quality ${serviceName}"
- Original testimonial for reference: ${testimonialBlock}` : "- No testimonials provided - do not invent any"}

**HEADINGS - AVOID GENERIC SALES HEADINGS:**
- DO NOT use: "Why Choose [Business]" or "Why Choose Local [Service]"
- DO use: "Local ${serviceName} support for ${location} businesses" or "Supporting ${location} as part of our ${parentLocation || "main town"} service area"
- Headings should emphasise coverage, proximity, or support - NOT competitive positioning

**SERVICE SCOPE:**
- Summarise services at a HIGH LEVEL only
- DO NOT list advanced or specialist offerings in detail
- Refer readers to the main town or service page for full capability breakdowns
- Keep service mentions brief and general

**LANGUAGE REQUIREMENTS:**
- Use supportive language: "serving", "covering", "supporting businesses in", "available in"
- Verbally defer to the parent town: "Our main ${serviceName} service is based in ${parentLocation || "the main town"}, with full coverage across ${location}"
- Reference the main town page naturally where appropriate
- DO NOT repeat the suburb name excessively - use natural variation and pronouns once location relevance is established
- Avoid footprint patterns - vary sentence structure and phrasing

**CRITICAL RULES - DO NOT VIOLATE:**
- DO NOT invent case studies, statistics, or specific client results
- DO NOT include full testimonials - only brief references or paraphrases
- DO NOT claim local office presence unless verified
- DO NOT repeat town-level statistics or detailed service breakdowns
- DO NOT use more than 3 H2 sections
- Keep claims general and non-specific

**FORMATTING:**
- Use semantic HTML: h2, h3, p, ul, li, strong, em
- Simpler, shorter structure than main town pages
- No H1 tags (WordPress uses page title as H1)
- Maximum 3 H2 sections total

Format your response as JSON:
{
  "title": "${serviceName} services available in ${location}",
  "meta_title": "${serviceName} in ${location} | ${businessName}",
  "meta_description": "Meta description here (150 characters max)",
  "content": "HTML content here"
}`;
        } else {
          // PRIMARY TOWN or STANDARD SERVICE PROMPT - Full comprehensive page
          prompt = `Create a comprehensive, SEO-optimized landing page for a service business that will rank highly in Google search results.

${contentIntent === "primary-town" ? `PAGE TYPE: Primary Town Page (Main Location Hub)
This is the main service page for ${location}. It should be comprehensive and conversion-focused.
` : ""}
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
        }

        // Call OpenRouter API with Grok 4.1 Fast model
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
          console.error("Failed to parse OpenRouter response:", generatedText);
          throw new Error(`Failed to parse generated content: ${parseError.message}`);
        }

        // Generate WordPress-style slug from title (excluding business name)
        const slug = generateSlug(generatedContent.title, businessName);

        // Auto-optimise suburb pages based on Local Support Score
        let finalContent = generatedContent.content;
        if (isSuburbPage && lkData.phrase && lkData.location?.name) {
          console.log(`Suburb page detected - checking Local Support Score...`);
          const { score, failedChecks } = calculateLocalSupportScore(
            generatedContent.content,
            lkData.phrase,
            lkData.location.name
          );
          console.log(`Local Support Score: ${score}/100, Failed checks: ${failedChecks.length}`);
          
          if (failedChecks.length > 0) {
            console.log(`Auto-optimising suburb content for: ${failedChecks.map(c => c.name).join(', ')}`);
            finalContent = await optimiseSuburbContent(
              generatedContent.content,
              lkData.phrase,
              lkData.location.name,
              failedChecks,
              openrouterApiKey
            );
          }
        }

        // Insert or update into generated_pages table
        const { data: generatedPage, error: insertError } = await supabase
          .from("generated_pages")
          .upsert({
            project_id: lkData.project_id,
            location_keyword_id: locationKeywordId,
            title: generatedContent.title,
            slug: slug,
            content: finalContent,
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
          api_type: "openrouter",
          endpoint: "/v1/chat/completions",
          method: "POST",
          status_code: 200,
          request_body: { model: "x-ai/grok-4.1-fast", prompt_length: prompt.length },
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
          api_type: "openrouter",
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

