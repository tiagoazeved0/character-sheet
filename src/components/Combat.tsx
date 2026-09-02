import { useState } from 'react'
import type { Character, Lane, Requirement } from '../rules/types.ts'
import {
  LANE_NAMES, situationLabel, situationTags, turnPlan,
  type CombatOption, type LanePlan, type SpellCost,
} from '../rules/combat.ts'
import { damageLabel, fmt, spellAttack } from '../rules/derive.ts'
import { expandTokens } from '../rules/tokens.ts'
import { conditionById } from '../data/conditions.ts'
import { useSession } from '../store/session.ts'
import type { useSheetActions } from '../store/actions.ts'

type Props = { character: Character; actions: ReturnType<typeof useSheetActions> }

const LANE_EMPTY: Record<Lane, string> = {
  action: 'Nothing on the sheet is tagged as an action. Give entries a lane in the editor.',
  bonus: 'Nothing is tagged as a bonus action.',
  move: '',
  reaction: 'Nothing is tagged as a reaction.',
  free: '',
}

/**
 * One turn, in lanes. Everything here is read off the entries on the sheet --
 * their `lane`, `requires` and `favoredWhen` -- rather than authored per
 * character, which is why the prototype's version only ever fit one warlock.
 */
export function Combat({ character: c, actions }: Props) {
  const round = useSession((s) => s.round)
  const situations = useSession((s) => s.situations)
  const toggleSituation = useSession((s) => s.toggleSituation)
  const endTurn = useSession((s) => s.endTurn)
  const toggleCombat = useSession((s) => s.toggleCombat)

  const tok = (s: string) => expandTokens(s, c)
  const tags = situationTags(c)
  const conditions = c.vitals.conditions.map(conditionById).filter((x): x is NonNullable<typeof x> => Boolean(x))

  return (
    <div className="combat">
      <div className="combat-head">
        <span className="combat-round">Round {round}</span>
        <button className="btn primary" onClick={endTurn}>End turn</button>
        <button className="btn ghost" onClick={toggleCombat}>Leave combat</button>
      </div>

      {tags.length > 0 && (
        <div className="combat-situations">
          <span className="caps combat-legend">Situation</span>
          <div className="chips">
            {tags.map((tag) => (
              <button
                key={tag}
                className={`chip ${situations.includes(tag) ? 'on' : ''}`}
                onClick={() => toggleSituation(tag)}
              >
                {situationLabel(tag)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* What each condition costs you this turn, phrased as an outcome. The
          rules text stays in the conditions panel; here you want the consequence. */}
      {conditions.length > 0 && (
        <div className="card combat-conditions">
          {conditions.map((cond) => (
            <p key={cond.id}><strong>{cond.name}.</strong> {cond.turnText}</p>
          ))}
        </div>
      )}

      {turnPlan(c, situations).map((plan) => (
        <LanePanel key={plan.lane} plan={plan} character={c} actions={actions} tok={tok} />
      ))}
    </div>
  )
}

type LaneProps = Props & { plan: LanePlan; tok: (s: string) => string }

function LanePanel({ plan, character: c, actions, tok }: LaneProps) {
  const spent = useSession((s) => s.lanes[plan.lane])
  const spendLane = useSession((s) => s.spendLane)
  const restoreLane = useSession((s) => s.restoreLane)

  // Only the three lanes you actually spend get marked. Move keeps a distance
  // instead, and Free has no budget to run out of.
  const budgeted = plan.lane === 'action' || plan.lane === 'bonus' || plan.lane === 'reaction'
  if (plan.lane === 'free' && plan.options.length === 0) return null

  /** Using something marks its lane. There is no button for marking one by hand:
   *  one on every header, most of them never wanted, was all noise. */
  const take = () => { if (budgeted) spendLane(plan.lane) }

  return (
    <section className={`lane ${spent ? 'spent' : ''}`}>
      <div className="lane-head">
        <span className="lane-name">{LANE_NAMES[plan.lane]}</span>
        {plan.lane === 'move' && <MoveTrack character={c} />}
        {budgeted && spent && (
          <button className="lane-flag" onClick={() => restoreLane(plan.lane)} title="Put this back">
            Used <span aria-hidden>↺</span>
          </button>
        )}
      </div>

      {plan.options.map((option) => (
        <OptionRow key={option.entry.id} option={option} character={c} actions={actions} tok={tok} take={take} />
      ))}

      {plan.options.length === 0 && plan.hidden === 0 && LANE_EMPTY[plan.lane] && (
        <p className="lane-empty">{LANE_EMPTY[plan.lane]}</p>
      )}

      {/* Named rather than silently dropped: a spell vanishing mid-fight is
          alarming until you remember you are out of slots. */}
      {plan.hidden > 0 && (
        <p className="lane-empty">
          {plan.hidden} more {plan.hidden === 1 ? 'option' : 'options'} here, with nothing left to pay for{' '}
          {plan.hidden === 1 ? 'it' : 'them'}.
        </p>
      )}
    </section>
  )
}

/**
 * Movement is the one part of the turn that is a quantity rather than a yes/no,
 * so it gets a distance instead of a used flag. Going past your speed is allowed
 * and counted -- Dash doubles it, and the sheet has no way to know you took it.
 */
function MoveTrack({ character: c }: { character: Character }) {
  const moved = useSession((s) => s.moved)
  const setMoved = useSession((s) => s.setMoved)
  const left = c.speed - moved

  return (
    <div className="move-track">
      <button onClick={() => setMoved(moved - 5)} disabled={moved === 0} aria-label="Take back five feet">&minus;5</button>
      <span className="mono move-left">
        {Math.abs(left)} <span className="move-unit">{left < 0 ? 'ft over' : 'ft left'}</span>
      </span>
      <button onClick={() => setMoved(moved + 5)} aria-label="Move five feet">+5</button>
      <span className="move-of">of {c.speed}</span>
    </div>
  )
}

type OptionProps = Props & { option: CombatOption; tok: (s: string) => string; take: () => void }

/**
 * Whether the roll that just happened is allowed to become damage. The DM calls
 * hits, so the sheet asks -- except at the two ends, where the die already knows:
 * a natural 20 always hits and a natural 1 always misses.
 */
type Outcome = 'idle' | 'asking' | 'hit'

function OptionRow({ option, character: c, actions, tok, take }: OptionProps) {
  const { entry, favoredBy } = option
  const action = option.kind === 'action' ? option.entry : null
  const spell = option.kind === 'spell' ? option.entry : null
  const feature = option.kind === 'feature' ? option.entry : null
  const remaining = option.kind === 'feature' ? option.remaining : null
  const requires = action?.requires ?? spell?.requires
  const attack = action?.attack ?? spell?.attack
  const damage = action?.damage ?? spell?.damage

  const [outcome, setOutcome] = useState<Outcome>('idle')

  // A levelled spell spends when you cast it; everything else spends on the
  // button that uses it, or on Take when it has no roll at all.
  const castable = option.kind === 'spell' && option.cost.kind !== 'cantrip'
  const hasPrimary = Boolean(attack || action?.check || action?.concentrationOn || feature)
  const attackMod = spell ? spellAttack(c) : action?.attack?.mod ?? 0
  /** An attack has to land first. Anything else -- a save-for-half spell, a
   *  thrown flask -- rolls its damage whenever you want it. */
  const damageReady = damage && (!attack || outcome === 'hit')

  /** The button that uses an option is the one that spends: it pays the entry's
   *  cost and marks the lane. Rolling damage afterwards is a follow-up and free. */
  const pay = () => {
    if (spell) actions.castSpell(spell)
    else if (feature?.pool) actions.spendPool(feature.pool)
    else if (requires) actions.spendPool(requires.pool, requires.amount)
    take()
  }

  const swing = () => {
    const result = actions.rollAttack(spell?.attack?.label ?? entry.name, attackMod)
    if (!castable) pay()
    if (!damage) return
    setOutcome(result?.kind === 'crit' ? 'hit' : result?.kind === 'fail' ? 'idle' : 'asking')
  }

  return (
    <div className={`card combat-option ${favoredBy.length > 0 ? 'favored' : ''}`}>
      <div className="row-top">
        <span className="row-title">{entry.name}</span>
        {option.kind === 'spell' && <CostTag character={c} cost={option.cost} requires={requires} />}
        {option.kind === 'action' && requires && <PoolTag character={c} poolId={requires.pool} amount={requires.amount} />}
        {feature?.pool && <PoolTag character={c} poolId={feature.pool} remaining={remaining} />}
        {favoredBy.length > 0 && (
          <span className="tag favored-tag">{favoredBy.map(situationLabel).join(' · ')}</span>
        )}

        <div className="row-actions">
          {castable && <button className="btn primary" onClick={pay}>Cast</button>}

          {attack && <button className="btn primary" onClick={swing}>Attack {fmt(attackMod)}</button>}

          {action?.check && (
            <button className="btn primary" onClick={() => { actions.rollAttack(action.check!.label, action.check!.mod); pay() }}>
              Roll
            </button>
          )}

          {outcome === 'asking' && (
            <>
              <span className="hit-ask">Did it hit?</span>
              <button className="btn primary" onClick={() => setOutcome('hit')}>Hit</button>
              <button className="btn ghost" onClick={() => setOutcome('idle')}>Miss</button>
            </>
          )}

          {damageReady && (
            <button
              className={`btn ${outcome === 'hit' ? 'primary' : 'ghost'}`}
              onClick={() => { actions.rollDamageSpec(damage.label, damage); setOutcome('idle') }}
            >
              {damageLabel(damage)}
            </button>
          )}

          {/* Taking up concentration is itself the action, so it spends the lane;
              dropping it is free and can happen on anyone's turn. */}
          {action?.concentrationOn && (
            <button
              className={`btn ${c.vitals.concentration === action.concentrationOn ? 'ghost' : 'primary'}`}
              onClick={() => {
                if (c.vitals.concentration === action.concentrationOn) return actions.setConcentration(null)
                actions.setConcentration(action.concentrationOn!)
                pay()
              }}
            >
              {c.vitals.concentration === action.concentrationOn ? 'Drop' : 'Concentrate'}
            </button>
          )}

          {/* The same affordance the Features tab gives it, so the pip count reads
              the same in both places. */}
          {feature && (
            <button className="btn primary" onClick={pay}>
              Use{remaining !== null ? ` (${remaining})` : ''}
            </button>
          )}

          {!castable && !hasPrimary && <button className="btn primary" onClick={pay}>Take</button>}
        </div>
      </div>
      {entry.sub && <div className="row-sub">{tok(entry.sub)}</div>}
    </div>
  )
}

function CostTag({ character: c, cost, requires }: { character: Character; cost: SpellCost; requires?: Requirement }) {
  const extra = requires ? ` + ${requires.amount} ${poolName(c, requires.pool)}` : ''
  if (cost.kind === 'cantrip') return <span className="badge cantrip">Cantrip{extra}</span>
  if (cost.kind === 'pool') {
    return <span className="badge arcanum">{poolName(c, cost.poolId)} &middot; {cost.remaining} left{extra}</span>
  }
  return <span className="badge spell">Level {cost.level} slot &middot; {cost.remaining} left{extra}</span>
}

/** What a feature or a tagged action spends, and what is left of it. */
function PoolTag(
  { character: c, poolId, amount, remaining }:
  { character: Character; poolId: string; amount?: number; remaining?: number | null },
) {
  return (
    <span className="badge arcanum">
      {amount ? `${amount} ` : ''}{poolName(c, poolId)}
      {remaining !== null && remaining !== undefined ? ` · ${remaining} left` : ''}
    </span>
  )
}

const poolName = (c: Character, poolId: string) => c.resources.find((p) => p.id === poolId)?.name ?? poolId
