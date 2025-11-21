import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { createLocationKeywordCombinations } from '@/api/combinations'

interface AddCombinationDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddCombinationDialog({ projectId, open, onOpenChange }: AddCombinationDialogProps) {
  const queryClient = useQueryClient()
  const [baseTown, setBaseTown] = useState('')
  const [baseKeyword, setBaseKeyword] = useState('')
  const [radius, setRadius] = useState(30) // Default 30 miles
  const [stage, setStage] = useState<'input' | 'processing'>('input')
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')

  const createCombinationsMutation = useMutation({
    mutationFn: async () => {
      return createLocationKeywordCombinations(projectId, {
        base_location: baseTown,
        base_keyword: baseKeyword,
        radius_miles: radius,
      })
    },
    onSuccess: (data) => {
      toast.success('Combinations created successfully!', {
        description: `Found ${data.locations_count} locations and ${data.keywords_count} keyword variations. Created ${data.combinations_count} combinations.`,
      })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectCombinations', projectId] })
      handleClose()
    },
    onError: (error: Error) => {
      toast.error('Error creating combinations', {
        description: error.message,
      })
      setStage('input')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!baseTown.trim() || !baseKeyword.trim()) {
      toast.error('Please fill in both fields')
      return
    }
    setStage('processing')
    createCombinationsMutation.mutate()
  }

  const handleClose = () => {
    setBaseTown('')
    setBaseKeyword('')
    setRadius(30)
    setStage('input')
    setProgress(0)
    setCurrentStep('')
    onOpenChange(false)
  }

  // Simulate progress updates
  useEffect(() => {
    if (stage === 'processing') {
      const steps = [
        { progress: 10, step: 'Initializing request...' },
        { progress: 25, step: 'Geocoding base location...' },
        { progress: 40, step: 'Finding nearby towns...' },
        { progress: 55, step: 'Fetching keyword variations...' },
        { progress: 70, step: 'Analyzing search volumes...' },
        { progress: 85, step: 'Generating combinations...' },
        { progress: 95, step: 'Saving to database...' },
      ]

      let currentIndex = 0
      const interval = setInterval(() => {
        if (currentIndex < steps.length) {
          setProgress(steps[currentIndex].progress)
          setCurrentStep(steps[currentIndex].step)
          currentIndex++
        }
      }, 800) // Update every 800ms

      return () => clearInterval(interval)
    } else {
      setProgress(0)
      setCurrentStep('')
    }
  }, [stage])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Auto-Generate Combinations</DialogTitle>
          <DialogDescription>
            Enter your base location and keyword. We'll find nearby towns and generate keyword variations automatically. Only new, unique combinations will be added.
          </DialogDescription>
        </DialogHeader>

        {stage === 'input' ? (
          <form onSubmit={handleSubmit}>
            <div className="grid gap-8 py-6">
              <div>
                <Label htmlFor="baseTown" className="text-sm text-muted-foreground font-normal block mb-3">
                  Base Location
                </Label>
                <Input
                  id="baseTown"
                  placeholder="e.g., Doncaster"
                  value={baseTown}
                  onChange={(e) => {
                    const value = e.target.value
                    // Capitalize first letter
                    const capitalized = value.charAt(0).toUpperCase() + value.slice(1)
                    setBaseTown(capitalized)
                  }}
                  disabled={createCombinationsMutation.isPending}
                />
              </div>

              <div>
                <Label htmlFor="baseKeyword" className="text-sm text-muted-foreground font-normal block mb-3">
                  Base Keyword
                </Label>
                <Input
                  id="baseKeyword"
                  placeholder="e.g., web design"
                  value={baseKeyword}
                  onChange={(e) => setBaseKeyword(e.target.value)}
                  disabled={createCombinationsMutation.isPending}
                />
              </div>

              <div>
                <Label htmlFor="radius" className="text-sm text-muted-foreground font-normal block mb-3">
                  Search Radius
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    id="radius"
                    min="10"
                    max="50"
                    step="5"
                    value={radius}
                    onChange={(e) => setRadius(parseInt(e.target.value))}
                    disabled={createCombinationsMutation.isPending}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-[#006239]"
                  />
                  <div className="flex items-baseline gap-1 min-w-[70px]">
                    <span className="text-lg font-semibold">{radius}</span>
                    <span className="text-sm text-muted-foreground">miles</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Find towns within {radius} miles of your base location (max ~31 miles due to Google API limits)
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                disabled={createCombinationsMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                style={{ backgroundColor: '#006239' }}
                className="hover:opacity-90 text-white"
                disabled={createCombinationsMutation.isPending}
              >
                Generate Combinations
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="py-8">
            <div className="space-y-6">
              <div className="text-center">
                <p className="font-medium text-lg mb-2">Processing your request...</p>
                <p className="text-sm text-muted-foreground">
                  This may take a few moments
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                <div className="min-h-[60px]">
                  {currentStep && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{currentStep}</p>
                      <div className="flex gap-1">
                        <div className="h-1 w-1 rounded-full bg-[#006239] animate-pulse"></div>
                        <div className="h-1 w-1 rounded-full bg-[#006239] animate-pulse delay-75"></div>
                        <div className="h-1 w-1 rounded-full bg-[#006239] animate-pulse delay-150"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

