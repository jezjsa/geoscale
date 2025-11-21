import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { copyApiKeyToClipboard, maskApiKey } from '@/utils/api-key-generator'

interface WordPressApiKeyDisplayProps {
  apiKey: string
  onRegenerate?: () => void
  isRegenerating?: boolean
}

export function WordPressApiKeyDisplay({ 
  apiKey, 
  onRegenerate,
  isRegenerating = false 
}: WordPressApiKeyDisplayProps) {
  const [showFullKey, setShowFullKey] = useState(false)

  const handleCopy = async () => {
    const success = await copyApiKeyToClipboard(apiKey)
    if (success) {
      toast.success('API key copied to clipboard')
    } else {
      toast.error('Failed to copy API key')
    }
  }

  const displayKey = showFullKey ? apiKey : maskApiKey(apiKey)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Input
          value={displayKey}
          readOnly
          className="font-mono text-sm"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowFullKey(!showFullKey)}
          title={showFullKey ? 'Hide API key' : 'Show API key'}
        >
          {showFullKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleCopy}
          title="Copy API key"
        >
          <Copy className="h-4 w-4" />
        </Button>
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
        Copy this API key and paste it into this WordPress plugin settings. Keep it secure - it provides access to create and update pages on this WordPress site.
      </p>
    </div>
  )
}

