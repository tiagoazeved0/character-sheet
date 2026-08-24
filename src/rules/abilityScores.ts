/** 2024 rules: standard array, and point buy's 27-point budget over an 8-15 pre-racial range. */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const

const POINT_BUY_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }
export const POINT_BUY_BUDGET = 27
export const POINT_BUY_MIN = 8
export const POINT_BUY_MAX = 15

export function pointBuyCost(scores: number[]): number {
  return scores.reduce((sum, s) => sum + (POINT_BUY_COST[s] ?? Infinity), 0)
}

export function pointBuyValid(scores: number[]): boolean {
  if (scores.length !== 6) return false
  if (scores.some((s) => !(s in POINT_BUY_COST))) return false
  return pointBuyCost(scores) <= POINT_BUY_BUDGET
}
