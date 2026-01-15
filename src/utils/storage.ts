import { HIGH_SCORE_KEY } from '../constants'

/**
 * Get high score from localStorage
 * Returns 0 if not found or if localStorage is unavailable
 */
export const getHighScore = (): number => {
  try {
    const stored = localStorage.getItem(HIGH_SCORE_KEY)
    if (stored === null) return 0
    const parsed = parseInt(stored, 10)
    return isNaN(parsed) ? 0 : parsed
  } catch {
    // localStorage unavailable (incognito, quota exceeded, etc.)
    return 0
  }
}

/**
 * Save high score to localStorage
 * Silently fails if localStorage is unavailable
 */
export const setHighScore = (score: number): void => {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, score.toString())
  } catch {
    // localStorage unavailable - silent degradation
  }
}
