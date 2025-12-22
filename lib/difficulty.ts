export type DifficultyLevel = 'Low' | 'Medium' | 'High' | 'Extreme'

export const DIFFICULTY_LEVELS: DifficultyLevel[] = ['Low', 'Medium', 'High', 'Extreme']

export function getDifficultyLevel(numericValue: number): DifficultyLevel {
  if (numericValue <= 3) return 'Low'
  if (numericValue <= 6) return 'Medium'
  if (numericValue <= 9) return 'High'
  return 'Extreme'
}

export function getDifficultyColor(level: DifficultyLevel): string {
  switch (level) {
    case 'Low':
      return 'text-green-600 bg-green-50 border-green-200'
    case 'Medium':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    case 'High':
      return 'text-red-600 bg-red-50 border-red-200'
    case 'Extreme':
      return 'text-purple-600 bg-purple-50 border-purple-200'
  }
}

export function difficultyLevelToNumber(level: DifficultyLevel): number {
  switch (level) {
    case 'Low':
      return 2
    case 'Medium':
      return 5
    case 'High':
      return 8
    case 'Extreme':
      return 10
  }
}
