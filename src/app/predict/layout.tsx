'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { usePredictions } from '@/context/predictions-context'

const STEPS = [
  { href: '/predict/groups', label: 'Group Matches', step: 1 },
  { href: '/predict/standings', label: 'Standings', step: 2 },
  { href: '/predict/bracket', label: 'Bracket', step: 3 },
  { href: '/predict/review', label: 'Review', step: 4 },
]

export default function PredictLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { totalGroupPredictions } = usePredictions()
  const groupProgress = Math.round((totalGroupPredictions / 72) * 100)

  const currentStepIndex = STEPS.findIndex(s => pathname.startsWith(s.href))

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-1 sm:gap-2">
            {STEPS.map((step, i) => {
              const isActive = pathname.startsWith(step.href)
              const isCompleted = i < currentStepIndex
              return (
                <div key={step.href} className="flex items-center gap-1 sm:gap-2 flex-1">
                  <Link
                    href={step.href}
                    className={cn(
                      'flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap',
                      isActive && 'bg-primary text-primary-foreground',
                      isCompleted && 'text-primary',
                      !isActive && !isCompleted && 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span className={cn(
                      'flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full text-[10px] sm:text-xs font-bold shrink-0',
                      isActive && 'bg-primary-foreground text-primary',
                      isCompleted && 'bg-primary text-primary-foreground',
                      !isActive && !isCompleted && 'bg-muted text-muted-foreground'
                    )}>
                      {isCompleted ? '✓' : step.step}
                    </span>
                    <span className="hidden sm:inline">{step.label}</span>
                  </Link>
                  {i < STEPS.length - 1 && (
                    <div className={cn(
                      'flex-1 h-px',
                      i < currentStepIndex ? 'bg-primary' : 'bg-border'
                    )} />
                  )}
                </div>
              )
            })}
          </div>
          {pathname.startsWith('/predict/groups') && (
            <div className="mt-2 flex items-center gap-3">
              <Progress value={groupProgress} className="flex-1 h-2" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {totalGroupPredictions}/72 matches
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </div>
    </div>
  )
}
