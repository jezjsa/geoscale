# GeoScale WordPress Plugin

This plugin allows the GeoScale app to publish location-based landing pages directly to your WordPress site.

## Installation

1. Upload the `geoscale-plugin` folder to your WordPress `/wp-content/plugins/` directory
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Go to Settings > GeoScale in your WordPress admin
4. Copy the API key from your GeoScale project settings
5. Paste it into the plugin settings and save

## Features

- ✅ Publishes location-based landing pages as WordPress pages (not posts)
- ✅ Supports custom page templates
- ✅ Automatically uploads and sets featured images
- ✅ SEO-friendly (compatible with Yoast SEO and Rank Math)
- ✅ Draft or Published status control
- ✅ Secure API key authentication
- ✅ Comprehensive logging for troubleshooting

## API Endpoints

The plugin provides these REST API endpoints:

- `GET /wp-json/geoscale/v1/test` - Test connection
- `GET /wp-json/geoscale/v1/templates` - Get available page templates
- `GET /wp-json/geoscale/v1/sitemap` - Get site pages/posts with SEO data
- `POST /wp-json/geoscale/v1/publish` - Publish new page
- `POST /wp-json/geoscale/v1/update` - Update existing page

All endpoints require the `X-GeoScale-API-Key` header with your API key.

## Requirements

- WordPress 5.0 or higher
- PHP 7.4 or higher
- Pretty permalinks enabled

## Support

For issues or questions, check the debug logs at Tools > GeoScale Logs in your WordPress admin.

