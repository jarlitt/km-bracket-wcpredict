'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { getTeamById } from '@/lib/data/teams'
import { useLocalKickoff } from '@/lib/format-kickoff'
import type { KnockoutMatch } from '@/types'

interface BracketViewProps {
  matches: KnockoutMatch[]
  predictions: Record<string, number>
  onPickWinner: (matchId: string, winnerId: number) => void
  disabled?: boolean
  highlightMissing?: Set<string>
}

function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    setMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return mobile
}

function TeamSlot({
  teamId,
  isWinner,
  onClick,
  disabled,
  placeholder,
  seed,
}: {
  teamId: number | null
  isWinner: boolean
  onClick?: () => void
  disabled?: boolean
  placeholder?: string
  seed?: string
}) {
  const team = teamId ? getTeamById(teamId) : null

  return (
    <button
      onClick={onClick}
      disabled={disabled || !team}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-all w-full text-left',
        team && !disabled && 'hover:bg-accent cursor-pointer',
        isWinner && 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30',
        !isWinner && team && 'bg-card/60',
        !team && 'bg-muted/20 text-muted-foreground/50 cursor-default',
      )}
    >
      {team ? (
        <>
          <span className="text-sm">{team.flag}</span>
          <span className="truncate">{team.code}</span>
          {seed && <span className="text-[9px] text-muted-foreground/60 ml-auto shrink-0">{seed}</span>}
        </>
      ) : (
        <span className="text-[10px] truncate">{placeholder || 'TBD'}</span>
      )}
    </button>
  )
}

function MatchCard({
  match,
  winnerId,
  onPickWinner,
  disabled,
  wide,
  highlight,
}: {
  match: KnockoutMatch
  winnerId: number | null
  onPickWinner: (matchId: string, winnerId: number) => void
  disabled?: boolean
  wide?: boolean
  highlight?: boolean
}) {
  const [seedA, seedB] = (match.label ?? '').split(' vs ')
  const kickoff = useLocalKickoff(match.date, match.time)

  return (
    <div className={wide ? 'w-44 shrink-0' : 'w-34 sm:w-40 shrink-0'}>
      {kickoff && (
        <div className="flex items-baseline gap-1.5 mb-0.5">
          <span className="text-[9px] text-muted-foreground/70">{kickoff.date}</span>
          <span className="text-[9px] font-medium text-muted-foreground">{kickoff.time}</span>
        </div>
      )}
      <div className={cn(
        'rounded-lg border bg-card/40 overflow-hidden transition-colors',
        highlight
          ? 'border-red-500 ring-1 ring-red-500/40'
          : 'border-border/40',
      )}>
        <TeamSlot
          teamId={match.teamAId}
          isWinner={winnerId === match.teamAId && match.teamAId !== null}
          onClick={() => match.teamAId && onPickWinner(match.id, match.teamAId)}
          disabled={disabled}
          placeholder={seedA}
          seed={match.teamAId ? seedA : undefined}
        />
        <div className="h-px bg-border/30" />
        <TeamSlot
          teamId={match.teamBId}
          isWinner={winnerId === match.teamBId && match.teamBId !== null}
          onClick={() => match.teamBId && onPickWinner(match.id, match.teamBId)}
          disabled={disabled}
          placeholder={seedB}
          seed={match.teamBId ? seedB : undefined}
        />
      </div>
      {match.matchNumber && (
        <p className="text-[8px] text-muted-foreground/40 mt-0.5 font-mono">M{match.matchNumber}</p>
      )}
    </div>
  )
}

// Accounts for date line + card body + match number
const MATCH_H = 5.5
const BASE_GAP = 0.75
const UNIT = MATCH_H + BASE_GAP

function getRoundLayout(level: number) {
  if (level === 0) return { paddingTop: 0, gap: BASE_GAP }
  const mult = Math.pow(2, level)
  return {
    paddingTop: UNIT * (mult - 1) / 2,
    gap: UNIT * mult - MATCH_H,
  }
}

function RoundColumn({
  matches,
  level,
  predictions,
  onPickWinner,
  disabled,
  colIndex,
  highlightMissing,
  header,
}: {
  matches: KnockoutMatch[]
  level: number
  predictions: Record<string, number>
  onPickWinner: (matchId: string, winnerId: number) => void
  disabled?: boolean
  colIndex: number
  highlightMissing?: Set<string>
  header?: string
}) {
  const layout = getRoundLayout(level)

  return (
    <div className="shrink-0" data-col={colIndex}>
      {header && (
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-center text-muted-foreground/60 mb-2">
          {header}
        </p>
      )}
      <div
        className="flex flex-col"
        style={{
          paddingTop: `${layout.paddingTop}rem`,
          gap: `${layout.gap}rem`,
        }}
      >
        {matches.map(match => (
          <MatchCard
            key={match.id}
            match={match}
            winnerId={predictions[match.id] ?? null}
            onPickWinner={onPickWinner}
            disabled={disabled}
            highlight={highlightMissing?.has(match.id)}
          />
        ))}
      </div>
    </div>
  )
}

function MobileRoundColumn({
  matches,
  level,
  predictions,
  onPickWinner,
  disabled,
  colIndex,
  highlightMissing,
}: {
  matches: KnockoutMatch[]
  level: number
  predictions: Record<string, number>
  onPickWinner: (matchId: string, winnerId: number) => void
  disabled?: boolean
  colIndex: number
  highlightMissing?: Set<string>
}) {
  const layout = getRoundLayout(level)

  return (
    <div className="shrink-0" data-col={colIndex}>
      <div
        className="flex flex-col"
        style={{
          paddingTop: `${layout.paddingTop}rem`,
          gap: `${layout.gap}rem`,
        }}
      >
        {matches.map(match => (
          <MatchCard
            key={match.id}
            match={match}
            winnerId={predictions[match.id] ?? null}
            onPickWinner={onPickWinner}
            disabled={disabled}
            wide
            highlight={highlightMissing?.has(match.id)}
          />
        ))}
      </div>
    </div>
  )
}

const MOBILE_TABS = [
  { label: 'R32', short: 'R32' },
  { label: 'R16', short: 'R16' },
  { label: 'QF', short: 'QF' },
  { label: 'SF', short: 'SF' },
  { label: 'Final', short: 'Final' },
]

export function BracketView({ matches, predictions, onPickWinner, disabled, highlightMissing }: BracketViewProps) {
  const isMobile = useIsMobile()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState(0)

  const leftR32 = matches.filter(m => m.round === 'R32' && m.position <= 8).sort((a, b) => a.position - b.position)
  const rightR32 = matches.filter(m => m.round === 'R32' && m.position > 8).sort((a, b) => a.position - b.position)
  const leftR16 = matches.filter(m => m.round === 'R16' && m.position <= 4).sort((a, b) => a.position - b.position)
  const rightR16 = matches.filter(m => m.round === 'R16' && m.position > 4).sort((a, b) => a.position - b.position)
  const leftQF = matches.filter(m => m.round === 'QF' && m.position <= 2).sort((a, b) => a.position - b.position)
  const rightQF = matches.filter(m => m.round === 'QF' && m.position > 2).sort((a, b) => a.position - b.position)
  const leftSF = matches.filter(m => m.round === 'SF' && m.position === 1)
  const rightSF = matches.filter(m => m.round === 'SF' && m.position === 2)
  const finalMatch = matches.find(m => m.round === 'F')
  const thirdPlaceMatch = matches.find(m => m.round === '3RD')

  const allR32 = matches.filter(m => m.round === 'R32').sort((a, b) => a.position - b.position)
  const allR16 = matches.filter(m => m.round === 'R16').sort((a, b) => a.position - b.position)
  const allQF = matches.filter(m => m.round === 'QF').sort((a, b) => a.position - b.position)
  const allSF = matches.filter(m => m.round === 'SF').sort((a, b) => a.position - b.position)

  const sfLayout = getRoundLayout(3)

  const scrollToColumn = useCallback((index: number) => {
    const container = scrollRef.current
    if (!container) return
    const col = container.querySelector(`[data-col="${index}"]`) as HTMLElement | null
    if (!col) return

    // Horizontal: scroll the container so the column is at the left edge with some padding
    const colLeft = col.offsetLeft
    container.scrollTo({ left: Math.max(0, colLeft - 16), behavior: 'smooth' })

    // Vertical: scroll page to the first match card, offset by sticky elements height
    // Navbar (56px) + stepper (~85px) + tab bar (~40px) + buffer
    const stickyOffset = 200
    const firstCard = col.querySelector('[class*="w-"]') as HTMLElement | null
    if (firstCard) {
      const cardTop = firstCard.getBoundingClientRect().top + window.scrollY
      window.scrollTo({ top: cardTop - stickyOffset, behavior: 'smooth' })
    }
  }, [])

  // Track active mobile tab based on scroll position
  useEffect(() => {
    if (!isMobile) return
    const container = scrollRef.current
    if (!container) return

    const onScroll = () => {
      const rect = container.getBoundingClientRect()
      const center = rect.left + rect.width / 2
      let closest = 0
      let minDist = Infinity
      for (let i = 0; i < 5; i++) {
        const col = container.querySelector(`[data-col="${i}"]`) as HTMLElement | null
        if (!col) continue
        const colRect = col.getBoundingClientRect()
        const dist = Math.abs(colRect.left + colRect.width / 2 - center)
        if (dist < minDist) { minDist = dist; closest = i }
      }
      setActiveTab(closest)
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => container.removeEventListener('scroll', onScroll)
  }, [isMobile])

  const sharedProps = { predictions, onPickWinner, disabled, highlightMissing }

  if (isMobile) {
    return (
      <div>
        {/* Mobile tab bar */}
        <div className="sticky top-[7.25rem] z-30 bg-background/90 backdrop-blur-sm border-b border-border/30 -mx-4 px-4 py-2 mb-3">
          <div className="flex gap-1 justify-center">
            {MOBILE_TABS.map((tab, i) => (
              <button
                key={i}
                onClick={() => scrollToColumn(i)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors shrink-0',
                  activeTab === i
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                )}
              >
                {tab.short}
              </button>
            ))}
          </div>
        </div>

        <div ref={scrollRef} className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max items-start">
            <MobileRoundColumn matches={allR32} level={0} colIndex={0} {...sharedProps} />
            <MobileRoundColumn matches={allR16} level={1} colIndex={1} {...sharedProps} />
            <MobileRoundColumn matches={allQF} level={2} colIndex={2} {...sharedProps} />
            <MobileRoundColumn matches={allSF} level={3} colIndex={3} {...sharedProps} />
            <div data-col="4" className="shrink-0">
              <div style={{ paddingTop: `${getRoundLayout(4).paddingTop}rem` }}>
                {finalMatch && (
                  <MatchCard match={finalMatch} winnerId={predictions[finalMatch.id] ?? null} onPickWinner={onPickWinner} disabled={disabled} wide highlight={highlightMissing?.has(finalMatch.id)} />
                )}
                {thirdPlaceMatch && (
                  <div className="mt-4 pt-3 border-t border-border/20">
                    <p className="text-[9px] text-muted-foreground/60 mb-1">3rd Place</p>
                    <MatchCard match={thirdPlaceMatch} winnerId={predictions[thirdPlaceMatch.id] ?? null} onPickWinner={onPickWinner} disabled={disabled} wide highlight={highlightMissing?.has(thirdPlaceMatch.id)} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Desktop: two-sided bracket with inline column headers
  return (
    <div ref={scrollRef} className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max items-start">
        <RoundColumn matches={leftR32} level={0} colIndex={0} header="Round of 32" {...sharedProps} />
        <RoundColumn matches={leftR16} level={1} colIndex={1} header="Round of 16" {...sharedProps} />
        <RoundColumn matches={leftQF} level={2} colIndex={2} header="Quarter-final" {...sharedProps} />
        <RoundColumn matches={leftSF} level={3} colIndex={3} header="Semi-final" {...sharedProps} />

        <div className="shrink-0" data-col="4">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-center text-muted-foreground/60 mb-2 w-34 sm:w-40">Final</p>
          <div
            style={{ paddingTop: `${sfLayout.paddingTop}rem` }}
            className="flex flex-col items-center"
          >
            {finalMatch && (
              <MatchCard
                match={finalMatch}
                winnerId={predictions[finalMatch.id] ?? null}
                onPickWinner={onPickWinner}
                disabled={disabled}
                highlight={highlightMissing?.has(finalMatch.id)}
              />
            )}
            {thirdPlaceMatch && (
              <div className="mt-6 pt-4 border-t border-border/20">
                <p className="text-[9px] text-muted-foreground/60 mb-1 text-center">3rd Place</p>
                <MatchCard
                  match={thirdPlaceMatch}
                  winnerId={predictions[thirdPlaceMatch.id] ?? null}
                  onPickWinner={onPickWinner}
                  disabled={disabled}
                  highlight={highlightMissing?.has(thirdPlaceMatch.id)}
                />
              </div>
            )}
          </div>
        </div>

        <RoundColumn matches={rightSF} level={3} colIndex={5} header="Semi-final" {...sharedProps} />
        <RoundColumn matches={rightQF} level={2} colIndex={6} header="Quarter-final" {...sharedProps} />
        <RoundColumn matches={rightR16} level={1} colIndex={7} header="Round of 16" {...sharedProps} />
        <RoundColumn matches={rightR32} level={0} colIndex={8} header="Round of 32" {...sharedProps} />
      </div>
    </div>
  )
}
