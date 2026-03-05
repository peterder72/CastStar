export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function isSelfAppearanceRole(role?: string): boolean {
  if (!role) {
    return false
  }

  const normalized = role.toLowerCase().trim()
  return /\b(self|himself|herself|themselves)\b/.test(normalized)
}
