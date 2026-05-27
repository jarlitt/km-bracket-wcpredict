'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button, buttonVariants } from '@/components/ui/button'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/auth-context'
import { usePredictions } from '@/context/predictions-context'
import { usePools } from '@/context/pool-context'
import { PoolMenuSections } from '@/components/pools/pool-menu-sections'
import { AuthModal } from '@/components/auth/auth-modal'
import { isNavLinkActive } from '@/lib/pools/path'
import type { AuthMode } from '@/components/auth/auth-flow'
import type { Pool } from '@/types'

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/rules', label: 'Rules' },
]

const LIVE_SCORE_HREF = '/matches'

const ADMIN_EMAILS = ['jorge.astiaso@kingmakers.com', 'jorge.arlitt+1@gmail.com']

export function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [poolsOpen, setPoolsOpen] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authReturnTo, setAuthReturnTo] = useState('/')
  const { user, logout } = useAuth()
  const { autofillDemo, autofillAllOneZero, autofillKnockoutDemo, resetPredictions, submitted } = usePredictions()
  const { availablePools, userPool } = usePools()

  const isAdmin = ADMIN_EMAILS.includes(user?.email ?? '') && !submitted
  const myPools = userPool ? [userPool] : []
  const morePools = availablePools.filter((pool) => pool.id !== userPool?.id)
  const summariesByPoolId = undefined

  useEffect(() => {
    if (!mobileOpen) return

    const originalBodyOverflow = document.body.style.overflow
    const originalRootOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalBodyOverflow
      document.documentElement.style.overflow = originalRootOverflow
    }
  }, [mobileOpen])

  const openAuth = (mode: AuthMode) => {
    const returnTo =
      typeof window === 'undefined'
        ? pathname
        : `${window.location.pathname}${window.location.search}`
    setAuthMode(mode)
    setAuthReturnTo(returnTo || '/')
    setAuthOpen(true)
  }

  return (
    <>
    {mobileOpen && (
      <div
        className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm md:hidden"
        aria-hidden="true"
        onClick={() => setMobileOpen(false)}
      />
    )}
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="text-base">WC2026</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const isActive = isNavLinkActive(link.href, pathname)
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
          <PoolsDropdown
            open={poolsOpen}
            onOpenChange={setPoolsOpen}
            myPools={myPools}
            morePools={morePools}
            summariesByPoolId={summariesByPoolId}
            active={isNavLinkActive('/pools', pathname)}
          />
          <LiveScoreLink
            active={isNavLinkActive(LIVE_SCORE_HREF, pathname)}
          />
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {isAdmin && (
            <DemoControlsDropdown
              open={demoOpen}
              onOpenChange={setDemoOpen}
              onAutofillGroups={autofillDemo}
              onAutofillAllOneZero={autofillAllOneZero}
              onAutofillKnockout={autofillKnockoutDemo}
              onReset={resetPredictions}
            />
          )}
          {user ? (
            <>
              <span className="text-sm text-muted-foreground">{user.displayName}</span>
              <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground gap-1.5">
                <LogOut className="size-3.5" />
                Log out
              </Button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => openAuth('login')}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'text-muted-foreground',
                )}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => openAuth('signup')}
                className={buttonVariants({ size: 'sm' })}
              >
                Sign up
              </button>
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
              const isActive = isNavLinkActive(link.href, pathname)
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
            <MobilePoolsSection
              myPools={myPools}
              morePools={morePools}
              summariesByPoolId={summariesByPoolId}
              onNavigate={() => setMobileOpen(false)}
            />
            <LiveScoreLink
              active={isNavLinkActive(LIVE_SCORE_HREF, pathname)}
              variant="mobile"
              onClick={() => setMobileOpen(false)}
            />


            {isAdmin && (
              <div className="mt-2 border-t border-border/40 pt-3">
                <p className="px-3 text-xs font-bold text-red-400 mb-2 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center">D</span>
                  Demo Controls
                </p>
                <DemoControlsList
                  onAutofillGroups={() => { autofillDemo(); setMobileOpen(false) }}
                  onAutofillAllOneZero={() => { autofillAllOneZero(); setMobileOpen(false) }}
                  onAutofillKnockout={() => { autofillKnockoutDemo(); setMobileOpen(false) }}
                  onReset={() => { resetPredictions(); setMobileOpen(false) }}
                />
              </div>
            )}

            {user ? (
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
            ) : (
              <div className="mt-2 border-t border-border/40 pt-3 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false)
                    openAuth('login')
                  }}
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'sm' }),
                    'justify-start text-muted-foreground w-full',
                  )}
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false)
                    openAuth('signup')
                  }}
                  className={cn(
                    buttonVariants({ size: 'sm' }),
                    'justify-start w-full',
                  )}
                >
                  Sign up
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
    {authOpen && (
      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        initialMode={authMode}
        returnTo={authReturnTo}
      />
    )}
    </>
  )
}

function DemoControlsDropdown({
  open,
  onOpenChange,
  onAutofillGroups,
  onAutofillAllOneZero,
  onAutofillKnockout,
  onReset,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAutofillGroups: () => void
  onAutofillAllOneZero: () => void
  onAutofillKnockout: () => void
  onReset: () => void
}) {
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (dropdownRef.current?.contains(target)) return
      onOpenChange(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onOpenChange])

  const closeAfter = (action: () => void) => {
    action()
    onOpenChange(false)
  }

  return (
    <div ref={dropdownRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onOpenChange(!open)}
        className="gap-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/15 hover:text-red-300"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex size-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white">
          D
        </span>
        Demo
        <ChevronDown
          className={cn('size-3.5 transition-transform', open && 'rotate-180')}
        />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border/50 bg-popover p-2 text-popover-foreground shadow-xl">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-red-400">
            Demo Controls
          </p>
          <DemoControlsList
            onAutofillGroups={() => closeAfter(onAutofillGroups)}
            onAutofillAllOneZero={() => closeAfter(onAutofillAllOneZero)}
            onAutofillKnockout={() => closeAfter(onAutofillKnockout)}
            onReset={() => closeAfter(onReset)}
          />
        </div>
      )}
    </div>
  )
}

function DemoControlsList({
  onAutofillGroups,
  onAutofillAllOneZero,
  onAutofillKnockout,
  onReset,
}: {
  onAutofillGroups: () => void
  onAutofillAllOneZero: () => void
  onAutofillKnockout: () => void
  onReset: () => void
}) {
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={onAutofillGroups}
        className="w-full justify-start text-muted-foreground"
      >
        Autofill Groups
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onAutofillAllOneZero}
        className="w-full justify-start text-muted-foreground"
      >
        Set all 1-0
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onAutofillKnockout}
        className="w-full justify-start text-muted-foreground"
      >
        Autofill Knockout
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        className="w-full justify-start text-red-400"
      >
        Reset All
      </Button>
    </>
  )
}

function PoolsDropdown({
  open,
  onOpenChange,
  myPools,
  morePools,
  summariesByPoolId,
  active,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  myPools: Pool[]
  morePools: Pool[]
  summariesByPoolId?: Map<
    string,
    {
      submitted: boolean
      groupPredictionCount: number
      knockoutPredictionCount: number
    }
  >
  active: boolean
}) {
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (dropdownRef.current?.contains(target)) return
      onOpenChange(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onOpenChange])

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'sm' }),
          'gap-1.5',
          active ? 'bg-muted text-foreground' : 'text-muted-foreground',
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        Pools
        <ChevronDown
          className={cn('size-3.5 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 rounded-xl border border-border/50 bg-popover p-2 text-popover-foreground shadow-xl">
          <PoolMenuSections
            myPools={myPools}
            morePools={morePools}
            summariesByPoolId={summariesByPoolId}
            onNavigate={() => onOpenChange(false)}
          />
          <div className="mt-2 border-t border-border/40 pt-2">
            <Link
              href="/pools"
              onClick={() => onOpenChange(false)}
              className="block rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              Manage all pools
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function MobilePoolsSection({
  myPools,
  morePools,
  summariesByPoolId,
  onNavigate,
}: {
  myPools: Pool[]
  morePools: Pool[]
  summariesByPoolId?: Map<
    string,
    {
      submitted: boolean
      groupPredictionCount: number
      knockoutPredictionCount: number
    }
  >
  onNavigate: () => void
}) {
  return (
    <div className="mt-1 rounded-lg border border-border/40 p-2">
      <Link
        href="/pools"
        onClick={onNavigate}
        className="mb-2 block rounded-md px-2 py-1 text-sm font-medium text-foreground hover:bg-muted/50"
      >
        Pools
      </Link>
      <PoolMenuSections
        myPools={myPools}
        morePools={morePools}
        summariesByPoolId={summariesByPoolId}
        onNavigate={onNavigate}
      />
    </div>
  )
}

function LiveScoreLink({
  active,
  variant = 'desktop',
  onClick,
}: {
  active: boolean
  variant?: 'desktop' | 'mobile'
  onClick?: () => void
}) {
  // Reddish standalone button with an always-on pulsing dot — same palette as
  // the "Live" badge on individual match rows so the visual language is
  // consistent across the app.
  return (
    <Link
      href={LIVE_SCORE_HREF}
      onClick={onClick}
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'sm' }),
        'gap-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/15 hover:text-red-300',
        active && 'bg-red-500/20 text-red-300',
        variant === 'desktop' ? 'ml-1' : 'justify-start w-full',
      )}
      aria-current={active ? 'page' : undefined}
    >
      <span
        className="inline-flex size-1.5 animate-pulse rounded-full bg-red-400"
        aria-hidden="true"
      />
      Live Scores
    </Link>
  )
}
