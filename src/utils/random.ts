/**
 * Seeded Random Number Generator
 * Uses Mulberry32 algorithm for deterministic random numbers.
 * Both clients must use the same seed to get identical sequences.
 */

/**
 * Create a seeded random number generator using Mulberry32 algorithm.
 * @param seed - The seed value (shared between clients)
 * @returns A function that returns random numbers between 0 and 1
 */
export function createRNG(seed: number): () => number {
  let state = seed
  return function(): number {
    let t = state += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

/**
 * Generate a cryptographically secure random seed.
 * Used by the host to create a seed that's shared with the guest.
 */
export function generateSeed(): number {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return array[0]
}

/**
 * Generate a cryptographically secure peer ID.
 * Format: snake-[16 hex chars]
 */
export function generatePeerId(): string {
  const array = new Uint8Array(8)
  crypto.getRandomValues(array)
  const hex = Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `snake-${hex}`
}

/**
 * Get random integer in range [min, max] using seeded RNG
 */
export function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

/**
 * Pick a random item from an array using seeded RNG
 */
export function randomPick<T>(rng: () => number, array: T[]): T | undefined {
  if (array.length === 0) return undefined
  return array[Math.floor(rng() * array.length)]
}
