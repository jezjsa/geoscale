/**
 * WordPress API Key Generator
 * 
 * Generates secure API keys for WordPress plugin authentication.
 * Each project gets its own unique API key that the site owner
 * copies into their WordPress plugin settings.
 */

/**
 * Generate a secure random API key
 * Format: gs_live_[32 random characters]
 */
export function generateWordPressApiKey(): string {
  const prefix = 'gs_live_'
  const length = 32
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  
  let result = ''
  const randomValues = new Uint8Array(length)
  crypto.getRandomValues(randomValues)
  
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length]
  }
  
  return prefix + result
}

/**
 * Mask an API key for display (show first 12 and last 4 characters)
 * Example: gs_live_abc123...xyz9
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 16) return apiKey
  
  const start = apiKey.substring(0, 12)
  const end = apiKey.substring(apiKey.length - 4)
  
  return `${start}...${end}`
}

/**
 * Copy API key to clipboard
 */
export async function copyApiKeyToClipboard(apiKey: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(apiKey)
    return true
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    return false
  }
}

