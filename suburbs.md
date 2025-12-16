# What Google Actually Wants from Suburb Pages

For Map Pack and local organic, suburb pages should do one main job:

> **Reinforce proximity relevance without competing with the main town page for primary intent.**

That means suburb pages should feel like:
- Local support pages
- Service availability confirmations
- Location reinforcement documents

**Not full sales pages.**

Think:
- **Town page** = primary commercial landing page
- **Suburb page** = local relevance amplifier

---

## Key Content Differences Suburb Pages Should Have

### 1. Different Primary Intent

| Town Page Intent | Suburb Page Intent |
|------------------|-------------------|
| "Web design in Doncaster" | "Web design services available in Finningley" |
| Full service explanation | Proof of coverage |
| Conversion focused | Local reassurance |
| Broad coverage | Directional support to town page |

This intent shift should be explicit in the copy.

### 2. Reduced Scope, Not Reduced Quality

Suburb pages should be:
- Shorter
- Narrower
- More location-specific
- Less feature-heavy

**Recommended:**
- 600 to 900 words max
- Fewer H2 sections
- No long feature lists
- No aggressive CTAs

### 3. Local Signals That Are Not Reused on the Town Page

Each suburb page should include:
- Mentions of nearby landmarks, estates, or roads
- References to proximity to the main town
- Language like "serving", "covering", "supporting businesses in"

**Avoid:**
- Claims of physical offices unless true
- Repeating town-level statistics
- Reusing testimonials verbatim if possible

### 4. Clear Hierarchy Language

**This is critical.**

Suburb pages should verbally defer to the town page.

**Examples:**
- *"Our main web design service is based in Doncaster, with full coverage across Finningley"*
- *"For a full overview of our web design services, see our Doncaster page"*

This reinforces:
- Topical hierarchy
- Canonical intent
- Map Pack relevance

---

## What I Would Change in the Prompt Architecture

The core prompt being identical is the issue.

Instead of only swapping the `internalLinkingBlock`, you should have **three distinct content modes**.

### 1. Introduce a `contentIntent` Flag

Add something like:
```
contentIntent = "primary-town"
contentIntent = "suburb-support"
contentIntent = "standard-service"
```

This should affect tone, scope, and structure, not just links.

### 2. Suburb-Specific Prompt Instructions (Example)

Here is a prompt block you can inject only for suburb pages, before the main content rules.

#### Suburb Content Intent Block (Recommended)

> This page is a suburb-level service coverage page, not a primary sales landing page.
>
> The goal is to reinforce local relevance and service availability for the suburb, while supporting the main town service page.
>
> **Content should:**
> - Be shorter and more focused than the main town page
> - Emphasise proximity to the main town rather than competing with it
> - Avoid repeating full service explanations already covered on the town page
> - Use supportive language such as "serving", "covering", and "supporting businesses in"
> - Clearly reference the main town page as the primary service hub
>
> **Do not** position this page as the main web design page for the wider area.
> **Do not** over-optimise for the primary town keyword.

### 3. Structural Differences for Suburb Pages

Force these differences in the prompt:

**Headings:**
- ✅ H1: "Web Design Services in Finningley"
- ❌ Avoid: "Professional Web Design in Finningley" style sales headlines

**Required sections:**
- Short intro (local coverage)
- "Supporting businesses in Finningley"
- "Our web design services across Doncaster"
- Optional small FAQ section
- Soft CTA linking to town page

**Disallowed sections:**
- Long feature breakdowns
- Pricing sections
- Aggressive CTAs
- Claims of local office presence unless verified

### 4. Internal Linking Should Feel Natural, Not Mechanical

Instead of:
> "Link back to the main town page"

Instruct:
> "Naturally reference the main town service page where a full overview of services is mentioned, using contextual anchor text."

This helps avoid footprints.

---

## Why This Helps Map Pack Specifically

Google Map Pack ranking looks at:
- **Relevance**
- **Distance**
- **Prominence**

Your suburb pages help with:
- Distance signals
- Coverage confirmation
- Local relevance reinforcement

**But only if they are clearly supporting documents, not competing landing pages.**

---

## Summary

Right now, your setup is very close. You just need to:

1. **Reduce scope**
2. **Shift intent**
3. **Make hierarchy obvious in language**