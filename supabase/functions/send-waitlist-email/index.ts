import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendWaitlistEmailRequest {
  email: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const devsmtpApiKey = Deno.env.get("DEVSMTP_API_KEY");

    if (!devsmtpApiKey) {
      throw new Error("DEVSMTP_API_KEY is not set");
    }

    // Parse request body
    const { email }: SendWaitlistEmailRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    // Build the welcome email HTML
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                🎉 You're on the list!
              </h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                Thanks for joining the <strong>GeoScale</strong> waitlist!
              </p>
              
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                We're building something special for SEO agencies who want to generate, manage, and track local SEO landing pages at scale across multiple WordPress websites.
              </p>
              
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                Here's what you'll get with GeoScale:
              </p>
              
              <ul style="margin: 0 0 20px; padding-left: 20px; color: #374151; font-size: 16px; line-height: 1.8;">
                <li><strong>AI-powered content generation</strong> for location pages</li>
                <li><strong>One-click WordPress publishing</strong> across all your client sites</li>
                <li><strong>Rank tracking</strong> for organic and Google Map Pack visibility</li>
                <li><strong>Centralised dashboard</strong> to manage all clients in one place</li>
              </ul>
              
              <p style="margin: 0 0 30px; color: #374151; font-size: 16px; line-height: 1.6;">
                We'll be in touch soon with early access details. In the meantime, keep an eye on your inbox!
              </p>
              
              <p style="margin: 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Cheers,<br>
                <strong>The GeoScale Team</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                <a href="https://geoscale.app" style="color: #10b981; text-decoration: none;">geoscale.app</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const textContent = `
You're on the list!

Thanks for joining the GeoScale waitlist!

We're building something special for SEO agencies who want to generate, manage, and track local SEO landing pages at scale across multiple WordPress websites.

Here's what you'll get with GeoScale:
- AI-powered content generation for location pages
- One-click WordPress publishing across all your client sites
- Rank tracking for organic and Google Map Pack visibility
- Centralised dashboard to manage all clients in one place

We'll be in touch soon with early access details. In the meantime, keep an eye on your inbox!

Cheers,
The GeoScale Team

https://geoscale.app
    `.trim();

    // Send email via DevSMTP API
    const response = await fetch("https://devsmtp.com/api/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${devsmtpApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: email,
        from: "hello@geoscale.app",
        subject: "Welcome to the GeoScale Waitlist! 🚀",
        html: htmlContent,
        text: textContent,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("DevSMTP error:", result);
      throw new Error(result.error || "Failed to send email");
    }

    console.log(`Waitlist welcome email sent to ${email}`, result);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messageId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Send waitlist email error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
