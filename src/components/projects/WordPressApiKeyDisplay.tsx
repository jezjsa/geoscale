import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, RefreshCw, TestTube2 } from 'lucide-react'
import { toast } from 'sonner'
import { copyApiKeyToClipboard } from '@/utils/api-key-generator'

interface WordPressApiKeyDisplayProps {
  apiKey: string
  wordpressUrl?: string
  onRegenerate?: () => void
  onTestConnection?: () => void
  isRegenerating?: boolean
  isTesting?: boolean
}

export function WordPressApiKeyDisplay({ 
  apiKey, 
  wordpressUrl,
  onRegenerate,
  onTestConnection,
  isRegenerating = false,
  isTesting = false
}: WordPressApiKeyDisplayProps) {
  const handleCopy = async () => {
    const success = await copyApiKeyToClipboard(apiKey)
    if (success) {
      toast.success('API key copied to clipboard')
    } else {
      toast.error('Failed to copy API key')
    }
  }

  const canTest = wordpressUrl && apiKey

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={apiKey}
          readOnly
          className="font-mono text-sm"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={handleCopy}
          title="Copy API key"
        >
          <Copy className="h-4 w-4" />
        </Button>
        {onTestConnection && (
          <Button
            variant="outline"
            size="icon"
            onClick={onTestConnection}
            disabled={isTesting || !canTest}
            title={canTest ? "Test WordPress connection" : "Enter WordPress URL first"}
          >
            <TestTube2 className={`h-4 w-4 ${isTesting ? 'animate-pulse' : ''}`} />
          </Button>
        )}
        {onRegenerate && (
          <Button
            variant="outline"
            size="icon"
            onClick={onRegenerate}
            disabled={isRegenerating}
            title="Regenerate API key"
          >
            <RefreshCw className={`h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Copy this API key and paste it into the WordPress plugin settings. Keep it secure - it provides access to create and update pages on this WordPress site.
      </p>
    </div>
  )
}

