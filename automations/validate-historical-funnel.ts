#!/usr/bin/env npx tsx
/**
 * Validate historical funnel — cross-check realLeads.ts against CSV
 *
 * Compares lead-level aggregates per week with the historical CSV totals.
 * Run BEFORE back-fill to see gaps, and AFTER to confirm alignment.
 *
 * Usage:  npx tsx automations/validate-historical-funnel.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ─── Load CSV ───────────────────────────────────────────────────────────────

const csvPath = path.resolve(__dirname, '../docs/historical-weekly-funnel.csv')
const csvRaw = fs.readFileSync(csvPath, 'utf8').trim()
const [, ...csvRows] = csvRaw.split('\n')
const csvWeeks = csvRows.map(row => {
  const c = row.split(',')
  return {
    week_start: c[0],
    calls_booked: parseInt(c[2]) || 0,
    calls_showed: parseInt(c[3]) || 0,
    proposals_sent: parseInt(c[4]) || 0,
    deals_won: parseInt(c[5]) || 0,
    revenue_won: parseFloat(c[6]) || 0,
  }
})

// ─── Load Leads (regex parse to avoid TS import issues) ─────────────────────

const leadsPath = path.resolve(__dirname, '../src/lib/realLeads.ts')
const leadsContent = fs.readFileSync(leadsPath, 'utf8')

interface SimpleLead {
  id: string; name: string; stage: string
  booked_at?: string; call_datetime?: string
  booking_completed: boolean; proposal_sent: boolean
  proposal_value?: string; revenue?: string
}

const leads: SimpleLead[] = []
// Split by object boundaries
const blocks = leadsContent.split(/\n  \{/).slice(1) // skip import line
for (const block of blocks) {
  const get = (key: string) => block.match(new RegExp(`${key}:\\s*"([^"]*)"`))?.[1]
  const getBool = (key: string) => block.match(new RegExp(`${key}:\\s*(true|false)`))?.[1] === 'true'
  leads.push({
    id: get('id') || '',
    name: get('name') || '',
    stage: get('stage') || '',
    booked_at: get('booked_at'),
    call_datetime: get('call_datetime'),
    booking_completed: getBool('booking_completed'),
    proposal_sent: getBool('proposal_sent'),
    proposal_value: get('proposal_value'),
    revenue: get('revenue'),
  })
}

// ─── Aggregate by week ──────────────────────────────────────────────────────

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.getUTCDay()
  const diff = (day === 0 ? 6 : day - 1) // days since Monday
  d.setUTCDate(d.getUTCDate() - diff)
  return d.toISOString().slice(0, 10)
}

const showedStages = new Set(['showed', 'qualified', 'second_call_booked', 'proposal_sent', 'proposal_live', 'closed_won', 'closed_lost'])
const proposalStages = new Set(['proposal_sent', 'proposal_live', 'closed_won', 'closed_lost'])
const wonStages = new Set(['closed_won'])

console.log('\n╔══════════════════════════════════════════════════════════════════════════════════════╗')
console.log('║                     HISTORICAL FUNNEL VALIDATION                                    ║')
console.log('╚══════════════════════════════════════════════════════════════════════════════════════╝\n')

console.log('Week Start   │ Metric          │ CSV  │ Leads │ Delta │ Status')
console.log('─────────────┼─────────────────┼──────┼───────┼───────┼───────')

let totalMismatches = 0

for (const csvWeek of csvWeeks) {
  const weekEnd = new Date(csvWeek.week_start + 'T00:00:00Z')
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().slice(0, 10)

  // Leads booked this week (by booked_at)
  const weekLeads = leads.filter(l =>
    l.booked_at && l.booked_at.slice(0, 10) >= csvWeek.week_start && l.booked_at.slice(0, 10) < weekEndStr
  )

  // Leads whose call was this week (for showed/proposals/closes)
  const weekCallLeads = leads.filter(l =>
    l.call_datetime && l.call_datetime.slice(0, 10) >= csvWeek.week_start && l.call_datetime.slice(0, 10) < weekEndStr
  )

  const booked = weekLeads.filter(l => l.booking_completed).length
  const showed = weekCallLeads.filter(l => showedStages.has(l.stage)).length
  const proposals = weekCallLeads.filter(l => proposalStages.has(l.stage) || l.proposal_sent).length
  const won = weekCallLeads.filter(l => wonStages.has(l.stage)).length
  const revenue = weekCallLeads.filter(l => wonStages.has(l.stage)).reduce((s, l) => s + (parseFloat(l.revenue || '0') || 0), 0)

  const checks = [
    { metric: 'Calls booked', csv: csvWeek.calls_booked, actual: booked },
    { metric: 'Calls showed', csv: csvWeek.calls_showed, actual: showed },
    { metric: 'Proposals sent', csv: csvWeek.proposals_sent, actual: proposals },
    { metric: 'Deals won', csv: csvWeek.deals_won, actual: won },
  ]

  for (const check of checks) {
    const delta = check.actual - check.csv
    const status = delta === 0 ? '✓' : '✗ MISMATCH'
    if (delta !== 0) totalMismatches++
    console.log(
      `${csvWeek.week_start}  │ ${check.metric.padEnd(15)} │ ${String(check.csv).padStart(4)} │ ${String(check.actual).padStart(5)} │ ${(delta >= 0 ? '+' : '') + delta}`.padEnd(70) + `│ ${status}`
    )
  }

  // Revenue check
  if (csvWeek.revenue_won > 0 || revenue > 0) {
    const revDelta = revenue - csvWeek.revenue_won
    const status = Math.abs(revDelta) < 1 ? '✓' : '✗ MISMATCH'
    if (Math.abs(revDelta) >= 1) totalMismatches++
    console.log(
      `${csvWeek.week_start}  │ ${'Revenue (£)'.padEnd(15)} │ ${String(csvWeek.revenue_won).padStart(4)} │ ${String(revenue).padStart(5)} │ ${(revDelta >= 0 ? '+' : '') + revDelta}`.padEnd(70) + `│ ${status}`
    )
  }
  console.log('─────────────┼─────────────────┼──────┼───────┼───────┼───────')
}

console.log(`\nTotal mismatches: ${totalMismatches}`)
if (totalMismatches === 0) {
  console.log('✓ All lead-level aggregates match CSV totals. Historical reporting is accurate.\n')
} else {
  console.log('✗ Gaps remain — run backfill-helper.ts to tag the missing leads.\n')
}
