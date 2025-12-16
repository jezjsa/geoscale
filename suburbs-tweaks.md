# Suburb Page Tweaks - Additional Refinements

This is a good step forward. Structurally and hierarchically it is already far better than a generic geo swap page. That said, from a Google perspective it is still too close to a primary landing page.

---

## 1. What is Working Well

You have already fixed some of the biggest mistakes most tools make.

### Clear Hierarchy Signals

This line is excellent and should stay:

> *"Our main web design service is based in Doncaster, with full coverage across Finningley"*

This explicitly tells Google:
- Doncaster is the primary location
- Finningley is service coverage
- This page is subordinate

**That is exactly what you want.**

### Supportive Internal Linking

Linking back to:
- Web design in Doncaster
- Web design services (non-geo)

This creates a clean internal triangle:
- **Service hub** → **Town hub** → **Suburb support page**

That is solid.

### Reduced Sales Aggression

Compared to a full town page:
- CTAs are softer
- Language is calmer
- No hard selling claims

This is the correct direction.

---

## 2. What is Still Holding it Back

Right now, if Google compared this page to the Doncaster page, it would still see:
- Similar section count
- Similar heading types
- Similar testimonial usage
- Similar service explanation depth

So even though the intent wording is better, **the document shape still looks like a money page**.

For Map Pack reinforcement, suburb pages should feel more like:
- Location confirmation documents
- Coverage reassurance
- Relevance anchors

**Not alternate landing pages.**

---

## 3. Specific Improvements

### A. The H1 is Still Too Strong

**Current:**
> "Web design Services in Finningley"

This is fine, but you can soften it slightly without hurting rankings.

**Better options:**
- "Web design support for businesses in Finningley"
- "Web design services available in Finningley"

This reinforces **availability** rather than **ownership** of the keyword.

**Prompt rule:**
> For suburb pages, the H1 should imply service availability or coverage, not primary ownership of the keyword.

### B. The Testimonial Section Should Be Handled Differently

This is the biggest structural issue.

**Suburb pages should not look conversion-complete.**

Right now you have:
- Full testimonial
- Named client
- Strong outcome language

That is town-level proof.

**Better options:**
- Short testimonial excerpt
- Or a reference like: *"Clients across Doncaster and surrounding areas trust us for..."*

**Prompt rule:**
> On suburb pages, testimonials should be shortened, paraphrased, or referenced indirectly. Do not include full case-style testimonials unless they are explicitly location-specific to the suburb.

This reduces duplication risk and avoids competing with the town page.

### C. The "Why Choose" Section is Still Too Generic

This section:
> "Why Choose Local Web Design Support"

Is structurally identical to what you would expect on a town page.

Instead, suburb pages should focus on:
- Proximity
- Response time
- Coverage logistics
- Relationship to the town hub

**Better heading examples:**
- "Local web design support for Finningley businesses"
- "Supporting Finningley as part of our Doncaster service area"

**Prompt rule:**
> For suburb pages, avoid generic sales headings. Headings should emphasise coverage, proximity, or support rather than competitive positioning.

### D. Service Scope is Still Too Broad

This sentence pushes it too far into primary intent:
> "bespoke business software, SaaS development, custom web apps, or precise custom coding"

For suburb pages, you do not need to list advanced services. That belongs on:
- The service page
- The town page

**Better:**
- Reference the service category broadly
- Link out for details

**Prompt rule:**
> On suburb pages, summarise services at a high level. Do not list advanced or specialist offerings in detail. Refer readers to the main town or service page for full capability breakdowns.

---

## 4. What to Change in the Prompt

You do not need to rewrite everything. You need **constraints**.

### Add a Suburb-Only Constraint Block

Inject this only when `isSuburbPage = true`.

**Example:**

> This page is a suburb-level service coverage page.
>
> It must support the main town page, not compete with it.
>
> **Apply the following constraints:**
> - Limit total content length to 600-900 words
> - Use fewer sections than the main town page
> - Avoid full testimonials or case-study style proof
> - Avoid detailed service breakdowns
> - Emphasise proximity, availability, and coverage
> - Clearly position the main town page as the primary service hub
>
> The page should feel like a local relevance and coverage confirmation, not a primary sales landing page.

---

## 5. Overall Verdict

This is **80% of the way there**, which puts GeoScale ahead of most local SEO tools already.

To make suburb pages genuinely help Map Pack rankings:

1. **Soften ownership language**
2. **Reduce structural parity with town pages**
3. **Treat suburb pages as support documents, not alternates**