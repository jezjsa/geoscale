import { Check, X } from 'lucide-react'

interface PasswordRequirement {
  label: string
  met: boolean
}

interface PasswordStrengthMeterProps {
  password: string
}

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
    { label: 'One special character (!@#$%^&*)', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ]
}

export function isPasswordStrong(password: string): boolean {
  const requirements = getPasswordRequirements(password)
  return requirements.every(req => req.met)
}

export function getPasswordStrength(password: string): { label: string; color: string; percent: number } {
  const requirements = getPasswordRequirements(password)
  const metCount = requirements.filter(req => req.met).length
  
  if (metCount === 0) return { label: '', color: 'bg-gray-200', percent: 0 }
  if (metCount <= 2) return { label: 'Weak', color: 'bg-red-500', percent: 25 }
  if (metCount <= 3) return { label: 'Fair', color: 'bg-orange-500', percent: 50 }
  if (metCount <= 4) return { label: 'Good', color: 'bg-yellow-500', percent: 75 }
  return { label: 'Strong', color: 'bg-green-500', percent: 100 }
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const requirements = getPasswordRequirements(password)
  const strength = getPasswordStrength(password)
  
  if (!password) return null
  
  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${strength.color}`}
            style={{ width: `${strength.percent}%` }}
          />
        </div>
        {strength.label && (
          <span className={`text-xs font-medium ${
            strength.percent <= 25 ? 'text-red-600' :
            strength.percent <= 50 ? 'text-orange-600' :
            strength.percent <= 75 ? 'text-yellow-600' :
            'text-green-600'
          }`}>
            {strength.label}
          </span>
        )}
      </div>
      
      {/* Requirements checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {requirements.map((req, index) => (
          <div key={index} className="flex items-center gap-1.5 text-xs">
            {req.met ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <X className="h-3 w-3 text-gray-400" />
            )}
            <span className={req.met ? 'text-green-600' : 'text-muted-foreground'}>
              {req.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
