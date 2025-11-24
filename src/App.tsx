import { useEffect, useState } from 'react'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'

export function App() {
  const [routerKey, setRouterKey] = useState(0)

  useEffect(() => {
    // When tab becomes visible again, refresh router to fix broken links
    // This ensures event listeners are reattached to Link components
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          // Force router to remount by changing key
          // This re-initializes all event listeners
          setRouterKey(prev => prev + 1)
        }, 50)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return <RouterProvider router={router} key={routerKey} />
}

