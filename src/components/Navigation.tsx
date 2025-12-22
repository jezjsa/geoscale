import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ThemeSwitcher } from './ThemeSwitcher'
import { Settings, LogOut, User, Menu } from 'lucide-react'

export function Navigation() {
  const { user, signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const getInitials = (name: string | null) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('[Navigation] handleSignOut called')
    await signOut()
  }

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 fixed top-0 left-0 right-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2">
            <img src="/icon.svg" alt="GeoScale" className="h-9 w-9" />
            <span className="text-xl font-bold">GeoScale</span>
          </Link>

          {/* Desktop navigation links - only show when not logged in */}
          {!user && (
            <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 items-center gap-6">
              <Link to="/" className="text-sm font-medium hover:text-[var(--brand-dark)] transition-colors">
                Home
              </Link>
              <Link to="/agency" className="text-sm font-medium hover:text-[var(--brand-dark)] transition-colors">
                Agency Benefits
              </Link>
              <Link to="/plans" className="text-sm font-medium hover:text-[var(--brand-dark)] transition-colors">
                Plans
              </Link>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Mobile menu - only show when not logged in */}
            {!user && (
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                  <nav className="flex flex-col gap-4 mt-8">
                    <Link
                      to="/"
                      className="text-lg font-medium hover:text-[var(--brand-dark)] transition-colors py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Home
                    </Link>
                    <Link
                      to="/agency"
                      className="text-lg font-medium hover:text-[var(--brand-dark)] transition-colors py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Agency Benefits
                    </Link>
                    <Link
                      to="/plans"
                      className="text-lg font-medium hover:text-[var(--brand-dark)] transition-colors py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Plans
                    </Link>
                    <div className="pt-4 border-t">
                      <Button
                        asChild
                        size="lg"
                        style={{ backgroundColor: 'var(--brand-dark)' }}
                        className="w-full hover:opacity-90 text-white"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Link to="/plans">Sign Up</Link>
                      </Button>
                    </div>
                  </nav>
                </SheetContent>
              </Sheet>
            )}

            <ThemeSwitcher />

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="bg-gray-300 dark:bg-[#242424]">
                      <AvatarFallback className="bg-gray-300 dark:bg-[#242424] text-gray-700 dark:text-gray-200">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.name || 'User'}</p>
                      {user.email && (
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/account" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      {user.plan === 'individual' ? 'Company Settings' : 'Settings'}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                asChild
                size="sm"
                style={{ backgroundColor: 'var(--brand-dark)' }}
                className="hidden md:inline-flex hover:opacity-90 text-white md:text-base md:px-4 md:py-2"
              >
                <Link to="/plans">Sign Up</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
