'use client'

import { useState } from 'react'
import { CircleHelp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type TieBreakerRulesType = 'group' | 'third-place'

interface TieBreakerRulesHelpProps {
  type: TieBreakerRulesType
  variant?: 'default' | 'standalone'
}

const RULES: Record<TieBreakerRulesType, { title: string; description: string; rules: string[]; note: string; bracketNote?: string }> = {
  group: {
    title: 'Group tie-breaker rules',
    description: 'For teams tied on points in the same group, FIFA applies these criteria in order:',
    rules: [
      'Points obtained in matches between the tied teams',
      'Goal difference in matches between the tied teams',
      'Goals scored in matches between the tied teams',
      'Goal difference in all group matches',
      'Goals scored in all group matches',
      'Team conduct score',
      'FIFA world ranking',
    ],
    note: 'Your predictions only include scores, so conduct score cannot be predicted. When score-based criteria still leave a tie, you choose the order manually.',
  },
  'third-place': {
    title: 'Best third-place rules',
    description: 'For ranking third-place teams across groups, FIFA applies these criteria in order:',
    rules: [
      'Points in all group matches',
      'Goal difference in all group matches',
      'Goals scored in all group matches',
      'Team conduct score',
      'FIFA world ranking',
    ],
    note: 'Your predictions only include scores, so conduct score cannot be predicted. When score-based criteria still leave a tie, use the arrows to choose the order.',
    bracketNote: 'The third-place table only decides which teams qualify. It does not rank them into knockout fixtures. Once the eight best third-place teams are known, their Round of 32 slots are assigned by FIFA\'s fixed bracket rules based on the groups they came from.',
  },
}

export function TieBreakerRulesHelp({ type, variant = 'default' }: TieBreakerRulesHelpProps) {
  const [open, setOpen] = useState(false)
  const copy = RULES[type]

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className={variant === 'standalone'
          ? 'inline-flex align-middle rounded-full text-muted-foreground hover:bg-muted hover:text-foreground'
          : 'rounded-full text-blue-100 hover:bg-blue-500/20 hover:text-blue-50'}
        onClick={() => setOpen(true)}
        aria-label={`Show ${copy.title.toLowerCase()}`}
      >
        <CircleHelp />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {copy.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
          <p className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-100">
            {copy.note}
          </p>
          {copy.bracketNote && (
            <p className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs text-muted-foreground">
              {copy.bracketNote}
            </p>
          )}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </>
  )
}
