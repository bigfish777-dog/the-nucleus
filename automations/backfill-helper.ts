#!/usr/bin/env npx tsx
/**
 * Back-fill Helper — Interactive CLI for tagging historical leads
 *
 * Walks through the historical-weekly-funnel.csv week-by-week, showing
 * candidate "showed" leads and prompting you to tag them with their
 * actual outcomes (proposal_sent, closed_won, closed_lost, etc.).
 *
 * Usage:   npx tsx automations/backfill-helper.ts
 * Output:  automations/backfill-output.json     (structured lead updates)
 *          automations/backfill-historical-leads.sql  (Supabase SQL)
 */

import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ─── Load CSV ───────────────────────────────────────────────────────────────

interface WeekRow {
  week_start: string
  ad_spend: number
  calls_booked: number
  calls_showed: number
  proposals_sent: number
  deals_won: number
  revenue_won: number
  notes: string
}

function loadCSV(): WeekRow[] {
  const csvPath = path.resolve(__dirname, '../docs/historical-weekly-funnel.csv')
  const raw = fs.readFileSync(csvPath, 'utf8').trim()
  const [header, ...rows] = raw.split('\n')
  return rows.map(row => {
    const cols = row.split(',')
    return {
      week_start: cols[0],
      ad_spend: parseFloat(cols[1]) || 0,
      calls_booked: parseInt(cols[2]) || 0,
      calls_showed: parseInt(cols[3]) || 0,
      proposals_sent: parseInt(cols[4]) || 0,
      deals_won: parseInt(cols[5]) || 0,
      revenue_won: parseFloat(cols[6]) || 0,
      notes: cols.slice(7).join(',').trim(),
    }
  })
}

// ─── Load Leads ─────────────────────────────────────────────────────────────

interface LeadRecord {
  id: string
  name: string
  email: string
  stage: string
  call_datetime?: string
  booked_at?: string
  utm_content?: string
  industry?: string
  revenue_range?: string
}

function loadLeads(): LeadRecord[] {
  // Dynamic import of the real leads data
  const leadsPath = path.resolve(__dirname, '../src/lib/realLeads.ts')
  const content = fs.readFileSync(leadsPath, 'utf8')

  // Extract lead objects using a simple regex approach
  const leads: LeadRecord[] = []
  const leadRegex = /\{[^}]*?id:\s*"([^"]*)"[^}]*?name:\s*"([^"]*)"[^}]*?email:\s*"([^"]*)"[^}]*?stage:\s*"([^"]*)"[^}]*?\}/gs

  for (const match of content.matchAll(leadRegex)) {
    const block = match[0]
    const id = match[1]
    const name = match[2]
    const email = match[3]
    const stage = match[4]

    const callMatch = block.match(/call_datetime:\s*"([^"]*)"/)
    const bookedMatch = block.match(/booked_at:\s*"([^"]*)"/)
    const utmMatch = block.match(/utm_content:\s*"([^"]*)"/)
    const industryMatch = block.match(/industry:\s*"([^"]*)"/)
    const revenueMatch = block.match(/revenue_range:\s*"([^"]*)"/)

    leads.push({
      id,
      name,
      email,
      stage,
      call_datetime: callMatch?.[1],
      booked_at: bookedMatch?.[1],
      utm_content: utmMatch?.[1],
      industry: industryMatch?.[1],
      revenue_range: revenueMatch?.[1],
    })
  }

  return leads
}

// ─── Interactive CLI ────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function ask(question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve))
}

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00Z')
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

function isInWeek(dateStr: string | undefined, weekStart: string, weekEnd: string): boolean {
  if (!dateStr) return false
  const d = dateStr.slice(0, 10)
  return d >= weekStart && d < weekEnd
}

interface BackfillUpdate {
  id: string
  name: string
  stage: string
  proposal_sent: boolean
  proposal_sent_at?: string
  proposal_value?: number
  revenue?: number
  close_reason?: string
}

async function main() {
  const csv = loadCSV()
  const leads = loadLeads()
  const updates: BackfillUpdate[] = []

  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║         THE NUCLEUS — Historical Lead Back-fill Helper      ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')
  console.log('For each week, I\'ll show you the CSV totals and the candidate')
  console.log('"showed" leads. Tag each lead with its actual outcome.\n')
  console.log('Stage options:')
  console.log('  [s] skip (leave as showed)')
  console.log('  [q] qualified (attended, proposal being built)')
  console.log('  [p] proposal_sent')
  console.log('  [w] closed_won')
  console.log('  [l] closed_lost')
  console.log('  [d] disqualified')
  console.log('  [a] abandoned\n')

  let totalTagged = 0

  for (const week of csv) {
    const weekEnd = getWeekEnd(week.week_start)

    // Find showed leads whose call was in this week
    const candidates = leads.filter(l =>
      l.stage === 'showed' &&
      isInWeek(l.call_datetime, week.week_start, weekEnd)
    )

    if (candidates.length === 0) continue
    if (week.proposals_sent === 0 && week.deals_won === 0) {
      console.log(`\n── Week of ${week.week_start} ──  (${candidates.length} showed, 0 proposals, 0 closes — skipping)\n`)
      continue
    }

    console.log(`\n${'═'.repeat(64)}`)
    console.log(`  WEEK OF ${week.week_start}`)
    console.log(`${'═'.repeat(64)}`)
    console.log(`  CSV totals: ${week.calls_booked} booked | ${week.calls_showed} showed | ${week.proposals_sent} proposals | ${week.deals_won} won | £${week.revenue_won || 0}`)
    console.log(`  Candidates: ${candidates.length} "showed" leads with calls this week`)
    console.log(`  Still need: ${week.proposals_sent} proposals, ${week.deals_won} closes`)
    console.log('')

    let weekProposals = 0
    let weekCloses = 0

    for (const lead of candidates) {
      const remaining = `[Need ${week.proposals_sent - weekProposals} more proposals, ${week.deals_won - weekCloses} more closes]`
      console.log(`  ${lead.name}`)
      console.log(`    Email: ${lead.email}`)
      console.log(`    Industry: ${lead.industry || '—'}  |  Revenue: ${lead.revenue_range || '—'}`)
      console.log(`    Creative: ${lead.utm_content || '—'}  |  Call: ${lead.call_datetime?.slice(0, 10) || '—'}`)
      console.log(`    ${remaining}`)

      const choice = (await ask('    Tag [s/q/p/w/l/d/a]: ')).trim().toLowerCase()

      if (choice === 's' || choice === '') continue

      const stageMap: Record<string, string> = {
        q: 'qualified',
        p: 'proposal_sent',
        w: 'closed_won',
        l: 'closed_lost',
        d: 'disqualified',
        a: 'abandoned',
      }

      const newStage = stageMap[choice]
      if (!newStage) {
        console.log('    ⚠ Unknown option, skipping')
        continue
      }

      const update: BackfillUpdate = {
        id: lead.id,
        name: lead.name,
        stage: newStage,
        proposal_sent: ['proposal_sent', 'closed_won', 'closed_lost'].includes(newStage),
      }

      // If proposal-related, ask for value and date
      if (['proposal_sent', 'closed_won', 'closed_lost', 'qualified'].includes(newStage)) {
        if (['proposal_sent', 'closed_won', 'closed_lost'].includes(newStage)) {
          const valStr = await ask('    Proposal value (£): ')
          update.proposal_value = parseFloat(valStr) || undefined

          // Approximate proposal_sent_at as end of the call week
          const proposalDate = lead.call_datetime
            ? new Date(new Date(lead.call_datetime).getTime() + 2 * 86400000).toISOString()
            : new Date(week.week_start + 'T12:00:00Z').toISOString()
          update.proposal_sent_at = proposalDate

          weekProposals++
        }
      }

      if (newStage === 'closed_won') {
        const revStr = await ask('    Revenue closed (£): ')
        update.revenue = parseFloat(revStr) || undefined
        weekCloses++
      }

      if (newStage === 'closed_lost') {
        update.close_reason = await ask('    Close reason: ') || undefined
        weekCloses++ // lost still counts toward "dealt with"
      }

      updates.push(update)
      totalTagged++
      console.log(`    ✓ Tagged as ${newStage}`)
      console.log('')
    }
  }

  // ─── Generate outputs ───────────────────────────────────────────────────

  console.log(`\n${'═'.repeat(64)}`)
  console.log(`  DONE — ${totalTagged} leads tagged`)
  console.log(`${'═'.repeat(64)}\n`)

  // 1. JSON output
  const jsonPath = path.resolve(__dirname, 'backfill-output.json')
  fs.writeFileSync(jsonPath, JSON.stringify(updates, null, 2))
  console.log(`  ✓ JSON output:  ${jsonPath}`)

  // 2. SQL output
  const sqlLines = [
    '-- Historical lead back-fill — generated by backfill-helper.ts',
    `-- Generated: ${new Date().toISOString()}`,
    `-- ${updates.length} leads updated\n`,
    'BEGIN;\n',
  ]

  for (const u of updates) {
    const sets: string[] = [`stage = '${u.stage}'`, `proposal_sent = ${u.proposal_sent}`]
    if (u.proposal_sent_at) sets.push(`proposal_sent_at = '${u.proposal_sent_at}'`)
    if (u.proposal_value) sets.push(`proposal_value = ${u.proposal_value}`)
    if (u.revenue) sets.push(`revenue = ${u.revenue}`)
    if (u.close_reason) sets.push(`close_reason = '${u.close_reason.replace(/'/g, "''")}'`)
    sets.push(`updated_at = now()`)

    sqlLines.push(`-- ${u.name}`)
    sqlLines.push(`UPDATE leads SET ${sets.join(', ')} WHERE id = '${u.id}';\n`)

    // Also insert stage_history row
    sqlLines.push(`INSERT INTO stage_history (lead_id, from_stage, to_stage, changed_by, auto_reason)`)
    sqlLines.push(`VALUES ('${u.id}', 'showed', '${u.stage}', 'backfill', 'historical backfill from CSV');\n`)
  }

  sqlLines.push('COMMIT;')

  const sqlPath = path.resolve(__dirname, 'backfill-historical-leads.sql')
  fs.writeFileSync(sqlPath, sqlLines.join('\n'))
  console.log(`  ✓ SQL output:   ${sqlPath}`)

  // 3. Instructions for realLeads.ts updates
  console.log(`\n  Next steps:`)
  console.log(`  1. Review backfill-output.json`)
  console.log(`  2. Run the SQL in Supabase: backfill-historical-leads.sql`)
  console.log(`  3. Update src/lib/realLeads.ts to match (or re-export from Supabase)`)

  rl.close()
}

main().catch(err => {
  console.error(err)
  rl.close()
  process.exit(1)
})
