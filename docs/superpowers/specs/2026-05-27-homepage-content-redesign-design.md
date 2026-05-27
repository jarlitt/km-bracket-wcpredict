# Homepage Content Redesign — Design Spec

**Date:** 2026-05-27
**Status:** Draft

## Overview

Replace the current minimal homepage with a content-rich, state-adaptive page that creates urgency, explains the prediction flow, and surfaces live data (leaderboard, upcoming matches, participation stats). The tone is confident and competitive — "Think you know football? Prove it."

## Audience

Kingmakers colleagues. They understand the predictor concept but need to learn this app's specific mechanics (groups → bracket → scoring) and feel compelled to participate.

## Design Decisions

- **Tone:** Confident, competitive, trash-talk energy.
- **Layout:** Stacked full-width sections (not a grid). Each content block gets breathing room.
- **No inline scoring rules.** The Rules page already covers this well; the homepage links to it but doesn't duplicate it.
- **Individual competition is the primary hook.** Office pools are secondary — surfaced in leaderboard tabs and participation banner, but not the headline.

## Page Structure

The homepage adapts based on two dimensions:
1. **User state:** anonymous → started predicting → submitted → (tournament live is orthogonal)
2. **Tournament state:** pre-kickoff vs. live

### Section 1: Hero

Always present. Content varies by user state.

**Anonymous / Not started:**
```
[kicker]  FIFA WORLD CUP 2026
[h1]      Think you know football? Prove it.
[tagline] 104 matches. One bracket. Zero excuses.
[countdown] 18d : 07h : 42m
[CTA]     Start Predicting | View Rules
```

**Started predicting (has predictions, not submitted):**
```
[kicker]  FIFA WORLD CUP 2026
[h1]      You've started. Now finish.
[tagline] Don't leave your bracket half-done.
[countdown] 18d : 07h : 42m
[progress] ██████░░░░░░░░░ 48/104 matches
[CTA]     Continue Predicting
```

**Submitted (pre-kickoff):**
```
[kicker]  FIFA WORLD CUP 2026
[h1]      You're in. Now we wait.
[tagline] Predictions locked and loaded. Edit anytime before kickoff.
[countdown] 18d : 07h : 42m
[CTA]     Edit Predictions | View Leaderboard
```

**Tournament live (any authenticated user):**
```
[kicker]  TOURNAMENT IN PROGRESS
[h1]      The game is on.
[tagline] Watch your predictions play out in real time.
[CTA]     Live Scores | View Leaderboard
```

#### Countdown Timer

- Reads lock time from `tournament_settings.lock_at` (falling back to `FIRST_MATCH_KICKOFF_UTC`).
- Client-side countdown that ticks every second: days, hours, minutes.
- Disappears once the tournament is live (lock time has passed). Replaced by the "TOURNAMENT IN PROGRESS" kicker.
- Uses the existing `getTournamentLockAt()` server function to fetch the lock timestamp.

### Section 2: Participation Banner

A compact, full-width bar below the hero. Shows total submissions + per-office breakdown.

```
[stat]  47 players submitted
[divider]
[pills] 🇫🇷 Paris 12 | 🇬🇧 London 9 | 🇩🇪 Berlin 8 | 🇪🇸 Madrid 7 | ...
```

**Data source:** Count rows from `submissions` table. Join with `profiles.country` and `pools` to get per-office counts.

**Visibility:** Always visible (all user states, pre-kickoff and live). During the tournament, it could optionally become a "X of Y players submitted" summary or be replaced/hidden — but for V1, keep it always visible.

### Section 3: Preview Cards (Conditional)

Three side-by-side cards showing visual thumbnails of the app's core experiences. Approach C card style with a visual area on top and a title + description below.

**Cards:**
1. **Group Predictions** — Mini match grid with flags and score input boxes. Description: "Predict the score of all 72 group-stage matches across 12 groups."
2. **Knockout Bracket** — Visual bracket tree. Description: "Your group scores auto-generate a unique bracket. Pick winners to the final."
3. **Live Leaderboard** — Mini ranking bars. Description: "Watch your score climb as real results come in. Climb the global ranking."

**Visibility:** Only shown when the user has NOT started predicting (anonymous or logged in with zero predictions). Disappears once they have any predictions in context.

These are **static visual illustrations**, not live data. They're purely to give new visitors a sense of what the app looks like before they commit.

### Section 4: Leaderboard Preview

A tabbed leaderboard embedded directly in the homepage.

**Tabs:** "Global" (default) + one tab per active office pool (from `pools` table where `is_active = true`). Tabs show the pool's flag emoji and name.

**Table content:**
- Top 10 players from the selected pool/global, showing: rank, display name, office flag, score.
- Pre-kickoff: all scores show "—" (dash), ranked by submission time (earliest first), matching the existing `aggregateLeaderboard()` behavior which sorts submitted-but-zero-score players by name.
- Tournament live: actual scores from `user_scores.total_score`.
- **"You" row:** Always shown at the bottom if the user is authenticated, even if not in the top 10. Shows their actual rank. Styling distinguishes it from regular rows.
  - If not submitted: "You (not submitted)"
  - If submitted, pre-kickoff: "You ✓ submitted"
  - Tournament live: "You ▲ 3" (rank change indicator if possible, otherwise just rank + score)

**Data source:** Reuses the existing `aggregateLeaderboard()` function and its data fetching pattern from the leaderboard page. The homepage version limits to top 10 + current user.

**Link:** "View full leaderboard →" link at the bottom goes to `/leaderboard`.

**Anonymous users:** Show top 5 players + a "Sign up to join" placeholder row instead of "You".

### Section 5: Upcoming / Today's Matches

Shows the next few matches in chronological order.

**Pre-kickoff:** Section titled "First Matches". Shows the first 4 matches from `GROUP_MATCHES` static data, formatted with date, time, team flags + names, and group label.

**Tournament live:** Section titled "Today's Matches". Sources from `actual_group_results` and `actual_knockout_results` to distinguish between:
- **Live matches** (currently in progress) — highlighted with red styling, showing current score and minute.
- **Upcoming today** — showing kickoff time.
- **Next day** — if fewer than 3 matches today.

**Note on live match data:** The app currently has an ESPN sync mechanism for results. Live match status (in-progress, minute) depends on the ESPN sync data model. For V1, if live status isn't available, show today's matches by date with "Today" / "Tomorrow" labels instead of live indicators. The live match highlighting can be added when the data supports it.

**Match time display:** Use the user's local timezone. The app already has a `useLocalKickoff` hook for this.

### Section 6: Closing CTA (Conditional)

Only shown pre-kickoff when the user hasn't submitted yet. A final push with competitive copy.

**Anonymous / Not started:**
```
[h2]      Still on the bench?
[tagline] Predictions lock at kickoff. Don't be that person.
[CTA]     Start Predicting
```

**Started predicting:**
```
[h2]      46% isn't gonna cut it.  (dynamic based on actual progress)
[tagline] Complete your predictions before kickoff.
[CTA]     Continue Predicting
```

**Submitted / Tournament live:** Section is hidden. No need for a closing push.

### Section 7: Footer

Unchanged from current: "World Cup 2026 Predictor — Built for the beautiful game"

## Component Architecture

### New Components

| Component | Location | Server/Client | Purpose |
|-----------|----------|---------------|---------|
| `CountdownTimer` | `src/components/home/countdown-timer.tsx` | Client | Ticking countdown to lock time |
| `ParticipationBanner` | `src/components/home/participation-banner.tsx` | Server | Submission count + per-office pills |
| `PreviewCards` | `src/components/home/preview-cards.tsx` | Client (static) | Three visual preview cards |
| `HomeLeaderboard` | `src/components/home/home-leaderboard.tsx` | Client | Tabbed leaderboard with top 10 + "You" |
| `UpcomingMatches` | `src/components/home/upcoming-matches.tsx` | Server | Next matches list |
| `ClosingCta` | `src/components/home/closing-cta.tsx` | Client | Conditional closing CTA |

### Modified Components

| Component | Change |
|-----------|--------|
| `HeroCta` (`dashboard-section.tsx`) | Refactor into new `HeroSection` that includes countdown + state-adaptive headline/tagline/CTA. The current `HeroCta` logic (auth state, prediction state, submitted state) is preserved but the UI is richer. |
| `page.tsx` (homepage) | Replace current static content with the new section layout. Will become partially server-rendered (participation data, match data, leaderboard data fetched server-side) with client islands for interactivity (countdown, leaderboard tabs). |

### Data Flow

The homepage `page.tsx` becomes an **async server component** that fetches:
1. Lock time from `tournament_settings` (via `getTournamentLockAt()`)
2. Submission counts (aggregated from `submissions` + `profiles` + `pools`)
3. Leaderboard data (via `aggregateLeaderboard()` pattern)
4. Current user (via `supabase.auth.getUser()`)
5. Tournament locked status (via `isTournamentLockedAsync()`)

These are passed as props to the section components. Client components (`CountdownTimer`, `HomeLeaderboard`, `PreviewCards`, `ClosingCta`) handle interactivity.

The `HeroSection` needs client-side access to `usePredictions()` context (for prediction count, submitted state) — same pattern as current `HeroCta`.

## Existing Code Reuse

- **Lock time:** `getTournamentLockAt()` from `src/lib/matches/lock-server.ts`
- **Lock check:** `isTournamentLockedAsync()` from `src/lib/matches/lock-server.ts`
- **Leaderboard aggregation:** `aggregateLeaderboard()` from `src/lib/leaderboard/aggregate.ts`
- **Match data:** `GROUP_MATCHES` from `src/lib/data/matches.ts`
- **Prediction state:** `usePredictions()` from `src/context/predictions-context.tsx`
- **Auth state:** `useAuth()` from `src/context/auth-context.tsx`
- **Pool flags:** `PoolFlag` from `src/components/pools/pool-flag.tsx`
- **Local kickoff times:** `useLocalKickoff` hook

## Visual Design

- Maintains the existing dark theme and `gradient-bg` background.
- Uses the existing design system: `glass-card` borders, indigo/emerald accent colors, `Card` components from shadcn/ui.
- Countdown timer: pill-shaped container with large tabular-nums digits.
- Participation banner: full-width subtle background (indigo-tinted), office pills as compact rounded badges.
- Preview cards: bordered cards with a visual area (subtle gradient background) above a text body.
- Leaderboard: follows existing table patterns from `/leaderboard` and `/pools/[slug]` pages but with tab switching.
- Match rows: compact horizontal layout with date, flags, team names, group badge.

## Scope Boundaries

**In scope:**
- All sections described above
- State-adaptive content (4 user states)
- Countdown timer (client-side ticking)
- Leaderboard with tab switching (Global + per-office)
- Participation banner with live submission counts
- Upcoming matches from static match data
- Responsive design (mobile + desktop)

**Out of scope (V1):**
- Live match minute/status indicators (depends on ESPN sync data model maturity)
- Rank change indicators ("▲ 3") — requires historical rank tracking not currently in the schema
- Animated transitions between states
- Real-time WebSocket updates for leaderboard/participation (standard page refresh is fine)
- Prizes section (TBD, can be added later as a simple text block)
