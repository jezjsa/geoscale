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
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Upload, Download, FileText } from 'lucide-react'
import { uploadCsvCombinations } from '@/api/combinations'

interface UploadCsvDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UploadCsvDialog({ projectId, open, onOpenChange }: UploadCsvDialogProps) {
  const queryClient = useQueryClient()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      return uploadCsvCombinations(projectId, file)
    },
    onSuccess: (data) => {
      toast.success('CSV uploaded successfully!', {
        description: `Created ${data.combinations_count} combinations from ${data.rows_processed} rows.`,
      })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectCombinations', projectId] })
      handleClose()
    },
    onError: (error: Error) => {
      toast.error('Error uploading CSV', {
        description: error.message,
      })
    },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        toast.error('Please select a CSV file')
        return
      }
      setSelectedFile(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        toast.error('Please select a CSV file')
        return
      }
      setSelectedFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      toast.error('Please select a CSV file')
      return
    }
    uploadMutation.mutate(selectedFile)
  }

  const handleClose = () => {
    setSelectedFile(null)
    setIsDragging(false)
    onOpenChange(false)
  }

  const downloadTemplate = () => {
    // Create CSV template with comprehensive examples
    const template = `location,keyword
Doncaster,web design
Doncaster,web design company
Doncaster,web design agency
Rotherham,web design
Rotherham,website design
Rotherham,web development
Barnsley,web design
Barnsley,web designers
Barnsley,website developers
Sheffield,web design
Sheffield,web design services
Sheffield,professional web design
Wakefield,web design
Wakefield,wordpress design
Wakefield,custom web design
Leeds,web design
Leeds,web design company
Leeds,website design agency`

    const blob = new Blob([template], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'geoscale-combinations-template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    
    toast.success('Template downloaded')
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Upload CSV Combinations</DialogTitle>
          <DialogDescription>
            Upload a CSV file with your specific location and keyword combinations. Download the template to see the required format.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 py-6">
            {/* Template Download */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-accent/50">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">CSV Template</p>
                  <p className="text-xs text-muted-foreground">
                    Download template with example format
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>

            {/* File Upload Area */}
            <div>
              <Label className="text-sm text-muted-foreground font-normal block mb-3">
                Upload CSV File
              </Label>
              
              <div
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center transition-colors
                  ${isDragging ? 'border-[#006239] bg-[#006239]/5' : 'border-border'}
                  ${selectedFile ? 'bg-accent/50' : ''}
                `}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                {selectedFile ? (
                  <div className="space-y-2">
                    <FileText className="h-8 w-8 mx-auto text-[#006239]" />
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium mb-1">
                        Drop your CSV file here, or click to browse
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Maximum file size: 5MB
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="csv-upload"
                      disabled={uploadMutation.isPending}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('csv-upload')?.click()}
                      disabled={uploadMutation.isPending}
                    >
                      Select File
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Format Info */}
            <div className="text-xs text-muted-foreground space-y-2 bg-accent/30 p-4 rounded-lg">
              <p className="font-medium">CSV Format:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>location</strong> - Town or city name</li>
                <li><strong>keyword</strong> - Service keyword</li>
              </ul>
              <p className="mt-2">Example: <code className="bg-background px-1 py-0.5 rounded">Doncaster,web design</code></p>
            </div>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={uploadMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              style={{ backgroundColor: '#006239' }}
              className="hover:opacity-90 text-white"
              disabled={!selectedFile || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Upload & Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

