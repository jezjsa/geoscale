# GeoScale - Full Project Specification

**Tech stack:** React, Vite, TypeScript, Supabase, Stripe, WordPress plugin

## 1. Overview

GeoScale is a SaaS platform that generates location based landing pages using AI and pushes them to a connected WordPress website via a custom plugin. The platform will:

- allow users to research keywords
- find nearby towns automatically
- create dozens or hundreds of SEO optimised geo landing pages
- generate content using OpenAI gpt 5.1
- store everything in Supabase
- handle user authentication with Supabase Auth
- use Stripe for subscription billing
- support Individual, Agency, and Agency Plus plans
- allow Agencies to manage Individual sub accounts
- connect to a WordPress plugin for page creation and updates

The platform must also avoid page refreshes when switching browser tabs in production.

**Cursor must follow this spec when generating code.**

## 2. Core Features

### 2.1 User Authentication

- Supabase built in authentication
- Email and password sign up
- Magic link sign in optional
- Password reset
- Must integrate with Stripe user metadata to track plan level

### 2.2 Subscription Tiers

#### Individual

- One website
- Limited number of keyword variations
- Limited number of towns

#### Agency

- Can create and manage multiple Individual accounts
- Each client website has its own project
- Higher limits for towns and keywords

#### Agency Plus

- Unlimited locations
- Unlimited keyword variations
- Priority support
- Additional features: bulk page updates, automatic regenerations

Stripe must manage these plans. Supabase tables must track plan and usage limits.

## 3. Project Structure

A user can create Projects. Each project connects to one WordPress site.

**Project components:**

- Base service keyword (eg web design)
- Base location (town or city)
- Discovered nearby towns using Google Places API
- Selected keyword variations from DataForSEO
- Location plus keyword combinations stored for page generation
- Generated pages ready to push
- WordPress connection details (API key)

## 4. Third Party APIs

### 4.1 Google API (for nearby towns)

**Use:**

- Places Autocomplete
- Geocoding API
- Places Nearby Search

**Purpose:**

- User enters their main town
- Google returns lat and lng
- Google returns nearby towns within set radius
- The app filters results to only show towns, cities, postal towns, or localities

### 4.2 DataForSEO API

**Uses:**

- Related Keywords
- Search Volume
- Keyword difficulty

**Flow:**

- User enters base service keyword
- Fetch top related keywords for GB
- User selects required keywords
- App combines keywords with locations
- Option to fetch volume for combined phrases only on demand to save costs

### 4.3 OpenAI gpt 5.1

**Used to generate:**

- Landing page content
- Meta titles
- Meta descriptions
- Optional call to action variations

**AI prompts will be structured prompts that use:**

- business name
- phone number
- contact URL
- testimonials
- service descriptions
- selected location
- selected keyword variation

### 4.4 Stripe

**Used for:**

- Monthly billing
- Subscription management
- Webhooks for handling plan upgrades or downgrades
- Linking Agency accounts to Individual user accounts
- Tracking plan limits

## 5. WordPress Plugin Integration

GeoScale will push content to WordPress. A custom plugin will be required on each connected WordPress site.

### Important

**Cursor must ask the user:**

> "Jeremy, where is the working WordPress plugin on your local Mac so I can read it and follow its structure for this project?"

Because you have already built a plugin for a similar SaaS, Cursor needs to analyse that code so it can mirror the architecture.

### Plugin requirements:

- Provide an API endpoint: `/wp-json/geoscale/v1/create-page`
- Validate API key
- Accept fields from the web app:
  - page title
  - slug
  - content (HTML or Gutenberg blocks)
  - template name
  - meta title
  - meta description
- Create or update pages programmatically
- Return page ID and URL
- Handle failures gracefully

## 6. Supabase Database Schema (initial draft)

### Tables needed:

#### users

- internal user id
- supabase auth user id
- name
- plan
- agency_id (nullable)

#### agencies

- id
- owner_user_id
- plan (Agency or Agency Plus)

#### projects

- id
- user_id
- agency_id (nullable)
- wp_url
- wp_api_key
- project_name
- base_keyword
- base_location
- latitude
- longitude

#### project_locations

- id
- project_id
- place_id
- name
- slug
- lat
- lng
- region
- country

#### keyword_variations

- id
- project_id
- keyword
- search_volume
- difficulty

#### location_keywords

- id
- project_id
- location_id
- keyword_id
- phrase
- status (pending, generated, pushed)
- wp_page_id
- wp_page_url

#### generated_pages

- id
- project_id
- location_keyword_id
- title
- content
- meta_title
- meta_description
- updated_at

#### usage_tracking

**Track number of:**

- projects
- locations
- keyword variations
- generated pages
- pushes to WordPress

## 7. UX Flow

### Step 1 - User creates project

- Enter project name
- Enter WordPress URL and API key
- Enter base keyword
- Enter base town

### Step 2 - Discover locations

- Call Google API
- Show list of nearby towns
- User selects which ones to include
- Save to database

### Step 3 - Keyword research

- Call DataForSEO for related keywords
- Show results with search volumes
- User selects required phrases
- Save to database

### Step 4 - Generate matrix

System combines selected towns and selected keyword variations.

### Step 5 - Content generation

- User selects rows and clicks Generate
- OpenAI gpt 5.1 creates content
- Save into generated_pages table

### Step 6 - Push to WordPress

- User presses "Send to WordPress"
- Plugin receives content and creates page
- Store resulting page ID and URL

## 8. Frontend Requirements (React, Vite, TS)

**Cursor must generate:**

- A fully client side SPA
- No full reloads when switching browser tabs in production
- Use React Query or Supabase realtime where suitable
- Use TanStack Router or React Router
- Use ShadCN UI for consistent layout
- Use Tailwind
- Global error handling
- Smooth loading states
- Light and dark mode support
- Strong TypeScript safety across the app
- Environment variable handling for production builds

**It must ensure that:**

The app never refreshes or loses state when switching browser tabs in production environments.

**This must be solved by:**

- ensuring Vite is configured correctly
- avoiding any hot reload logic in production
- avoiding window focus events that trigger refresh
- using local caching where useful
- using Supabase persisted sessions

## 9. Background Jobs (optional but recommended)

**Later we may add:**

- Periodic ranking checks via DataForSEO
- Automatic content refreshes if rankings drop
- Bulk page regenerations
- Bulk updates to WordPress

Cursor must leave space for these features in the code structure.

## 10. Items Cursor must ask Jeremy before starting

**Cursor must ask:**

1. "Where on your local machine is the working WordPress plugin from your previous SaaS so I can read it and base the new plugin on it?"
2. "Are there any existing React components from your other projects that should be reused?"
3. "What domain will be used for GeoScale so I can set up environment specific config files?"
4. "Do you want page generation to use HTML or Gutenberg blocks by default?"
5. "Do you want ShadCN to use the app directory structure or the src directory structure?"

## 11. Additional Recommendations

- Add a logs table for debugging API calls (Google, DataForSEO, WordPress)
- Add a settings screen for API key management
- Add automatic retry logic for failed WordPress pushes
- Add analytics to track page creation totals per project
- Add discount codes system for plan subscriptions (to be implemented later)
- Add email functionality for sending login credentials to new Individual users created by Agencies (to be implemented later)

**Create a simple dashboard showing:**

- number of locations
- number of keyword variations
- number of pages generated
- number of pages pushed to WordPress
