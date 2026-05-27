/**
 * Maps external API team names (ESPN, API-Football) to our internal team IDs.
 * Used by the sync-results route to translate API responses.
 *
 * Add new name variants here whenever an API returns an unrecognized team name.
 */

export const TEAM_NAME_TO_ID: Record<string, number> = {
  'Mexico': 1,
  'South Africa': 2,
  'Korea Republic': 3, 'South Korea': 3,
  'Czechia': 4, 'Czech Republic': 4,
  'Canada': 5,
  'Bosnia and Herzegovina': 6, 'Bosnia & Herzegovina': 6, 'Bosnia-Herzegovina': 6,
  'Qatar': 7,
  'Switzerland': 8,
  'Brazil': 9,
  'Morocco': 10,
  'Haiti': 11,
  'Scotland': 12,
  'USA': 13, 'United States': 13,
  'Paraguay': 14,
  'Australia': 15,
  'Türkiye': 16, 'Turkey': 16,
  'Germany': 17,
  'Curaçao': 18, 'Curacao': 18,
  "Côte d'Ivoire": 19, 'Ivory Coast': 19, "Cote D'Ivoire": 19,
  'Ecuador': 20,
  'Netherlands': 21,
  'Japan': 22,
  'Sweden': 23,
  'Tunisia': 24,
  'Belgium': 25,
  'Egypt': 26,
  'IR Iran': 27, 'Iran': 27,
  'New Zealand': 28,
  'Spain': 29,
  'Cabo Verde': 30, 'Cape Verde': 30,
  'Saudi Arabia': 31,
  'Uruguay': 32,
  'France': 33,
  'Senegal': 34,
  'Iraq': 35,
  'Norway': 36,
  'Argentina': 37,
  'Algeria': 38,
  'Austria': 39,
  'Jordan': 40,
  'Portugal': 41,
  'Congo DR': 42, 'DR Congo': 42, 'Congo': 42,
  'Uzbekistan': 43,
  'Colombia': 44,
  'England': 45,
  'Croatia': 46,
  'Ghana': 47,
  'Panama': 48,
}

export function resolveTeamId(name: string): number | null {
  return TEAM_NAME_TO_ID[name] ?? null
}
