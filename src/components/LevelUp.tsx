import { useMemo, useState } from 'react'
import { usePacks } from '../store/packs.ts'
import { useCharacters } from '../store/character.ts'
import { suggestedProficiency } from '../data/blank.ts'
import { pinStates, resolvePacks } from '../packs/resolver.ts'
import { grantsForLevelRange, mergePools, poolsAtLevel } from '../packs/levelup.ts'
import type { Character, FeatureEntry } from '../rules/types.ts'
import type { ClassDef } from '../packs/types.ts'
import { ChoicePicker } from './ChoicePicker.tsx'
import { NumField } from './Editor.tsx'

/**
 * Levels up a pack-driven character's first (and, for now, only) class,
 * reusing the same grantsForLevelRange engine and ChoicePicker the creation
 * wizard uses. Single-class only -- multiclassing isn't modeled yet.
 */
export function LevelUp({ character: c, onClose }: { character: Character; onClose: () => void }) {
  const installed = usePacks((s) => s.packs)
  const apply = useCharacters((s) => s.apply)
  const index = useMemo(() => resolvePacks(installed, c.packs), [installed, c.packs])

  const classInfo = c.classes[0]
  const classDef = classInfo ? (index.get(classInfo.classRef)?.entry as ClassDef | undefined) : undefined

  const [targetLevel, setTargetLevel] = useState((classInfo?.level ?? 1) + 1)
  const [choiceSel, setChoiceSel] = useState<Record<string, string>>({})

  const currentLevel = classInfo?.level ?? 0
  const baseGrants = classDef
    ? grantsForLevelRange(classDef, classInfo?.subclassId, currentLevel, targetLevel)
    : { features: [], choices: [] }
  const subclassChoice = baseGrants.choices.find((ch) => ch.kind === 'subclass')
  const newSubclassId = subclassChoice ? (choiceSel[subclassChoice.id] ?? classInfo?.subclassId) : classInfo?.subclassId

  // Every hook has to run on the unresolved render too. classDef appears and
  // disappears as packs load, get removed or get repinned, and a hook placed
  // after the early return below changes the hook count between those renders.
  const featureIds = useMemo(
    () => (classDef ? grantsForLevelRange(classDef, newSubclassId, currentLevel, targetLevel).features : []),
    [classDef, newSubclassId, currentLevel, targetLevel],
  )

  /**
   * What this level-up will do to the resources it governs -- hit dice, plus
   * whatever pools the class table defines. Rows that do not move are listed
   * rather than hidden: "Moxie stays at 2 from level 2 to 3" is a real answer,
   * and showing nothing instead reads as the feature being broken.
   */
  const poolPreview = useMemo(() => {
    if (!classDef) return []
    const governed = new Set(['hit-dice', ...(classDef.pools ?? []).map((p) => p.id)])
    return mergePools(
      c.resources.map((r) => (r.id === 'hit-dice' ? { ...r, max: targetLevel } : r)),
      poolsAtLevel(classDef, targetLevel),
    )
      .filter((r) => governed.has(r.id))
      .map((r) => ({ id: r.id, name: r.name, before: c.resources.find((x) => x.id === r.id)?.max ?? null, after: r.max }))
  }, [classDef, c.resources, targetLevel])

  if (!classInfo || !classDef) {
    // "Isn't installed" was the message for both failures, and it is wrong the
    // moment a pack is upgraded underneath a character -- the file is right
    // there, and the fix is a repin rather than a hunt for a missing download.
    const pinned = classInfo && pinStates(installed, c.packs)
      .find((s) => s.pin.packId === classInfo.classRef.split(':')[0])
    const unresolvedReason = !classInfo
      ? 'This character wasn\'t built from a pack -- nothing to level up automatically.'
      : pinned?.state === 'version-mismatch'
        ? `This character pins ${pinned.pin.packId} ${pinned.pin.version}, but ${pinned.available.join(', ')} is installed. Repin it under Rules packs in the editor.`
        : 'This class\'s pack isn\'t installed, so its level table can\'t be resolved.'

    return (
      <div className="overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <span className="panel-title">Level up</span>
            <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={onClose}>Close</button>
          </div>
          <div className="modal-body">
            <p className="muted" style={{ fontSize: '0.8125rem' }}>{unresolvedReason}</p>
          </div>
        </div>
      </div>
    )
  }

  const packId = classInfo.classRef.split(':')[0]!

  const canApply = targetLevel > classInfo.level && targetLevel <= 20 && baseGrants.choices.every((ch) => choiceSel[ch.id])

  const applyLevelUp = () => {
    const newFeatures: FeatureEntry[] = featureIds
      .map((id): FeatureEntry | null => {
        const fqid = `${packId}:features/${id}`
        const def = index.get(fqid)?.entry as { id: string; name: string; tag: string; sub: string; desc: string } | undefined
        return def ? { id: def.id, name: def.name, tag: def.tag, sub: def.sub, desc: def.desc, ref: fqid } : null
      })
      .filter((f): f is FeatureEntry => f !== null)

    apply({
      label: `Level up ${classInfo.level} -> ${targetLevel}`,
      channel: 'edit',
      mutate: (doc) => ({
        ...doc,
        level: targetLevel,
        classLine: doc.classLine.replace(`${classDef.name} ${classInfo.level}`, `${classDef.name} ${targetLevel}`),
        proficiencyBonus: suggestedProficiency(targetLevel),
        classes: [{ ...classInfo, level: targetLevel, subclassId: newSubclassId }],
        features: [...doc.features, ...newFeatures],
        resources: mergePools(
          doc.resources.map((r) => (r.id === 'hit-dice' ? { ...r, max: targetLevel } : r)),
          poolsAtLevel(classDef, targetLevel),
        ),
      }),
    })
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="panel-title">Level up -- {classDef.name}</span>
          <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={onClose}>Close</button>
        </div>
        <div className="modal-body">
          <NumField label={`Target level (currently ${classInfo.level})`} value={targetLevel} onChange={setTargetLevel} />

          {baseGrants.features.length > 0 && (
            <div className="card side-card">
              <span className="panel-title">New features</span>
              <p style={{ fontSize: '0.8125rem', margin: 0 }}>{baseGrants.features.join(', ')}</p>
            </div>
          )}

          {poolPreview.length > 0 && (
            <div className="card side-card">
              <span className="panel-title">Resources at level {targetLevel}</span>
              {poolPreview.map((p) => (
                <p key={p.id} style={{ fontSize: '0.8125rem', margin: 0 }}>
                  {p.name}{' '}
                  {p.before === null
                    ? <strong>new, {p.after}</strong>
                    : p.before === p.after
                      ? <span className="muted">{p.after}, unchanged</span>
                      : <strong>{p.before} &rarr; {p.after}</strong>}
                </p>
              ))}
            </div>
          )}

          {baseGrants.choices.map((choice) => (
            <ChoicePicker
              key={choice.id}
              choice={choice}
              selected={choiceSel[choice.id] ?? null}
              onSelect={(optionId) => setChoiceSel((s) => ({ ...s, [choice.id]: optionId }))}
            />
          ))}

          <button className="btn primary" onClick={applyLevelUp} disabled={!canApply}>
            Apply level up
          </button>
        </div>
      </div>
    </div>
  )
}
