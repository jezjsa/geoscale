# GeoScale WordPress Integration Guide

This guide explains the complete WordPress integration that allows GeoScale to publish location-based landing pages directly to WordPress sites.

## 🎯 Overview

The WordPress integration enables you to:
- ✅ Publish generated pages directly to WordPress
- ✅ Choose page templates for your pages
- ✅ Control whether pages are published as drafts or live
- ✅ Update existing pages
- ✅ Secure API key authentication
- ✅ Support for Yoast SEO and Rank Math

## 📦 Components Created

### 1. WordPress Plugin (`geoscale-plugin/`)

**File:** `geoscale-connector.php`

The WordPress plugin provides REST API endpoints for:
- `/wp-json/geoscale/v1/test` - Test connection
- `/wp-json/geoscale/v1/templates` - Get available page templates
- `/wp-json/geoscale/v1/sitemap` - Get site sitemap with SEO data
- `/wp-json/geoscale/v1/publish` - Publish new page
- `/wp-json/geoscale/v1/update` - Update existing page

**Features:**
- Automatic page template detection
- SEO meta support (Yoast & Rank Math)
- Featured image handling
- LiteSpeed & Cloudflare cache purging
- Comprehensive logging

### 2. Database Migration

**File:** `supabase/migrations/add_wordpress_settings_to_projects.sql`

Adds to `projects` table:
- `wp_page_template` - Selected WordPress page template
- `wp_publish_status` - Draft or publish setting

### 3. Supabase Edge Functions

#### `fetch-wordpress-templates`
Retrieves available page templates from WordPress site.

#### `publish-to-wordpress`
Publishes generated content to WordPress as pages.

**Parameters:**
- `combinationId` - Location keyword combination ID
- `title`, `content`, `metaTitle`, `metaDescription`
- `wordpressUrl`, `wordpressApiKey`
- `pageTemplate` - Optional template selection
- `publishStatus` - 'draft' or 'publish'
- `location`, `keyword` - For metadata

#### `fetch-wordpress-sitemap`
Fetches sitemap from WordPress for future rank tracking integration.

### 4. API Functions (`src/api/wordpress.ts`)

TypeScript functions for:
- `fetchWordPressTemplates()` - Get templates
- `fetchWordPressSitemap()` - Get sitemap
- `publishToWordPress()` - Publish page
- `testWordPressConnection()` - Test connection

### 5. Content Generator API (`src/api/content-generator.ts`)

Added `publishGeneratedPageToWordPress()` function that:
1. Gets generated page content
2. Gets project WordPress settings  
3. Publishes to WordPress via edge function
4. Updates combination status

### 6. UI Updates

#### Project Settings Panel (`ProjectDetailPage.tsx`)

Added two new settings:

**Page Template Selector:**
- Dropdown showing available WordPress templates
- Automatically loads when WP URL and API key are set
- Used for all pages published in this project

**Publish Status Toggle:**
- Switch between Draft and Publish
- Affects all pages published in this project
- Draft = Save to WordPress but don't publish
- Publish = Publish pages immediately

#### Combinations Table (`CombinationsTable.tsx`)

Added "Push to WordPress" button:
- Icon button (arrow up) next to regenerate and view buttons
- Only enabled for generated pages
- Shows loading state while publishing
- Updates combination status to 'pushed' on success

## 📝 Setup Instructions

### Step 1: Install WordPress Plugin

1. Upload `geoscale-plugin` folder to `/wp-content/plugins/` on your WordPress site
2. Activate the plugin in WordPress admin
3. Go to **Settings > GeoScale** in WordPress
4. Copy the generated API key

### Step 2: Apply Database Migration

Run the migration in Supabase:

```bash
cd /Users/jez/Library/CloudStorage/Dropbox/MySites/GeoScale
supabase migration up
```

Or apply manually in SQL Editor:
```sql
-- Run the contents of supabase/migrations/add_wordpress_settings_to_projects.sql
```

### Step 3: Deploy Edge Functions

```bash
# Deploy all three functions
supabase functions deploy fetch-wordpress-templates
supabase functions deploy publish-to-wordpress  
supabase functions deploy fetch-wordpress-sitemap
```

### Step 4: Configure Project Settings

In the GeoScale app:

1. Navigate to a project
2. Enter **WordPress URL** (e.g., `https://example.com`)
3. Paste the **WordPress API Key** from Step 1
4. The plugin will auto-save the key

5. **Select Page Template:**
   - Dropdown will auto-populate with available templates
   - Choose the template for generated pages
   - Empty = Default template

6. **Set Publish Status:**
   - Toggle ON = Publish pages immediately
   - Toggle OFF = Save as drafts (default)

### Step 5: Generate and Publish

1. Add location/keyword combinations
2. Click regenerate icon to generate content
3. Once generated, click the **arrow up icon** to push to WordPress
4. Page is created on WordPress with selected settings

## 🔄 Workflow

```
1. Generate Content
   ↓ (AI generates landing page)
   
2. Review Content (optional)
   ↓ (Click eye icon to view)
   
3. Push to WordPress
   ↓ (Click arrow up icon)
   
4. Page Published!
   ↓ (Page live on WordPress)
   
5. Track Rankings
   ↓ (Check Google rankings)
```

## 🛠 Troubleshooting

### Plugin Not Working

1. Check **Tools > GeoScale Logs** in WordPress for errors
2. Verify API key matches in both systems
3. Ensure pretty permalinks are enabled
4. Check PHP version is 7.4+

### Templates Not Loading

1. Verify WordPress URL is correct (include https://)
2. Check API key is valid
3. Look in browser console for errors
4. Ensure plugin is activated

### Publishing Fails

Common issues:
- **"WordPress URL and API key not configured"** - Set in project settings
- **"Generated page not found"** - Generate content first
- **"Invalid API key"** - Check key in WordPress settings
- **"Plugin not found"** - Install and activate plugin

Check WordPress plugin logs for detailed error messages.

## 🔒 Security

- All endpoints require API key authentication
- Keys are stored encrypted in Supabase
- WordPress validates keys on every request
- CORS headers properly configured
- Input sanitization on all fields

## 📊 Features by Status

### ✅ Implemented

- WordPress plugin with REST API
- Page template selection
- Draft/publish control
- Content publishing
- Generated pages
- SEO meta support
- Cache purging (LiteSpeed, Cloudflare)
- Comprehensive logging

### 🚧 Future Enhancements

- Bulk publish multiple pages
- Automatic rank tracking after push
- Featured image generation/upload
- Category assignment
- Custom field support
- Scheduled publishing

## 💡 Tips

1. **Test Connection First:** Use the WordPress Settings page to verify connectivity
2. **Start with Drafts:** Keep publish status as "draft" until you verify pages look correct
3. **Use Templates:** Create a custom page template in your theme for best results
4. **Check Logs:** WordPress logs show detailed info about each publish attempt
5. **Cache Clearing:** Plugin automatically purges caches, but may need manual clear in some setups

## 📞 Support

- WordPress plugin logs: **Tools > GeoScale Logs**
- Edge function logs: Supabase Dashboard > Edge Functions
- Database: Supabase Dashboard > Table Editor

## 🎉 Success!

You now have a complete WordPress integration that allows one-click publishing of AI-generated location-based landing pages!

---

**Created:** November 2025  
**Version:** 1.0.0

