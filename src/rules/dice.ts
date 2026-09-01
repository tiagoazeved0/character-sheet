import type { Ability, AdvMode, ConditionDef, LogEntry, RollType } from './types.ts'

/**
 * The injectable seam. Tests supply a scripted roller; production supplies dice.
 */
export type Roller = (size: number) => number
export const defaultRoller: Roller = (size) => 1 + Math.floor(Math.random() * size)

export type D20Request = {
  label: string
  modifier: number
  type: RollType
  /** For saves: which ability, so conditions like Restrained can target it. */
  ability?: Ability
  mode: AdvMode
  conditions: ConditionDef[]
  /** Reasons for part of `modifier` that are not conditions -- cover, so far.
   *  Folded into `causes` so the log never shows a number it cannot account for. */
  notes?: string[]
}

export type D20Result = {
  natural: number
  /** True when a condition means the save fails regardless of the die. */
  autoFail: boolean
  both: [number, number] | null
  modifier: number
  bonusDie: { size: number; value: number } | null
  penaltyDie: { size: number; value: number } | null
  total: number
  advantage: boolean
  disadvantage: boolean
  causes: string[]
  detail: string
  kind: 'normal' | 'crit' | 'fail'
}

/**
 * The heart of the sheet. Resolves global advantage together with every active
 * condition, then shows the whole sum. Never surface a bare total: the point is
 * that the player can see which condition changed the maths.
 */
export function rollD20(req: D20Request, roll: Roller = defaultRoller): D20Result {
  let adv = req.mode === 'adv'
  let dis = req.mode === 'dis'
  let bonusSize = 0
  let penaltySize = 0
  let autoFail = false
  const causes: string[] = [...(req.notes ?? [])]

  for (const c of req.conditions) {
    const e = c.effect
    if (req.ability && req.type === 'save' && e.autoFailSave?.includes(req.ability)) {
      autoFail = true; causes.push(c.name)
    }
    if (e.adv?.includes(req.type)) { adv = true; causes.push(c.name) }
    if (e.dis?.includes(req.type)) { dis = true; causes.push(c.name) }
    if (req.ability && req.type === 'save' && e.disSave?.includes(req.ability)) {
      dis = true; causes.push(c.name)
    }
    if (e.bonusDie && e.bonusDie.on.includes(req.type)) {
      bonusSize = e.bonusDie.size; causes.push(c.name)
    }
    if (e.penaltyDie && e.penaltyDie.on.includes(req.type)) {
      penaltySize = e.penaltyDie.size; causes.push(c.name)
    }
  }

  // 5e: advantage and disadvantage cancel entirely, however many of each.
  if (adv && dis) { adv = false; dis = false }

  const a = roll(20)
  const b = roll(20)
  const rollsTwice = adv || dis
  const natural = adv ? Math.max(a, b) : dis ? Math.min(a, b) : a
  const bonus = bonusSize ? { size: bonusSize, value: roll(bonusSize) } : null
  const penalty = penaltySize ? { size: penaltySize, value: roll(penaltySize) } : null
  const total = natural + req.modifier + (bonus?.value ?? 0) - (penalty?.value ?? 0)

  const parts: string[] = []
  parts.push(rollsTwice ? `d20: ${a}, ${b} -> ${natural}` : `d20: ${natural}`)
  if (req.modifier !== 0) parts.push(`${req.modifier >= 0 ? '+' : '-'} ${Math.abs(req.modifier)}`)
  if (bonus) parts.push(`+ ${bonus.value} (1d${bonus.size})`)
  if (penalty) parts.push(`- ${penalty.value} (1d${penalty.size})`)
  if (adv) parts.push('advantage')
  if (dis) parts.push('disadvantage')
  if (autoFail) parts.push('- automatic failure')
  if (causes.length) parts.push(`from ${[...new Set(causes)].join(', ')}`)

  return {
    natural,
    autoFail,
    both: rollsTwice ? [a, b] : null,
    modifier: req.modifier,
    bonusDie: bonus,
    penaltyDie: penalty,
    total,
    advantage: adv,
    disadvantage: dis,
    causes: [...new Set(causes)],
    detail: parts.join(' '),
    kind: autoFail ? 'fail' : natural === 20 ? 'crit' : natural === 1 ? 'fail' : 'normal',
  }
}

export type DamageRider = { name: string; count: number; size: number; type: string }

export type DamageResult = { rolls: number[]; total: number; detail: string }

/**
 * Lists every individual die, and folds in riders like Hex automatically.
 * On a Critical Hit, every die -- the base damage and every rider's -- is
 * rolled twice and added together; flat modifiers are still added only once.
 */
export function rollDamage(
  count: number,
  size: number,
  flat: number,
  riders: DamageRider[] = [],
  crit = false,
  roll: Roller = defaultRoller,
): DamageResult {
  const dieCount = crit ? count * 2 : count
  const rolls = Array.from({ length: dieCount }, () => roll(size))
  let total = rolls.reduce((s, r) => s + r, 0) + flat
  const parts = [`${dieCount}d${size}${crit ? ' (crit)' : ''}: ${rolls.join(' + ')}`]
  if (flat !== 0) parts.push(`${flat >= 0 ? '+' : '-'} ${Math.abs(flat)}`)

  for (const r of riders) {
    const riderCount = crit ? r.count * 2 : r.count
    const extra = Array.from({ length: riderCount }, () => roll(r.size))
    const sum = extra.reduce((s, x) => s + x, 0)
    total += sum
    parts.push(`+ ${sum} (${riderCount}d${r.size} ${r.type}, ${r.name})`)
  }

  return { rolls, total, detail: parts.join(' ') }
}

let nextId = 1
export const makeLogEntry = (e: Omit<LogEntry, 'id'>): LogEntry => ({ id: nextId++, ...e })
export const LOG_CAP = 40
