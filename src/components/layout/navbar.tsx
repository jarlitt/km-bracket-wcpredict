'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button, buttonVariants } from '@/components/ui/button'
import { useState } from 'react'
import { Menu, X, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/auth-context'

const NAV_LINKS = [
  { href: '/predict/groups', label: 'Predict' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/rules', label: 'Rules' },
]

export function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuth()

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="text-lg">⚽</span>
          <span className="text-base">WC2026</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const isActive = pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  isActive ? 'bg-muted text-foreground' : 'text-muted-foreground'
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {user && (
            <>
              <span className="text-sm text-muted-foreground">{user.displayName}</span>
              <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground gap-1.5">
                <LogOut className="size-3.5" />
                Log out
              </Button>
            </>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {mobileOpen && (
        <div className="border-t border-border/40 bg-background/95 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1 px-4 py-3">
            {NAV_LINKS.map((link) => {
              const isActive = pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'sm' }),
                    'justify-start',
                    isActive ? 'bg-muted text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {link.label}
                </Link>
              )
            })}
            {user && (
              <div className="mt-2 border-t border-border/40 pt-3">
                <p className="px-3 text-sm text-muted-foreground mb-2">{user.displayName}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { logout(); setMobileOpen(false) }}
                  className="justify-start text-muted-foreground gap-1.5 w-full"
                >
                  <LogOut className="size-3.5" />
                  Log out
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
