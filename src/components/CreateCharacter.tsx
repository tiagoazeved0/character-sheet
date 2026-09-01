import { useMemo, useState } from 'react'
import { usePacks } from '../store/packs.ts'
import { useCharacters } from '../store/character.ts'
import { blankCharacter, suggestedProficiency } from '../data/blank.ts'
import { resolvePacks, type ResolvedEntry } from '../packs/resolver.ts'
import { grantsForLevelRange } from '../packs/levelup.ts'
import { startingHp } from '../rules/vitals.ts'
import { mod } from '../rules/derive.ts'
import { ABILITIES, ABILITY_NAMES, type Ability, type Character, type FeatureEntry, type PackPin } from '../rules/types.ts'
import { SKILLS } from '../rules/skills.ts'
import { POINT_BUY_BUDGET, pointBuyCost, pointBuyValid, STANDARD_ARRAY } from '../rules/abilityScores.ts'
import type { BackgroundDef, ClassDef, RaceDef, RulesPack } from '../packs/types.ts'
import { ChoicePicker } from './ChoicePicker.tsx'
import { Field, NumField } from './Editor.tsx'

const STEPS = ['packs', 'race', 'class', 'background', 'scores', 'skills', 'review'] as const
type Step = (typeof STEPS)[number]

const packKey = (p: { packId: string; version: string }) => `${p.packId}@${p.version}`

type DefEntry<T> = { packId: string; def: T }

/** Reads one resolved entry's underlying data, whatever shape its category uses (FeatureDef and FeatDef differ slightly). */
function readEntry(index: Map<string, ResolvedEntry>, fqid: string): { id: string; name: string; desc: string; tag?: string; sub?: string } | undefined {
  return index.get(fqid)?.entry as { id: string; name: string; desc: string; tag?: string; sub?: string } | undefined
}

function toFeatureEntry(entry: { id: string; name: string; desc: string; tag?: string; sub?: string }, ref: string): FeatureEntry {
  return { id: entry.id, name: entry.name, tag: entry.tag ?? 'Feat', sub: entry.sub ?? '', desc: entry.desc, ref }
}

/**
 * Guided character creation, driven by whatever's actually installed:
 * pick packs -> race -> class (+ starting level, + any choices it surfaces,
 * e.g. a subclass) -> background -> ability scores -> class skill choices
 * -> review. A third route alongside Editor.tsx's existing blank-slate and
 * duplicate, not a replacement for either.
 */
export function CreateCharacter({ onClose }: { onClose: () => void }) {
  const installed = usePacks((s) => s.packs)
  const createFromWizard = useCharacters((s) => s.createFromWizard)

  const [stepIndex, setStepIndex] = useState(0)
  const step: Step = STEPS[stepIndex]!
  const goNext = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0))

  const [name, setName] = useState('New character')
  const [packKeys, setPackKeys] = useState<Set<string>>(new Set())
  const chosenPacks: RulesPack[] = useMemo(() => installed.filter((p) => packKeys.has(packKey(p))), [installed, packKeys])
  const pins: PackPin[] = useMemo(() => chosenPacks.map((p) => ({ packId: p.packId, version: p.version })), [chosenPacks])
  const index = useMemo(() => resolvePacks(installed, pins), [installed, pins])

  const raceOptions: DefEntry<RaceDef>[] = useMemo(
    () => chosenPacks.flatMap((p) => p.content.races.map((def) => ({ packId: p.packId, def }))), [chosenPacks],
  )
  const [race, setRace] = useState<DefEntry<RaceDef> | null>(null)
  const [raceChoiceSel, setRaceChoiceSel] = useState<Record<string, string>>({})

  const classOptions: DefEntry<ClassDef>[] = useMemo(
    () => chosenPacks.flatMap((p) => p.content.classes.map((def) => ({ packId: p.packId, def }))), [chosenPacks],
  )
  const [cls, setCls] = useState<DefEntry<ClassDef> | null>(null)
  const [startLevel, setStartLevel] = useState(1)
  const [classChoiceSel, setClassChoiceSel] = useState<Record<string, string>>({})
  const baseClassGrants = useMemo(
    () => (cls ? grantsForLevelRange(cls.def, undefined, 0, startLevel) : { features: [], choices: [] }),
    [cls, startLevel],
  )
  const subclassChoice = baseClassGrants.choices.find((c) => c.kind === 'subclass')
  const subclassId = subclassChoice ? classChoiceSel[subclassChoice.id] : undefined
  const classFeatureIds = useMemo(
    () => (cls ? grantsForLevelRange(cls.def, subclassId, 0, startLevel).features : []),
    [cls, subclassId, startLevel],
  )

  const backgroundOptions: DefEntry<BackgroundDef>[] = useMemo(
    () => chosenPacks.flatMap((p) => p.content.backgrounds.map((def) => ({ packId: p.packId, def }))), [chosenPacks],
  )
  const [background, setBackground] = useState<DefEntry<BackgroundDef> | null>(null)
  const [backgroundSkillsManual, setBackgroundSkillsManual] = useState<Set<string>>(new Set())

  const [scoreMethod, setScoreMethod] = useState<'standard' | 'pointbuy' | 'manual'>('standard')
  const [scores, setScores] = useState<Record<Ability, number>>({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })
  const [standardAssign, setStandardAssign] = useState<Record<Ability, number | null>>({ str: null, dex: null, con: null, int: null, wis: null, cha: null })
  const [asiPlus2, setAsiPlus2] = useState<Ability | ''>('')
  const [asiPlus1, setAsiPlus1] = useState<Ability | ''>('')

  const baseScores: Record<Ability, number> = scoreMethod === 'standard'
    ? (Object.fromEntries(ABILITIES.map((a) => [a, standardAssign[a] ?? 10])) as Record<Ability, number>)
    : scores
  const finalScores: Record<Ability, number> = useMemo(() => {
    const s = { ...baseScores }
    if (asiPlus2) s[asiPlus2] += 2
    if (asiPlus1) s[asiPlus1] += 1
    return s
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(baseScores), asiPlus2, asiPlus1])

  const [classSkills, setClassSkills] = useState<Set<string>>(new Set())

  const [acOverride, setAcOverride] = useState<number | null>(null)
  const [hpOverride, setHpOverride] = useState<number | null>(null)
  const defaultAc = 10 + mod(finalScores.dex)
  const defaultHp = cls ? startingHp(cls.def.hitDie, startLevel, mod(finalScores.con)) : 8
  const ac = acOverride ?? defaultAc
  const maxHp = hpOverride ?? defaultHp

  const canProceed: Record<Step, boolean> = {
    packs: chosenPacks.length > 0,
    race: race !== null && (race.def.choices ?? []).every((c) => raceChoiceSel[c.id]),
    class: cls !== null && baseClassGrants.choices.every((c) => classChoiceSel[c.id]),
    background: background !== null,
    scores: scoreMethod === 'standard'
      ? ABILITIES.every((a) => standardAssign[a] !== null)
      : scoreMethod === 'pointbuy'
        ? pointBuyValid(ABILITIES.map((a) => scores[a]))
        : true,
    skills: cls ? classSkills.size === cls.def.skillChoices.count : false,
    review: race !== null && cls !== null && background !== null,
  }

  const create = () => {
    if (!race || !cls || !background) return

    const features: FeatureEntry[] = []
    const skills: Record<string, 0 | 1 | 2> = Object.fromEntries(SKILLS.map((s) => [s.id, 0 as const]))

    for (const id of race.def.features ?? []) {
      const fqid = `${race.packId}:features/${id}`
      const def = readEntry(index, fqid)
      if (def) features.push(toFeatureEntry(def, fqid))
    }
    for (const choice of race.def.choices ?? []) {
      const optionId = raceChoiceSel[choice.id]
      if (!optionId) continue
      if (choice.kind === 'skill') skills[optionId] = 1
      if (choice.kind === 'feat') {
        const fqid = `${race.packId}:feats/${optionId}`
        const def = readEntry(index, fqid)
        if (def) features.push(toFeatureEntry(def, fqid))
      }
    }

    for (const id of classFeatureIds) {
      const fqid = `${cls.packId}:features/${id}`
      const def = readEntry(index, fqid)
      if (def) features.push(toFeatureEntry(def, fqid))
    }

    for (const id of background.def.features ?? []) {
      const fqid = `${background.packId}:features/${id}`
      const def = readEntry(index, fqid)
      if (def) features.push(toFeatureEntry(def, fqid))
    }
    for (const id of background.def.skillProficiencies ?? backgroundSkillsManual) skills[id] = 1
    for (const id of classSkills) skills[id] = 1

    const base = blankCharacter(name)
    const character: Character = {
      ...base,
      name,
      classLine: `${race.def.name} - ${cls.def.name} ${startLevel} - ${background.def.name}`,
      level: startLevel,
      proficiencyBonus: suggestedProficiency(startLevel),
      hitDie: cls.def.hitDie,
      scores: finalScores,
      saveProficiencies: cls.def.saveProficiencies,
      skills,
      maxHp,
      ac,
      features,
      resources: [{ id: 'hit-dice', name: `Hit dice (d${cls.def.hitDie})`, max: startLevel, recovery: 'long', colour: 'green' }],
      packs: pins,
      raceRef: `${race.packId}:races/${race.def.id}`,
      backgroundRef: `${background.packId}:backgrounds/${background.def.id}`,
      classes: [{ classRef: `${cls.packId}:classes/${cls.def.id}`, level: startLevel, subclassId }],
      vitals: { ...base.vitals, hp: maxHp },
    }
    createFromWizard(character)
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="panel-title">Guided creation -- {step}</span>
          <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={onClose}>Close</button>
        </div>

        <div className="modal-body">
          {step === 'packs' && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Field label="Character name" value={name} onChange={setName} />
              <span className="caps" style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>Rules packs to build from</span>
              {installed.length === 0 && <p className="muted" style={{ fontSize: '0.8125rem' }}>No packs installed. Install one via Characters &amp; edit first.</p>}
              <div className="rows">
                {installed.map((p) => {
                  const key = packKey(p)
                  const on = packKeys.has(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`pick-row ${on ? 'on' : ''}`}
                      onClick={() => setPackKeys((s) => {
                        const next = new Set(s)
                        if (next.has(key)) next.delete(key); else next.add(key)
                        return next
                      })}
                    >
                      <div className="row-top">
                        <span className="row-title" style={{ fontSize: '0.875rem' }}>{p.title}</span>
                        <span className="tag">{p.version}</span>
                      </div>
                      <div className="row-sub">{p.license}</div>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {step === 'race' && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="rows">
                {raceOptions.map((r) => (
                  <button
                    key={`${r.packId}:${r.def.id}`}
                    type="button"
                    className={`pick-row ${race?.def.id === r.def.id ? 'on' : ''}`}
                    onClick={() => { setRace(r); setRaceChoiceSel({}) }}
                  >
                    <div className="row-top"><span className="row-title" style={{ fontSize: '0.875rem' }}>{r.def.name}</span></div>
                    <div className="row-desc">{r.def.desc}</div>
                  </button>
                ))}
              </div>
              {race?.def.choices?.map((choice) => (
                <ChoicePicker
                  key={choice.id}
                  choice={choice}
                  selected={raceChoiceSel[choice.id] ?? null}
                  onSelect={(optionId) => setRaceChoiceSel((s) => ({ ...s, [choice.id]: optionId }))}
                />
              ))}
            </section>
          )}

          {step === 'class' && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="rows">
                {classOptions.map((c) => (
                  <button
                    key={`${c.packId}:${c.def.id}`}
                    type="button"
                    className={`pick-row ${cls?.def.id === c.def.id ? 'on' : ''}`}
                    onClick={() => { setCls(c); setClassChoiceSel({}) }}
                  >
                    <div className="row-top">
                      <span className="row-title" style={{ fontSize: '0.875rem' }}>{c.def.name}</span>
                      <span className="tag">d{c.def.hitDie}</span>
                    </div>
                  </button>
                ))}
              </div>
              {cls && (
                <NumField label="Starting level" value={startLevel} onChange={(v) => v >= 1 && v <= 20 && setStartLevel(v)} />
              )}
              {baseClassGrants.choices.map((choice) => (
                <ChoicePicker
                  key={choice.id}
                  choice={choice}
                  selected={classChoiceSel[choice.id] ?? null}
                  onSelect={(optionId) => setClassChoiceSel((s) => ({ ...s, [choice.id]: optionId }))}
                />
              ))}
            </section>
          )}

          {step === 'background' && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="rows">
                {backgroundOptions.map((b) => (
                  <button
                    key={`${b.packId}:${b.def.id}`}
                    type="button"
                    className={`pick-row ${background?.def.id === b.def.id ? 'on' : ''}`}
                    onClick={() => setBackground(b)}
                  >
                    <div className="row-top"><span className="row-title" style={{ fontSize: '0.875rem' }}>{b.def.name}</span></div>
                    <div className="row-desc">{b.def.feature}</div>
                  </button>
                ))}
              </div>
              {background && !background.def.skillProficiencies && (
                <div className="card side-card">
                  <span className="panel-title">Skill proficiencies</span>
                  <p className="muted" style={{ fontSize: '0.75rem', margin: 0 }}>
                    {background.def.name}'s exact grants aren't in the pack yet -- pick manually.
                  </p>
                  <div className="chips">
                    {SKILLS.map((s) => {
                      const on = backgroundSkillsManual.has(s.id)
                      return (
                        <button
                          key={s.id} type="button" className={`chip ${on ? 'on' : ''}`}
                          onClick={() => setBackgroundSkillsManual((set) => {
                            const next = new Set(set)
                            if (next.has(s.id)) next.delete(s.id); else next.add(s.id)
                            return next
                          })}
                        >
                          {s.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </section>
          )}

          {step === 'scores' && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="segmented">
                {(['standard', 'pointbuy', 'manual'] as const).map((m) => (
                  <button key={m} className={scoreMethod === m ? 'on' : ''} style={{ flex: 1 }} onClick={() => setScoreMethod(m)}>
                    {m === 'standard' ? 'Standard array' : m === 'pointbuy' ? 'Point buy' : 'Manual'}
                  </button>
                ))}
              </div>

              {scoreMethod === 'standard' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                  {ABILITIES.map((a) => (
                    <label key={a} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.6875rem' }}>
                      <span className="caps" style={{ color: 'var(--text-secondary)' }}>{ABILITY_NAMES[a]}</span>
                      <select
                        value={standardAssign[a] ?? ''}
                        onChange={(e) => setStandardAssign((s) => ({ ...s, [a]: e.target.value ? Number(e.target.value) : null }))}
                        style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border)' }}
                      >
                        <option value="">--</option>
                        {STANDARD_ARRAY.filter((v) => !Object.entries(standardAssign).some(([k, used]) => k !== a && used === v)).map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}

              {scoreMethod === 'pointbuy' && (
                <>
                  <span className="mono" style={{ fontSize: '0.8125rem' }}>
                    {pointBuyCost(ABILITIES.map((a) => scores[a]))} / {POINT_BUY_BUDGET} points
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                    {ABILITIES.map((a) => (
                      <NumField key={a} label={ABILITY_NAMES[a]} value={scores[a]} onChange={(v) => v >= 8 && v <= 15 && setScores((s) => ({ ...s, [a]: v }))} />
                    ))}
                  </div>
                </>
              )}

              {scoreMethod === 'manual' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                  {ABILITIES.map((a) => (
                    <NumField key={a} label={ABILITY_NAMES[a]} value={scores[a]} onChange={(v) => setScores((s) => ({ ...s, [a]: v }))} />
                  ))}
                </div>
              )}

              <div className="card side-card">
                <span className="panel-title">Background ability score improvement</span>
                <p className="muted" style={{ fontSize: '0.75rem', margin: 0 }}>2024 backgrounds grant +2 to one ability and +1 to another (optional).</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.6875rem' }}>
                    <span className="caps" style={{ color: 'var(--text-secondary)' }}>+2</span>
                    <select value={asiPlus2} onChange={(e) => setAsiPlus2(e.target.value as Ability | '')} style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border)' }}>
                      <option value="">--</option>
                      {ABILITIES.map((a) => <option key={a} value={a}>{ABILITY_NAMES[a]}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.6875rem' }}>
                    <span className="caps" style={{ color: 'var(--text-secondary)' }}>+1</span>
                    <select value={asiPlus1} onChange={(e) => setAsiPlus1(e.target.value as Ability | '')} style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border)' }}>
                      <option value="">--</option>
                      {ABILITIES.filter((a) => a !== asiPlus2).map((a) => <option key={a} value={a}>{ABILITY_NAMES[a]}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            </section>
          )}

          {step === 'skills' && cls && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="card side-card">
                <span className="panel-title">{cls.def.name} skills -- pick {cls.def.skillChoices.count}</span>
                <div className="chips">
                  {cls.def.skillChoices.from.map((id) => {
                    const skill = SKILLS.find((s) => s.id === id)
                    const on = classSkills.has(id)
                    const disabled = !on && classSkills.size >= cls.def.skillChoices.count
                    return (
                      <button
                        key={id} type="button" disabled={disabled} className={`chip ${on ? 'on' : ''}`}
                        onClick={() => setClassSkills((s) => {
                          const next = new Set(s)
                          if (next.has(id)) next.delete(id); else next.add(id)
                          return next
                        })}
                      >
                        {skill?.name ?? id}
                      </button>
                    )
                  })}
                </div>
              </div>
            </section>
          )}

          {step === 'review' && race && cls && background && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: '0.875rem' }}>
                <strong>{name}</strong> -- {race.def.name} {cls.def.name} {startLevel}{subclassId ? ` (${subclassId})` : ''}, {background.def.name}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                <NumField label="Armor Class" value={ac} onChange={setAcOverride} />
                <NumField label="Max HP" value={maxHp} onChange={setHpOverride} />
              </div>
              <p className="muted" style={{ fontSize: '0.75rem' }}>
                AC defaults to 10 + DEX; HP uses average-per-level. Neither accounts for class features that
                override them (e.g. an unarmored-defense-style feature) -- correct above if this class has one.
              </p>
              <button className="btn primary" onClick={create}>Create character</button>
            </section>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--divider)' }}>
          <button className="btn ghost" onClick={goBack} disabled={stepIndex === 0}>Back</button>
          {step !== 'review' && (
            <button className="btn primary" style={{ marginLeft: 'auto' }} onClick={goNext} disabled={!canProceed[step]}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
