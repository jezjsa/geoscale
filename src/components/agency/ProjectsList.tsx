import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAgencyProjects } from '@/api/projects'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ExternalLink, Search, Eye } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { usePlanLimits } from '@/hooks/usePlanLimits'

interface ProjectsListProps {
  userId: string
}

export function ProjectsList({ userId }: ProjectsListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const { plan } = usePlanLimits()

  const { data: projects, isLoading } = useQuery({
    queryKey: ['agencyProjects', userId],
    queryFn: () => getAgencyProjects(userId),
  })
  
  // Get per-project combination limit
  const combinationLimit = plan?.combinationsPerWebsite || 400

  const filteredProjects = useMemo(() => {
    if (!projects) return []
    if (!searchTerm) return projects

    const search = searchTerm.toLowerCase()
    return projects.filter(
      (project) =>
        project.company_name?.toLowerCase().includes(search) ||
        project.project_name?.toLowerCase().includes(search) ||
        project.contact_name?.toLowerCase().includes(search) ||
        project.contact_email?.toLowerCase().includes(search) ||
        project.wp_url?.toLowerCase().includes(search)
    )
  }, [projects, searchTerm])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-sm text-muted-foreground">Loading projects...</p>
        </CardContent>
      </Card>
    )
  }

  if (!projects || projects.length === 0) {
    return null
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search projects by company name, contact, or URL..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>WordPress URL</TableHead>
                <TableHead className="text-center">Combinations</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Created</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No projects found matching "{searchTerm}"
                  </TableCell>
                </TableRow>
              ) : (
                filteredProjects.map((project) => (
                  <TableRow key={project.id} className="hover:bg-accent/50">
                    <TableCell className="font-medium">
                      <Link 
                        to={`/projects/${project.id}?view=combinations`}
                        className="text-link hover:text-link-hover hover:underline transition-colors"
                      >
                        {project.company_name || project.project_name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        {project.contact_name && (
                          <p className="text-sm">{project.contact_name}</p>
                        )}
                        {project.contact_email && (
                          <p className="text-xs text-muted-foreground">{project.contact_email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {project.wp_url && (
                        <a
                          href={project.wp_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-link hover:text-link-hover hover:underline inline-flex items-center gap-1 text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {project.wp_url.replace('https://', '')}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-medium ${
                        (project.combination_count || 0) >= combinationLimit 
                          ? 'text-red-600' 
                          : (project.combination_count || 0) >= combinationLimit * 0.8 
                          ? 'text-orange-600' 
                          : ''
                      }`}>
                        {project.combination_count || 0} / {combinationLimit}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${project.project_status === 'active' 
                          ? 'bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600' 
                          : ''}`}
                      >
                        {project.project_status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {new Date(project.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="h-8 w-8"
                      >
                        <Link to={`/projects/${project.id}?view=combinations`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

