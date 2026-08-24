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
}

export type D20Result = {
  natural: number
  both: [number, number] | null
  modifier: number
  bonusDie: { size: number; value: number } | null
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
  const causes: string[] = []

  for (const c of req.conditions) {
    const e = c.effect
    if (e.adv?.includes(req.type)) { adv = true; causes.push(c.name) }
    if (e.dis?.includes(req.type)) { dis = true; causes.push(c.name) }
    if (req.ability && req.type === 'save' && e.disSave?.includes(req.ability)) {
      dis = true; causes.push(c.name)
    }
    if (e.bonusDie && e.bonusDie.on.includes(req.type)) {
      bonusSize = e.bonusDie.size; causes.push(c.name)
    }
  }

  // 5e: advantage and disadvantage cancel entirely, however many of each.
  if (adv && dis) { adv = false; dis = false }

  const a = roll(20)
  const b = roll(20)
  const rollsTwice = adv || dis
  const natural = adv ? Math.max(a, b) : dis ? Math.min(a, b) : a
  const bonus = bonusSize ? { size: bonusSize, value: roll(bonusSize) } : null
  const total = natural + req.modifier + (bonus?.value ?? 0)

  const parts: string[] = []
  parts.push(rollsTwice ? `d20: ${a}, ${b} -> ${natural}` : `d20: ${natural}`)
  if (req.modifier !== 0) parts.push(`${req.modifier >= 0 ? '+' : '-'} ${Math.abs(req.modifier)}`)
  if (bonus) parts.push(`+ ${bonus.value} (1d${bonus.size})`)
  if (adv) parts.push('advantage')
  if (dis) parts.push('disadvantage')
  if (causes.length) parts.push(`from ${[...new Set(causes)].join(', ')}`)

  return {
    natural,
    both: rollsTwice ? [a, b] : null,
    modifier: req.modifier,
    bonusDie: bonus,
    total,
    advantage: adv,
    disadvantage: dis,
    causes: [...new Set(causes)],
    detail: parts.join(' '),
    kind: natural === 20 ? 'crit' : natural === 1 ? 'fail' : 'normal',
  }
}

export type DamageRider = { name: string; count: number; size: number; type: string }

export type DamageResult = { rolls: number[]; total: number; detail: string }

/** Lists every individual die, and folds in riders like Hex automatically. */
export function rollDamage(
  count: number,
  size: number,
  flat: number,
  riders: DamageRider[] = [],
  roll: Roller = defaultRoller,
): DamageResult {
  const rolls = Array.from({ length: count }, () => roll(size))
  let total = rolls.reduce((s, r) => s + r, 0) + flat
  const parts = [`${count}d${size}: ${rolls.join(' + ')}`]
  if (flat !== 0) parts.push(`${flat >= 0 ? '+' : '-'} ${Math.abs(flat)}`)

  for (const r of riders) {
    const extra = Array.from({ length: r.count }, () => roll(r.size))
    const sum = extra.reduce((s, x) => s + x, 0)
    total += sum
    parts.push(`+ ${sum} (${r.count}d${r.size} ${r.type}, ${r.name})`)
  }

  return { rolls, total, detail: parts.join(' ') }
}

let nextId = 1
export const makeLogEntry = (e: Omit<LogEntry, 'id'>): LogEntry => ({ id: nextId++, ...e })
export const LOG_CAP = 40
