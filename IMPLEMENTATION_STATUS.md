# GeoScale - Location & Keyword Combinations Implementation

## ✅ Completed Features

### 1. Database Schema
All necessary tables are already in place:
- `project_locations` - stores locations from Google Places API
- `keyword_variations` - stores keywords from DataForSEO API  
- `location_keywords` - junction table for location × keyword combinations
- Proper indexes and RLS policies configured

### 2. UI Components Created

#### AddCombinationDialog Component
**Location:** `src/components/projects/AddCombinationDialog.tsx`

Features:
- Clean two-field form for base location and keyword
- Green primary button (#006239) matching brand colors
- Processing state with loading spinner
- Toast notifications for success/error
- Explains the two-stage process to users

#### Updated ProjectDetailPage
**Location:** `src/pages/ProjectDetailPage.tsx`

Features:
- "Add your first combination" empty state with primary button
- Displays list of created combinations with:
  - Combined phrase (e.g., "web design in Doncaster")
  - Location and keyword breakdown
  - Search volume (when available)
  - Status badge (pending/generated/pushed)
- "Add More" button when combinations exist
- Responsive grid layout

### 3. API Integration Layer

#### Google Places Integration
**Location:** `src/api/google-places.ts`

Current status: **Mock data (working)**
- Currently returns 4 mock towns around the base location
- Stores locations in `project_locations` table with:
  - place_id
  - name and slug
  - lat/lng coordinates
  - region and country
- Updates project with base location coordinates
- Handles duplicates with upsert

**TODO for production:**
- Implement actual Google Places API calls (detailed instructions in file)
- Add environment variable: `VITE_GOOGLE_PLACES_API_KEY`
- Geocode base location first
- Search nearby localities within radius
- Filter by proper place types

#### DataForSEO Integration
**Location:** `src/api/dataforseo.ts`

Current status: **Mock data (working)**
- Currently returns 6 keyword variations
- Stores keywords in `keyword_variations` table with:
  - keyword text
  - search_volume
  - difficulty score
- Handles duplicates with upsert

**TODO for production:**
- Implement actual DataForSEO API calls (detailed instructions in file)
- Add environment variables:
  - `VITE_DATAFORSEO_LOGIN`
  - `VITE_DATAFORSEO_PASSWORD`
- Use Keywords For Keywords API endpoint
- Implement proper HTTP Basic Auth
- Consider caching to reduce API costs

#### Combination Generator
**Location:** `src/api/combination-generator.ts`

Status: **Fully functional**
- Fetches all locations for project
- Fetches all keyword variations for project
- Generates all possible combinations
- Creates intelligent phrases:
  - "web design in Doncaster"
  - "web design near Rotherham" (for "near me" keywords)
- Stores in `location_keywords` table
- Handles duplicates gracefully
- Returns count statistics

#### Main Combinations API
**Location:** `src/api/combinations.ts`

Status: **Fully functional**
- Orchestrates the three-stage process:
  1. Update project with base location and keyword
  2. Find nearby towns via Google Places
  3. Get keyword variations via DataForSEO
  4. Generate all combinations
- Returns counts for each stage
- `getProjectCombinations()` - fetches combinations with full join data
- `deleteLocationKeyword()` - deletes a single combination

### 4. AI Content Generation System 🎉 NEW

#### Edge Function for Content Generation
**Location:** `supabase/functions/generate-content/index.ts`

Status: **Fully functional - Production Ready**
- Uses OpenAI o1 model (GPT-5 Reasoning)
- Processes batch requests (multiple combinations at once)
- Fetches all required data:
  - Project details (company name, phone, contact URL, service description)
  - Location and keyword information
  - Random testimonial from project testimonials
- Builds dynamic prompts from `/content_prompt.md` template
- Generates complete landing pages with:
  - Title, meta title (60 chars), meta description (155 chars)
  - Full HTML content (semantic, ready for WordPress)
  - H1, intro, why choose us, services, testimonials, CTA, FAQ sections
- Stores in `generated_pages` table
- Updates status in real-time (pending → generating → generated)
- Comprehensive error handling and logging
- All API calls logged to `api_logs` table

**Required:** `OPENAI_API_KEY` as Supabase secret

#### Content Generator API Client
**Location:** `src/api/content-generator.ts`

Status: **Fully functional**
- `generateContent()` - Triggers batch content generation
- `getGeneratedPage()` - Fetches generated page content
- `deleteGeneratedPage()` - Deletes content and resets status
- Full TypeScript types
- Error handling

#### Enhanced Combinations Table UI
**Location:** `src/components/projects/CombinationsTable.tsx`

Status: **Fully functional with real-time updates**

New features:
- **Generate Content button** - Primary green button for AI generation
- **Selection mode** - Checkboxes to select multiple combinations
- **Real-time status updates** - Supabase PostgreSQL subscriptions
- **Enhanced status badges:**
  - Pending (gray) - Ready to generate
  - Generating (outline + spinner) - AI is working
  - Generated (green) - Content ready
  - Error (red) - Generation failed
  - Pushed (green) - Live on WordPress
- **Batch processing** - Generate multiple pages at once
- **Loading states** - Spinners and disabled buttons
- **Toast notifications** - Success/failure feedback
- **Only pending items selectable** - Smart UX for generation

**Real-time updates:**
- Subscribes to `location_keywords` table changes
- Automatically refetches when status changes
- No page refresh needed - seamless experience

## 🎨 UI/UX Features

### Empty State
When a project has no combinations:
- Friendly card with clear call-to-action
- Explains what will happen
- Green primary button with Plus icon
- Centered and well-spaced

### Combinations List
When combinations exist:
- Summary count at top
- "Add More" button to create additional combinations
- Each combination shows:
  - Full phrase as headline
  - Location, keyword, and volume as metadata
  - Status badge with color coding
- Hover states for better UX
- Responsive layout

## 📋 Flow Diagram

### Full End-to-End Flow (Updated with Content Generation)

```
User enters base location + keyword
           ↓
  Update project record
           ↓
[Stage 1: Google Places API]
  - Geocode location → lat/lng
  - Find nearby towns (50km radius)
  - Store in project_locations
           ↓
[Stage 2: DataForSEO API]
  - Get related keywords
  - Include search volume & difficulty
  - Store in keyword_variations
           ↓
[Stage 3: Generate Combinations]
  - Create location × keyword matrix
  - Generate intelligent phrases
  - Store in location_keywords
  - Status: pending
           ↓
    Display combinations to user
           ↓
User selects combinations & clicks "Generate Content"
           ↓
[Stage 4: AI Content Generation] 🎉 NEW
  - Status → generating
  - Supabase Edge Function called
  - Fetch project data (company, phone, contact URL)
  - Fetch location & keyword data
  - Select random testimonial
  - Build prompt from template
  - Call OpenAI o1 model
  - Parse JSON response
  - Store in generated_pages
  - Log to api_logs
  - Status → generated (or error)
  - Real-time UI update
           ↓
[Stage 5: WordPress Push] (Next priority)
  - Send to WordPress plugin API
  - Create/update page
  - Store page ID and URL
  - Status → pushed
```

## 🚀 Next Steps

### Priority 1: API Integration
1. Set up Google Cloud Console project
2. Enable Places API, Geocoding API, and Places (New) API
3. Create API key and add to environment variables
4. Implement real API calls in `google-places.ts`
5. Test with real locations

6. Sign up for DataForSEO account
7. Get API credentials
8. Add to environment variables
9. Implement real API calls in `dataforseo.ts`
10. Test with real keywords

### Priority 2: Enhanced Features
1. Add ability to select which locations to keep (checkboxes)
2. Add ability to select which keywords to keep (checkboxes)
3. Show preview of how many combinations will be created
4. Add search/filter for combinations list
5. Add pagination if combinations > 50
6. Add bulk actions (delete selected, generate content, push to WP)

### Priority 3: Cost Optimization
- Cache API results to avoid duplicate calls
- Add "Refresh" buttons for manual re-fetching
- Show API usage stats on dashboard
- Implement rate limiting
- Add ability to edit locations/keywords before generating combinations

### ✅ Priority 4: Content Generation (COMPLETED - Nov 20, 2025)
**Status: Fully Implemented**

Features completed:
- ✅ Supabase Edge Function using OpenAI o1 model
- ✅ "Generate Content" button in combinations table
- ✅ Selection mode with checkboxes for batch generation
- ✅ Real-time status updates via Supabase subscriptions
- ✅ Enhanced status badges (pending, generating, generated, error, pushed)
- ✅ Content stored in `generated_pages` table
- ✅ API logging to `api_logs` table
- ✅ Dynamic prompt building with project data
- ✅ Random testimonial selection per page
- ✅ Error handling for individual failures
- ✅ Comprehensive documentation

**Implementation files:**
- `/supabase/functions/generate-content/index.ts` - Edge Function
- `/src/api/content-generator.ts` - Frontend API client
- `/src/components/projects/CombinationsTable.tsx` - Updated UI
- `/CONTENT_GENERATION_GUIDE.md` - Complete documentation
- `/IMPLEMENTATION_SUMMARY.md` - Implementation details

**See:** `CONTENT_GENERATION_GUIDE.md` for full details

### Priority 5: WordPress Integration
- Build/connect WordPress plugin
- Add "Push to WordPress" functionality
- Handle page creation/updates
- Store page IDs and URLs
- Mark combination status as "pushed"

## 🧪 Testing the Current Implementation

To test with mock data:

1. Go to any project detail page
2. Click "Add Combination" button
3. Enter:
   - Base Location: "Doncaster" (or any town name)
   - Base Keyword: "web design" (or any service)
4. Click "Generate Combinations"
5. Watch the processing spinner
6. See toast notification with results
7. View the generated combinations list

You should see:
- 4 locations (Doncaster, Rotherham, Barnsley, Wakefield)
- 6 keyword variations
- 24 combinations (4 × 6)

## 📊 Database Queries for Debugging

Check what's in the database:

```sql
-- View all locations for a project
SELECT * FROM project_locations WHERE project_id = 'your-project-id';

-- View all keywords for a project
SELECT * FROM keyword_variations WHERE project_id = 'your-project-id';

-- View all combinations with joins
SELECT 
  lk.phrase,
  lk.status,
  pl.name as location_name,
  kv.keyword,
  kv.search_volume
FROM location_keywords lk
JOIN project_locations pl ON lk.location_id = pl.id
JOIN keyword_variations kv ON lk.keyword_id = kv.id
WHERE lk.project_id = 'your-project-id'
ORDER BY lk.created_at DESC;
```

## 🎯 Integration Checklist

- [x] Database schema
- [x] UI components
- [x] Empty state design
- [x] Combinations list view
- [x] Dialog for adding combinations
- [x] Mock API integrations (testing)
- [x] **Content generation system (OpenAI o1)** 🎉
- [x] **Real-time status updates**
- [x] **Batch content generation**
- [x] **Enhanced status badges**
- [x] **Selection mode UI**
- [x] **API logging system**
- [ ] Real Google Places API
- [ ] Real DataForSEO API
- [ ] Location selection UI
- [ ] Keyword selection UI
- [ ] Content preview/edit UI
- [ ] WordPress plugin connection
- [ ] WordPress push functionality
- [ ] Additional bulk operations
- [ ] Usage tracking per plan
- [ ] Rate limiting

