interface WordPressIconProps {
  className?: string
}

export function WordPressIcon({ className }: WordPressIconProps) {
  return (
    <span className={`font-bold ${className}`} style={{ fontFamily: 'Arial, sans-serif' }}>
      W
    </span>
  )
}
