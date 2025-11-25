import { useState } from 'react'
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
import { toast } from 'sonner'
import { addSpecificCombinations } from '@/api/combinations'

interface AddFirstCombinationDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddFirstCombinationDialog({ 
  projectId, 
  open, 
  onOpenChange 
}: AddFirstCombinationDialogProps) {
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState('')
  const [location, setLocation] = useState('')

  const addMutation = useMutation({
    mutationFn: async (combination: { location: string; keyword: string }) => {
      return addSpecificCombinations(projectId, [combination])
    },
    onSuccess: () => {
      toast.success('Combination created successfully!')
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectCombinations', projectId] })
      handleClose()
    },
    onError: (error: Error) => {
      toast.error('Error creating combination', {
        description: error.message,
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!keyword.trim()) {
      toast.error('Please enter a keyword phrase')
      return
    }

    if (!location.trim()) {
      toast.error('Please enter a location')
      return
    }

    addMutation.mutate({
      keyword: keyword.trim(),
      location: location.trim(),
    })
  }

  const handleClose = () => {
    setKeyword('')
    setLocation('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Your First Combination</DialogTitle>
          <DialogDescription>
            Enter a keyword phrase and a location to create your first combination page.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="keyword">Keyword Phrase</Label>
            <Input
              id="keyword"
              placeholder="e.g., plumber, emergency plumber"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              disabled={addMutation.isPending}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              The service or product you want to rank for
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="e.g., London, Manchester"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={addMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              The town or city you want to target
            </p>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm font-medium mb-1">Preview:</p>
            <p className="text-sm text-muted-foreground">
              {keyword || '[keyword]'} in {location || '[location]'}
            </p>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={addMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              style={{ backgroundColor: '#006239' }}
              className="hover:opacity-90 text-white"
              disabled={addMutation.isPending}
            >
              {addMutation.isPending ? 'Creating...' : 'Create Combination'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
