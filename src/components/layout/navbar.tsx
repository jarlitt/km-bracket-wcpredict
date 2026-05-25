'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button, buttonVariants } from '@/components/ui/button'
import { useState } from 'react'
import { Menu, X, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/auth-context'
import { usePredictions } from '@/context/predictions-context'

const NAV_LINKS = [
  { href: '/predict/groups', label: 'Predict' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/rules', label: 'Rules' },
]

const ADMIN_EMAILS = ['jorge.astiaso@kingmakers.com', 'jorge.arlitt+1@gmail.com']

export function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuth()
  const { autofillDemo, autofillAllOneZero, autofillKnockoutDemo, resetPredictions, submitted } = usePredictions()

  const isAdmin = ADMIN_EMAILS.includes(user?.email ?? '') && !submitted

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

        <div className="flex items-center gap-1 md:hidden">
          {isAdmin && (
            <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">D</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
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

            {isAdmin && (
              <div className="mt-2 border-t border-border/40 pt-3">
                <p className="px-3 text-xs font-bold text-red-400 mb-2 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center">D</span>
                  Demo Controls
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { autofillDemo(); setMobileOpen(false) }}
                  className="justify-start text-muted-foreground w-full"
                >
                  Autofill Groups
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { autofillAllOneZero(); setMobileOpen(false) }}
                  className="justify-start text-muted-foreground w-full"
                >
                  Set all 1-0
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { autofillKnockoutDemo(); setMobileOpen(false) }}
                  className="justify-start text-muted-foreground w-full"
                >
                  Autofill Knockout
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { resetPredictions(); setMobileOpen(false) }}
                  className="justify-start text-red-400 w-full"
                >
                  Reset All
                </Button>
              </div>
            )}

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
