<?php
/**
 * Plugin Name: GeoScale
 * Plugin URI: https://geoscale.app/wordpress-plugin
 * Description: Allows GeoScale app to publish location-based landing pages on your WordPress site. <a href="https://geoscale.app/wordpress-plugin" target="_blank">View documentation</a>
 * Version: 1.0.0
 * Author: GeoScale
 * Author URI: https://geoscale.app
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: geoscale
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('GEOSCALE_VERSION', '1.0.0');
define('GEOSCALE_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('GEOSCALE_PLUGIN_URL', plugin_dir_url(__FILE__));

/**
 * Main GeoScale Connector Class
 */
class GeoScale_Connector {
    
    /**
     * Instance of this class
     */
    private static $instance = null;
    
    /**
     * Get instance
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Constructor
     */
    private function __construct() {
        $this->init_hooks();
    }
    
    /**
     * Initialize hooks
     */
    private function init_hooks() {
        // Register REST API routes
        add_action('rest_api_init', array($this, 'register_rest_routes'));

        // Add admin menu
        add_action('admin_menu', array($this, 'add_admin_menu'));

        // Register settings
        add_action('admin_init', array($this, 'register_settings'));

        // Add settings link on plugins page
        add_filter('plugin_action_links_' . plugin_basename(__FILE__), array($this, 'add_settings_link'));

        // Clean up old logs daily
        add_action('wp_scheduled_delete', array($this, 'cleanup_old_logs'));

        // Add CORS support for REST API
        add_action('rest_api_init', array($this, 'add_cors_support'));
    }

    /**
     * Add CORS support for REST API requests
     */
    public function add_cors_support() {
        remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
        add_filter('rest_pre_serve_request', function($value) {
            header('Access-Control-Allow-Origin: *');
            header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, X-GeoScale-API-Key, Authorization');
            header('Access-Control-Allow-Credentials: true');
            return $value;
        });
    }

    /**
     * Custom logger for GeoScale plugin
     */
    private function log($message, $level = 'info') {
        $logs = get_option('geoscale_logs', array());

        // Add new log entry
        $logs[] = array(
            'timestamp' => current_time('mysql'),
            'level' => $level,
            'message' => $message,
        );

        // Keep only last 200 entries to prevent database bloat
        if (count($logs) > 200) {
            $logs = array_slice($logs, -200);
        }

        update_option('geoscale_logs', $logs, false);

        // Also log to standard error log if WP_DEBUG is enabled
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('GeoScale [' . $level . ']: ' . $message);
        }
    }

    /**
     * Cleanup old logs (older than 7 days)
     */
    public function cleanup_old_logs() {
        $logs = get_option('geoscale_logs', array());
        $cutoff_date = date('Y-m-d H:i:s', strtotime('-7 days'));

        $logs = array_filter($logs, function($log) use ($cutoff_date) {
            return $log['timestamp'] > $cutoff_date;
        });

        update_option('geoscale_logs', array_values($logs), false);
    }
    
    /**
     * Add settings link to plugin action links
     */
    public function add_settings_link($links) {
        $settings_link = '<a href="' . admin_url('options-general.php?page=geoscale-settings') . '">' . __('Settings', 'geoscale') . '</a>';
        $logs_link = '<a href="' . admin_url('tools.php?page=geoscale-logs') . '">' . __('Logs', 'geoscale') . '</a>';
        $docs_link = '<a href="https://www.geoscale.app/wordpress-plugin" target="_blank">' . __('Docs', 'geoscale') . '</a>';
        
        array_unshift($links, $settings_link, $logs_link, $docs_link);
        return $links;
    }
    
    /**
     * Register REST API routes
     */
    public function register_rest_routes() {
        register_rest_route('geoscale/v1', '/publish', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_publish_request'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));
        
        register_rest_route('geoscale/v1', '/test', array(
            'methods' => 'GET',
            'callback' => array($this, 'handle_test_request'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));
        
        register_rest_route('geoscale/v1', '/templates', array(
            'methods' => 'GET',
            'callback' => array($this, 'handle_templates_request'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));
        
        register_rest_route('geoscale/v1', '/sitemap', array(
            'methods' => 'GET',
            'callback' => array($this, 'handle_sitemap_request'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));

        register_rest_route('geoscale/v1', '/update', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_update_request'),
            'permission_callback' => array($this, 'verify_api_key'),
        ));
    }
    
    /**
     * Verify API key from request
     */
    public function verify_api_key($request) {
        $api_key = $request->get_header('X-GeoScale-API-Key');
        $stored_key = get_option('geoscale_api_key', '');
        
        if (empty($stored_key)) {
            return new WP_Error('no_api_key', 'API key not configured in WordPress', array('status' => 401));
        }
        
        if ($api_key !== $stored_key) {
            return new WP_Error('invalid_api_key', 'Invalid API key', array('status' => 401));
        }
        
        return true;
    }
    
    /**
     * Handle test request
     */
    public function handle_test_request($request) {
        return rest_ensure_response(array(
            'success' => true,
            'message' => 'GeoScale connector is working!',
            'wordpress_version' => get_bloginfo('version'),
            'site_url' => get_site_url(),
        ));
    }
    
    /**
     * Handle templates request - returns available page templates
     */
    public function handle_templates_request($request) {
        $this->log('Templates request received', 'info');

        $templates = wp_get_theme()->get_page_templates();
        
        $formatted_templates = array();
        
        // Add default template
        $formatted_templates[] = array(
            'value' => '',
            'label' => 'Default Template',
        );
        
        // Add theme templates
        foreach ($templates as $template_file => $template_name) {
            $formatted_templates[] = array(
                'value' => $template_file,
                'label' => $template_name,
            );
        }
        
        $this->log('Templates returned: ' . count($formatted_templates) . ' templates', 'success');
        
        return rest_ensure_response(array(
            'success' => true,
            'templates' => $formatted_templates,
        ));
    }
    
    /**
     * Handle publish request - creates a new page
     */
    public function handle_publish_request($request) {
        $params = $request->get_json_params();
        
        // Validate required fields
        if (empty($params['title']) || empty($params['content'])) {
            return new WP_Error('missing_fields', 'Title and content are required', array('status' => 400));
        }
        
        try {
            $this->log('Starting publish request for page: ' . $params['title']);
            
            // Check for duplicate pages with the same title
            $existing_page = get_page_by_title($params['title'], OBJECT, 'page');
            if ($existing_page) {
                $this->log('Duplicate page detected! Page with title "' . $params['title'] . '" already exists (ID: ' . $existing_page->ID . ')', 'warning');
                
                // Check if it's a GeoScale page
                $is_geoscale_page = get_post_meta($existing_page->ID, 'geoscale_page', true);
                if ($is_geoscale_page) {
                    $this->log('Existing page is a GeoScale page, returning existing page ID instead of creating duplicate', 'warning');
                    return rest_ensure_response(array(
                        'success' => true,
                        'message' => 'Page with this title already exists',
                        'page_id' => $existing_page->ID,
                        'edit_url' => get_edit_post_link($existing_page->ID, 'raw'),
                        'page_url' => get_permalink($existing_page->ID),
                        'duplicate_prevented' => true
                    ));
                }
            }
            
            // Determine page status (draft or publish)
            $page_status = 'draft'; // Default to draft
            if (!empty($params['status'])) {
                $page_status = sanitize_text_field($params['status']);
                // Ensure it's either 'draft' or 'publish'
                if (!in_array($page_status, array('draft', 'publish'))) {
                    $page_status = 'draft';
                }
            }
            
            // Prepare page data
            $content = $params['content'];
            if (!$this->is_html($content)) {
                $this->log('Content appears to be markdown, converting to HTML');
                $content = $this->convert_markdown_to_html($content);
            }
            
            // Use wp_kses_post for sanitization
            $allowed_html = wp_kses_allowed_html('post');
            $allowed_html['iframe'] = array(
                'src' => true,
                'width' => true,
                'height' => true,
                'frameborder' => true,
                'allowfullscreen' => true,
                'allow' => true,
                'title' => true,
                'class' => true,
                'id' => true,
                'style' => true,
            );
            
            $page_data = array(
                'post_title'    => sanitize_text_field($params['title']),
                'post_content'  => wp_kses($content, $allowed_html),
                'post_status'   => $page_status,
                'post_author'   => 1, // Default to admin
                'post_type'     => 'page', // Create as page, not post
            );
            
            // Set meta description if provided
            if (!empty($params['meta_description'])) {
                $page_data['post_excerpt'] = sanitize_text_field($params['meta_description']);
            }
            
            // Set page template if provided
            if (!empty($params['page_template'])) {
                $template = sanitize_text_field($params['page_template']);
                // Validate template exists
                $available_templates = wp_get_theme()->get_page_templates();
                if ($template === '' || isset($available_templates[$template])) {
                    $page_data['page_template'] = $template;
                    $this->log('Using page template: ' . ($template === '' ? 'default' : $template));
                }
            }
            
            // Insert the page
            $page_id = wp_insert_post($page_data, true);
            
            if (is_wp_error($page_id)) {
                return new WP_Error('page_creation_failed', $page_id->get_error_message(), array('status' => 500));
            }
            
            // Set page template meta (required for some themes)
            if (!empty($params['page_template'])) {
                update_post_meta($page_id, '_wp_page_template', $params['page_template']);
            }
            
            // Handle featured image if provided
            if (!empty($params['image_url'])) {
                $this->log('Processing image URL: ' . substr($params['image_url'], 0, 100) . '...');
                $featured_image_id = $this->upload_image_from_url($params['image_url'], $params['title'], $page_id);
                if ($featured_image_id) {
                    $this->log('Featured image uploaded with ID: ' . $featured_image_id, 'success');
                    update_post_meta($featured_image_id, '_wp_attachment_image_alt', sanitize_text_field($params['title']));
                    set_post_thumbnail($page_id, $featured_image_id);
                }
            }
            
            // Add SEO meta data
            if (!empty($params['meta_title'])) {
                update_post_meta($page_id, '_yoast_wpseo_title', sanitize_text_field($params['meta_title']));
                update_post_meta($page_id, 'rank_math_title', sanitize_text_field($params['meta_title']));
            }
            
            if (!empty($params['meta_description'])) {
                update_post_meta($page_id, '_yoast_wpseo_metadesc', sanitize_text_field($params['meta_description']));
                update_post_meta($page_id, 'rank_math_description', sanitize_text_field($params['meta_description']));
            }
            
            // Mark this as a GeoScale page for tracking
            update_post_meta($page_id, 'geoscale_page', '1');
            
            // Store location and keyword data
            if (!empty($params['location'])) {
                update_post_meta($page_id, 'geoscale_location', sanitize_text_field($params['location']));
            }
            
            if (!empty($params['keyword'])) {
                update_post_meta($page_id, 'geoscale_keyword', sanitize_text_field($params['keyword']));
            }
            
            // Final update to ensure all metadata is saved
            wp_update_post(array('ID' => $page_id));
            
            // Clear caches
            clean_post_cache($page_id);
            
            // Purge LiteSpeed Cache if available
            if (defined('LSCWP_V') || class_exists('LiteSpeed_Cache_API')) {
                do_action('litespeed_purge_post', $page_id);
                do_action('litespeed_purge_all');
                $this->log('Triggered LiteSpeed cache purge', 'success');
            }
            
            // Purge Cloudflare cache if available
            if (class_exists('CF\WordPress\Hooks')) {
                do_action('cloudflare_purge_by_url', get_permalink($page_id));
                $this->log('Triggered Cloudflare purge', 'success');
            }

            $this->log('Page creation complete with ID: ' . $page_id, 'success');

            // Return success response
            return rest_ensure_response(array(
                'success' => true,
                'message' => 'Page published successfully',
                'page_id' => $page_id,
                'edit_url' => get_edit_post_link($page_id, 'raw'),
                'page_url' => get_permalink($page_id),
            ));

        } catch (Exception $e) {
            $this->log('Exception in handle_publish_request: ' . $e->getMessage(), 'error');
            return new WP_Error('publish_error', 'Failed to publish: ' . $e->getMessage(), array('status' => 500));
        }
    }
    
    /**
     * Handle update request - updates an existing page
     */
    public function handle_update_request($request) {
        $params = $request->get_json_params();
        
        // Validate required fields
        if (empty($params['page_id']) || empty($params['title']) || empty($params['content'])) {
            return new WP_Error('missing_fields', 'Page ID, title and content are required', array('status' => 400));
        }
        
        $page_id = intval($params['page_id']);
        
        // Check if page exists
        $page = get_post($page_id);
        if (!$page || $page->post_type !== 'page') {
            return new WP_Error('page_not_found', 'Page not found', array('status' => 404));
        }
        
        try {
            $this->log('Updating page ID: ' . $page_id);
            
            // Determine page status
            $page_status = $page->post_status;
            if (!empty($params['status'])) {
                $page_status = sanitize_text_field($params['status']);
                if (!in_array($page_status, array('draft', 'publish'))) {
                    $page_status = $page->post_status;
                }
            }
            
            // Prepare content
            $content = $params['content'];
            if (!$this->is_html($content)) {
                $content = $this->convert_markdown_to_html($content);
            }
            
            $allowed_html = wp_kses_allowed_html('post');
            $allowed_html['iframe'] = array(
                'src' => true,
                'width' => true,
                'height' => true,
                'frameborder' => true,
                'allowfullscreen' => true,
                'allow' => true,
                'title' => true,
                'class' => true,
                'id' => true,
                'style' => true,
            );
            
            $page_data = array(
                'ID'            => $page_id,
                'post_title'    => sanitize_text_field($params['title']),
                'post_content'  => wp_kses($content, $allowed_html),
                'post_status'   => $page_status,
            );
            
            if (!empty($params['meta_description'])) {
                $page_data['post_excerpt'] = sanitize_text_field($params['meta_description']);
            }
            
            // Update the page
            $result = wp_update_post($page_data, true);
            
            if (is_wp_error($result)) {
                return new WP_Error('page_update_failed', $result->get_error_message(), array('status' => 500));
            }
            
            // Update page template if provided
            if (!empty($params['page_template'])) {
                $template = sanitize_text_field($params['page_template']);
                $available_templates = wp_get_theme()->get_page_templates();
                if ($template === '' || isset($available_templates[$template])) {
                    update_post_meta($page_id, '_wp_page_template', $template);
                }
            }
            
            // Handle featured image
            if (!empty($params['image_url'])) {
                $old_thumbnail_id = get_post_thumbnail_id($page_id);
                if ($old_thumbnail_id) {
                    wp_delete_attachment($old_thumbnail_id, true);
                }
                
                $featured_image_id = $this->upload_image_from_url($params['image_url'], $params['title'], $page_id);
                if ($featured_image_id) {
                    update_post_meta($featured_image_id, '_wp_attachment_image_alt', sanitize_text_field($params['title']));
                    set_post_thumbnail($page_id, $featured_image_id);
                }
            }
            
            // Update SEO meta
            if (!empty($params['meta_title'])) {
                update_post_meta($page_id, '_yoast_wpseo_title', sanitize_text_field($params['meta_title']));
                update_post_meta($page_id, 'rank_math_title', sanitize_text_field($params['meta_title']));
            }
            
            if (!empty($params['meta_description'])) {
                update_post_meta($page_id, '_yoast_wpseo_metadesc', sanitize_text_field($params['meta_description']));
                update_post_meta($page_id, 'rank_math_description', sanitize_text_field($params['meta_description']));
            }
            
            // Update location and keyword
            if (!empty($params['location'])) {
                update_post_meta($page_id, 'geoscale_location', sanitize_text_field($params['location']));
            }
            
            if (!empty($params['keyword'])) {
                update_post_meta($page_id, 'geoscale_keyword', sanitize_text_field($params['keyword']));
            }
            
            // Clear caches
            clean_post_cache($page_id);
            
            // Purge LiteSpeed Cache
            if (defined('LSCWP_V')) {
                do_action('litespeed_purge_post', $page_id);
                do_action('litespeed_purge_all');
            }
            
            // Purge Cloudflare
            if (class_exists('CF\WordPress\Hooks')) {
                do_action('cloudflare_purge_by_url', get_permalink($page_id));
            }

            $this->log('Page update complete for ID: ' . $page_id, 'success');
            
            return rest_ensure_response(array(
                'success' => true,
                'message' => 'Page updated successfully',
                'page_id' => $page_id,
                'edit_url' => get_edit_post_link($page_id, 'raw'),
                'page_url' => get_permalink($page_id),
            ));
            
        } catch (Exception $e) {
            $this->log('Exception in handle_update_request: ' . $e->getMessage(), 'error');
            return new WP_Error('update_error', $e->getMessage(), array('status' => 500));
        }
    }

    /**
     * Detect which SEO plugin is active
     */
    private function detect_seo_plugin() {
        if (class_exists('RankMath') || defined('RANK_MATH_VERSION')) {
            return 'rank_math';
        }
        
        if (defined('WPSEO_VERSION') || class_exists('WPSEO_Options')) {
            return 'yoast';
        }
        
        return 'none';
    }

    /**
     * Get meta title based on active SEO plugin
     */
    private function get_meta_title($post_id, $seo_plugin) {
        $meta_title = '';
        
        switch ($seo_plugin) {
            case 'rank_math':
                $meta_title = get_post_meta($post_id, 'rank_math_title', true);
                break;
            case 'yoast':
                $meta_title = get_post_meta($post_id, '_yoast_wpseo_title', true);
                break;
        }
        
        if (empty($meta_title)) {
            $meta_title = get_the_title($post_id);
        }
        
        return $meta_title;
    }

    /**
     * Get meta description based on active SEO plugin
     */
    private function get_meta_description($post_id, $seo_plugin) {
        $meta_description = '';
        
        switch ($seo_plugin) {
            case 'rank_math':
                $meta_description = get_post_meta($post_id, 'rank_math_description', true);
                break;
            case 'yoast':
                $meta_description = get_post_meta($post_id, '_yoast_wpseo_metadesc', true);
                break;
        }
        
        if (empty($meta_description)) {
            $meta_description = get_the_excerpt($post_id);
        }
        
        return $meta_description;
    }

    /**
     * Handle sitemap request
     */
    public function handle_sitemap_request($request) {
        $this->log('Sitemap request received', 'info');

        $seo_plugin = $this->detect_seo_plugin();
        $this->log('SEO plugin detected: ' . $seo_plugin, 'info');

        $sitemap_data = array();

        // Get all pages and posts
        $post_types = array('page', 'post');

        foreach ($post_types as $post_type) {
            $args = array(
                'post_type' => $post_type,
                'posts_per_page' => -1,
                'post_status' => 'publish',
                'orderby' => 'modified',
                'order' => 'DESC',
            );

            $query = new WP_Query($args);

            if ($query->have_posts()) {
                while ($query->have_posts()) {
                    $query->the_post();
                    $post_id = get_the_ID();

                    $meta_title = $this->get_meta_title($post_id, $seo_plugin);
                    $meta_description = $this->get_meta_description($post_id, $seo_plugin);

                    $sitemap_data[] = array(
                        'id' => $post_id,
                        'type' => $post_type,
                        'slug' => get_post_field('post_name', $post_id),
                        'url' => get_permalink($post_id),
                        'meta_title' => $meta_title,
                        'meta_description' => $meta_description,
                        'status' => get_post_status($post_id),
                        'modified' => get_the_modified_date('Y-m-d H:i:s'),
                    );
                }
                wp_reset_postdata();
            }
        }

        $this->log('Sitemap returned: ' . count($sitemap_data) . ' items', 'success');

        return rest_ensure_response(array(
            'success' => true,
            'sitemap' => $sitemap_data,
            'total_items' => count($sitemap_data),
            'seo_plugin' => $seo_plugin,
        ));
    }

    /**
     * Upload image from URL
     */
    private function upload_image_from_url($image_url, $post_title, $post_id = 0) {
        if (empty($image_url)) {
            return null;
        }

        require_once(ABSPATH . 'wp-admin/includes/file.php');
        require_once(ABSPATH . 'wp-admin/includes/media.php');
        require_once(ABSPATH . 'wp-admin/includes/image.php');

        // Check if it's a base64 data URI
        if (strpos($image_url, 'data:image/') === 0) {
            $this->log('Processing base64 image');
            return $this->upload_base64_image($image_url, $post_title, $post_id);
        }
        
        // Set longer timeout for image downloads
        add_filter('http_request_timeout', function() { return 30; });
        
        // Download image from URL
        $tmp = download_url($image_url);

        if (is_wp_error($tmp)) {
            $this->log('Failed to download image - ' . $tmp->get_error_message(), 'error');
            return null;
        }
        
        $file_array = array();
        
        if (preg_match('/[^\?]+\.(jpg|jpe|jpeg|gif|png|webp)/i', $image_url, $matches)) {
            $extension = $matches[1];
        } else {
            $file_type = wp_check_filetype($tmp);
            $extension = $file_type['ext'] ?: 'jpg';
        }
        
        $file_array['name'] = sanitize_file_name(substr($post_title, 0, 50) . '-' . time() . '.' . $extension);
        $file_array['tmp_name'] = $tmp;

        $id = media_handle_sideload($file_array, $post_id, null, array(
            'test_form' => false,
        ));

        if (file_exists($tmp)) {
            @unlink($tmp);
        }

        if (is_wp_error($id)) {
            $this->log('Failed to upload image - ' . $id->get_error_message(), 'error');
            return null;
        }

        $this->log('Image uploaded successfully with ID: ' . $id, 'success');
        return $id;
    }
    
    /**
     * Upload base64 image
     */
    private function upload_base64_image($base64_string, $post_title, $post_id = 0) {
        if (!preg_match('/^data:image\/(\w+);base64,/', $base64_string, $type)) {
            return null;
        }

        $extension = strtolower($type[1]);
        $base64_string = substr($base64_string, strpos($base64_string, ',') + 1);
        $image_data = base64_decode($base64_string);

        if ($image_data === false) {
            return null;
        }
        
        $upload_dir = wp_upload_dir();
        $filename = sanitize_file_name(substr($post_title, 0, 50) . '-' . time() . '.' . $extension);
        $filepath = $upload_dir['path'] . '/' . $filename;
        
        if (file_put_contents($filepath, $image_data) === false) {
            return null;
        }

        $file_array = array(
            'name' => $filename,
            'tmp_name' => $filepath,
        );

        $attachment_id = media_handle_sideload($file_array, $post_id, null, array(
            'test_form' => false,
        ));

        if (file_exists($filepath)) {
            @unlink($filepath);
        }

        if (is_wp_error($attachment_id)) {
            return null;
        }

        return $attachment_id;
    }
    
    /**
     * Check if content is HTML
     */
    private function is_html($content) {
        return preg_match('/<(p|div|h[1-6]|br|strong|em|ul|ol|li|a|img|table|tr|td|th|span|blockquote)[>\s]/i', $content) === 1;
    }
    
    /**
     * Convert markdown to HTML
     */
    private function convert_markdown_to_html($markdown) {
        $html = preg_replace('/^### (.*?)$/m', '<h3>$1</h3>', $markdown);
        $html = preg_replace('/^## (.*?)$/m', '<h2>$1</h2>', $html);
        $html = preg_replace('/^# (.*?)$/m', '<h1>$1</h1>', $html);
        $html = preg_replace('/\*\*(.*?)\*\*/', '<strong>$1</strong>', $html);
        $html = preg_replace('/\*(.*?)\*/', '<em>$1</em>', $html);
        $html = preg_replace('/\[(.*?)\]\((.*?)\)/', '<a href="$2">$1</a>', $html);
        
        $paragraphs = explode("\n\n", $html);
        $html = '';
        foreach ($paragraphs as $para) {
            $para = trim($para);
            if (!empty($para) && !preg_match('/^<h[1-6]>/', $para)) {
                $html .= '<p>' . $para . '</p>' . "\n";
            } else {
                $html .= $para . "\n";
            }
        }
        
        return $html;
    }
    
    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_options_page(
            'GeoScale Settings',
            'GeoScale',
            'manage_options',
            'geoscale-settings',
            array($this, 'render_settings_page')
        );

        add_management_page(
            'GeoScale Logs',
            'GeoScale Logs',
            'manage_options',
            'geoscale-logs',
            array($this, 'render_logs_page')
        );
    }
    
    /**
     * Register settings
     */
    public function register_settings() {
        register_setting('geoscale_settings', 'geoscale_api_key', array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default' => '',
        ));
    }
    
    /**
     * Render settings page
     */
    public function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        
        if (isset($_POST['geoscale_save_settings'])) {
            check_admin_referer('geoscale_settings');
            update_option('geoscale_api_key', sanitize_text_field($_POST['geoscale_api_key']));
            echo '<div class="notice notice-success"><p>Settings saved successfully!</p></div>';
        }
        
        $api_key = get_option('geoscale_api_key', '');
        $site_url = get_site_url();
        ?>
        <div class="wrap">
            <h1>GeoScale Settings</h1>
            
            <form method="post" action="">
                <?php wp_nonce_field('geoscale_settings'); ?>
                
                <table class="form-table">
                    <tr>
                        <th scope="row">
                            <label for="geoscale_api_key">API Key</label>
                        </th>
                        <td>
                            <input 
                                type="text" 
                                id="geoscale_api_key" 
                                name="geoscale_api_key" 
                                value="<?php echo esc_attr($api_key); ?>" 
                                class="regular-text"
                                placeholder="Enter your GeoScale API key"
                            />
                            <p class="description">
                                Enter the API key from your GeoScale project settings.
                            </p>
                        </td>
                    </tr>
                </table>
                
                <h2>Connection Information</h2>
                <table class="form-table">
                    <tr>
                        <th scope="row">WordPress URL</th>
                        <td>
                            <code><?php echo esc_html($site_url); ?></code>
                            <p class="description">Use this URL in your GeoScale project settings.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">API Endpoint</th>
                        <td>
                            <code><?php echo esc_html(rest_url('geoscale/v1/publish')); ?></code>
                            <p class="description">This is the endpoint GeoScale uses to publish pages.</p>
                        </td>
                    </tr>
                </table>
                
                <div style="margin-top: 20px; padding: 15px; background: #f0f0f1; border-left: 4px solid #006239;">
                    <h3 style="margin-top: 0;">Need Help?</h3>
                    <p>Check the debug logs for detailed information about plugin activity.</p>
                    <a href="<?php echo admin_url('tools.php?page=geoscale-logs'); ?>" class="button button-secondary">
                        View Debug Logs
                    </a>
                </div>
                
                <?php submit_button('Save Settings', 'primary', 'geoscale_save_settings'); ?>
            </form>
            
            <hr>
            
            <h2>Setup Instructions</h2>
            <ol>
                <li>Copy your API key from your GeoScale project settings</li>
                <li>Paste it in the "API Key" field above and save</li>
                <li>Copy your WordPress URL (shown above) into your GeoScale project</li>
                <li>Test the connection from the GeoScale app</li>
                <li>Start generating location-based landing pages!</li>
            </ol>
            
            <h3>Features</h3>
            <ul>
                <li>✓ Publishes location-based landing pages</li>
                <li>✓ Automatically sets featured images</li>
                <li>✓ SEO meta title and description (Yoast & Rank Math compatible)</li>
                <li>✓ Custom page template selection</li>
                <li>✓ Secure API key authentication</li>
            </ul>
        </div>
        <?php
    }

    /**
     * Render logs page
     */
    public function render_logs_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        if (isset($_POST['geoscale_clear_logs'])) {
            check_admin_referer('geoscale_clear_logs');
            update_option('geoscale_logs', array());
            echo '<div class="notice notice-success"><p>Logs cleared successfully!</p></div>';
        }

        $logs = get_option('geoscale_logs', array());
        $logs = array_reverse($logs);

        ?>
        <div class="wrap">
            <h1>GeoScale Debug Logs</h1>

            <p>These logs help diagnose issues with the GeoScale plugin.</p>

            <div style="margin: 20px 0;">
                <button type="button" class="button button-primary" id="geoscale-copy-logs">
                    Copy All Logs to Clipboard
                </button>

                <form method="post" style="display: inline-block; margin-left: 10px;">
                    <?php wp_nonce_field('geoscale_clear_logs'); ?>
                    <button type="submit" name="geoscale_clear_logs" class="button"
                            onclick="return confirm('Are you sure you want to clear all logs?');">
                        Clear Logs
                    </button>
                </form>

                <span id="geoscale-copy-feedback" style="margin-left: 10px; color: green; display: none;">
                    ✓ Copied to clipboard!
                </span>
            </div>

            <?php if (empty($logs)): ?>
                <div class="notice notice-info">
                    <p>No logs available. Logs will appear here when the plugin performs actions.</p>
                </div>
            <?php else: ?>
                <div style="background: #fff; border: 1px solid #ccc; padding: 15px; margin-top: 20px;">
                    <p><strong>Total Logs:</strong> <?php echo count($logs); ?> (last 200 entries, max 7 days)</p>
                </div>

                <div id="geoscale-logs-container" style="background: #1e1e1e; color: #d4d4d4; padding: 20px;
                     margin-top: 20px; border-radius: 5px; font-family: 'Courier New', monospace;
                     font-size: 13px; max-height: 600px; overflow-y: auto;">
                    <?php foreach ($logs as $log): ?>
                        <?php
                        $level_color = array(
                            'error' => '#f48771',
                            'warning' => '#dcdcaa',
                            'info' => '#4fc1ff',
                            'success' => '#4ec9b0',
                        );
                        $color = isset($level_color[$log['level']]) ? $level_color[$log['level']] : '#d4d4d4';
                        ?>
                        <div style="margin-bottom: 8px;">
                            <span style="color: #858585;">[<?php echo esc_html($log['timestamp']); ?>]</span>
                            <span style="color: <?php echo $color; ?>;">
                                [<?php echo strtoupper(esc_html($log['level'])); ?>]
                            </span>
                            <span><?php echo esc_html($log['message']); ?></span>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>

            <script>
            document.getElementById('geoscale-copy-logs').addEventListener('click', function() {
                var logs = <?php echo json_encode($logs); ?>;
                var logText = '=== GeoScale Plugin Debug Logs ===\n\n';
                logText += 'WordPress Version: <?php echo get_bloginfo('version'); ?>\n';
                logText += 'Plugin Version: <?php echo GEOSCALE_VERSION; ?>\n\n';

                logs.forEach(function(log) {
                    logText += '[' + log.timestamp + '] [' + log.level.toUpperCase() + '] ' + log.message + '\n';
                });

                var textarea = document.createElement('textarea');
                textarea.value = logText;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();

                try {
                    document.execCommand('copy');
                    document.getElementById('geoscale-copy-feedback').style.display = 'inline';
                    setTimeout(function() {
                        document.getElementById('geoscale-copy-feedback').style.display = 'none';
                    }, 3000);
                } catch (err) {
                    alert('Failed to copy logs');
                }

                document.body.removeChild(textarea);
            });
            </script>
        </div>
        <?php
    }
}

// Initialize the GeoScale plugin
function geoscale_connector_init() {
    return GeoScale_Connector::get_instance();
}

add_action('plugins_loaded', 'geoscale_connector_init');

