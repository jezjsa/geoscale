import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Check, Pencil } from 'lucide-react'

interface InlineEditProps {
  value: string
  onSave: (value: string) => Promise<void>
  multiline?: boolean
  type?: string
  placeholder?: string
  className?: string
}

export function InlineEdit({
  value,
  onSave,
  multiline = false,
  type = 'text',
  placeholder = 'Click to edit',
  className = '',
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setEditValue(value)
  }, [value])

  useEffect(() => {
    if (isEditing) {
      if (multiline) {
        textareaRef.current?.focus()
      } else {
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
  }, [isEditing, multiline])

  const handleSave = async () => {
    // Don't process if already saving
    if (isSaving) return
    
    if (editValue === value) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      await onSave(editValue)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)
    } catch (error) {
      // Error handled by parent
      setEditValue(value) // Revert on error
    } finally {
      setIsSaving(false)
      setIsEditing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline && !isSaving) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      setEditValue(value)
      setIsEditing(false)
      setIsSaving(false)
    }
  }

  if (isEditing) {
    return multiline ? (
      <Textarea
        ref={textareaRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        className={`text-sm ${isSaving ? 'opacity-50 cursor-wait' : ''} ${className}`}
        rows={3}
      />
    ) : (
      <Input
        ref={inputRef}
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        className={`text-sm ${isSaving ? 'opacity-50 cursor-wait' : ''} ${className}`}
      />
    )
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer hover:bg-accent/50 rounded px-2 py-1 -mx-2 -my-1 transition-colors relative group ${className}`}
    >
      <div className="flex items-start gap-2">
        <span className="text-sm break-words flex-1 min-w-0">{value || placeholder}</span>
        <div className="flex-shrink-0">
          {showSuccess && (
            <Check className="h-4 w-4 text-green-600" />
          )}
          {!showSuccess && (
            <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
          )}
        </div>
      </div>
    </div>
  )
}

