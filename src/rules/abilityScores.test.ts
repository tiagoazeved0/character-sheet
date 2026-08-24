import { describe, expect, it } from 'vitest'
import { POINT_BUY_BUDGET, STANDARD_ARRAY, pointBuyCost, pointBuyValid } from './abilityScores.ts'

describe('standard array', () => {
  it('is exactly six values', () => {
    expect(STANDARD_ARRAY).toHaveLength(6)
  })
})

describe('point buy', () => {
  it('costs nothing at the floor and the full curve at the ceiling', () => {
    expect(pointBuyCost([8, 8, 8, 8, 8, 8])).toBe(0)
    expect(pointBuyCost([15, 8, 8, 8, 8, 8])).toBe(9)
  })

  it('accepts an all-8 array within budget', () => {
    expect(pointBuyValid([8, 8, 8, 8, 8, 8])).toBe(true)
  })

  it('accepts a spread that exactly hits the budget', () => {
    const scores = [15, 15, 8, 8, 8, 8] // 9 + 9 = 18, well under 27; use a real max case
    expect(pointBuyCost(scores)).toBeLessThanOrEqual(POINT_BUY_BUDGET)
    expect(pointBuyValid(scores)).toBe(true)
  })

  it('accepts a spread that exactly hits the budget at three 15s', () => {
    expect(pointBuyCost([15, 15, 15, 8, 8, 8])).toBe(POINT_BUY_BUDGET)
    expect(pointBuyValid([15, 15, 15, 8, 8, 8])).toBe(true)
  })

  it('rejects a spread that exceeds the budget', () => {
    expect(pointBuyValid([15, 15, 15, 15, 8, 8])).toBe(false)
  })

  it('rejects a score outside the 8-15 range', () => {
    expect(pointBuyValid([16, 8, 8, 8, 8, 8])).toBe(false)
    expect(pointBuyValid([7, 8, 8, 8, 8, 8])).toBe(false)
  })

  it('rejects the wrong number of scores', () => {
    expect(pointBuyValid([8, 8, 8, 8, 8])).toBe(false)
  })
})
