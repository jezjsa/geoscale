import { useState, useEffect } from 'react'

const serviceData = [
  { service: 'Web designers', locations: ['Doncaster', 'Sheffield', 'Manchester'] },
  { service: 'Accountants', locations: ['Birmingham', 'Leeds', 'Bristol'] },
  { service: 'Plumbers', locations: ['Liverpool', 'Newcastle', 'Nottingham'] },
  { service: 'Electricians', locations: ['Cardiff', 'Edinburgh', 'Glasgow'] },
  { service: 'Solicitors', locations: ['Brighton', 'Oxford', 'Cambridge'] },
]

export function TypewriterLocations() {
  const [displayText, setDisplayText] = useState('')
  const [serviceIndex, setServiceIndex] = useState(0)
  const [locationIndex, setLocationIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  const currentService = serviceData[serviceIndex].service
  const currentLocations = serviceData[serviceIndex].locations
  const currentLocation = currentLocations[locationIndex]

  useEffect(() => {
    if (isPaused) {
      const pauseTimer = setTimeout(() => {
        setIsPaused(false)
        setIsDeleting(true)
      }, 1500) // Pause for 1.5 seconds before deleting
      return () => clearTimeout(pauseTimer)
    }

    if (isDeleting) {
      if (displayText.length === 0) {
        setIsDeleting(false)
        // Move to next location, or next service if we've done all locations
        if (locationIndex === currentLocations.length - 1) {
          setLocationIndex(0)
          setServiceIndex((prev) => (prev + 1) % serviceData.length)
        } else {
          setLocationIndex((prev) => prev + 1)
        }
        return
      }
      
      const deleteTimer = setTimeout(() => {
        setDisplayText((prev) => prev.slice(0, -1))
      }, 60) // Delete speed
      return () => clearTimeout(deleteTimer)
    }

    // Typing
    if (displayText.length < currentLocation.length) {
      const typeTimer = setTimeout(() => {
        setDisplayText(currentLocation.slice(0, displayText.length + 1))
      }, 125) // Type speed
      return () => clearTimeout(typeTimer)
    } else {
      // Finished typing, pause before deleting
      setIsPaused(true)
    }
  }, [displayText, locationIndex, isDeleting, isPaused, currentLocation, currentLocations.length])

  return (
    <div className="inline-flex items-center bg-zinc-800 rounded-full px-5 py-2.5 text-base">
      <span className="text-zinc-300">{currentService} in&nbsp;</span>
      <span className="text-white font-medium text-left">
        {displayText}
      </span>
    </div>
  )
}
