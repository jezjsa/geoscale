export interface PasswordStrength {
  score: number // 0-4
  label: string
  color: string
}

export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: '', color: 'bg-gray-200' }
  }

  let score = 0
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
  }

  // Calculate score
  if (checks.length) score++
  if (checks.lowercase) score++
  if (checks.uppercase) score++
  if (checks.number) score++
  if (checks.special) score++

  // Normalize to 0-4 scale
  const normalizedScore = Math.min(4, Math.floor((score / 5) * 4))

  const strengthLevels = [
    { label: 'Very Weak', color: 'bg-red-500' },
    { label: 'Weak', color: 'bg-orange-500' },
    { label: 'Fair', color: 'bg-yellow-500' },
    { label: 'Good', color: 'bg-blue-500' },
    { label: 'Strong', color: 'bg-green-500' },
  ]

  return {
    score: normalizedScore,
    label: strengthLevels[normalizedScore].label,
    color: strengthLevels[normalizedScore].color,
  }
}

