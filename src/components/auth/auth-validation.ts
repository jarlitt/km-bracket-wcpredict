export const OFFICE_COUNTRIES = [
  { slug: 'spain', label: 'Spain Office' },
  { slug: 'malta', label: 'Malta Office' },
  { slug: 'nigeria', label: 'Nigeria Office' },
  { slug: 'south-africa', label: 'South Africa Office' },
  { slug: 'zambia', label: 'Zambia Office' },
  { slug: 'uk', label: 'UK Office' },
] as const

export type OfficeCountrySlug = (typeof OFFICE_COUNTRIES)[number]['slug']

export function isOfficeCountrySlug(value: string): value is OfficeCountrySlug {
  return OFFICE_COUNTRIES.some((c) => c.slug === value)
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validateSignupFields({
  displayName,
  email,
  password,
  country,
}: {
  displayName: string
  email: string
  password: string
  country: string
}): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!displayName) errors.name = 'Name is required'
  if (!email) errors.email = 'Email is required'
  else if (!isValidEmail(email)) errors.email = 'Enter a valid email address'
  if (!password) errors.password = 'Password is required'
  else if (password.length < 6) errors.password = 'Must be at least 6 characters'
  if (!country) errors.country = 'Office country is required'
  else if (!isOfficeCountrySlug(country)) errors.country = 'Select a valid office country'
  return errors
}
