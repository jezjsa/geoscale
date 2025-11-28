import { useEffect } from 'react'

interface PageMeta {
  title: string
  description?: string
}

export function usePageMeta({ title, description }: PageMeta) {
  useEffect(() => {
    // Set document title
    document.title = title
    
    // Set meta description
    if (description) {
      let metaDescription = document.querySelector('meta[name="description"]')
      if (!metaDescription) {
        metaDescription = document.createElement('meta')
        metaDescription.setAttribute('name', 'description')
        document.head.appendChild(metaDescription)
      }
      metaDescription.setAttribute('content', description)
    }
    
    // Cleanup - restore default on unmount
    return () => {
      document.title = 'GeoScale - AI-Powered Location Landing Pages'
    }
  }, [title, description])
}
