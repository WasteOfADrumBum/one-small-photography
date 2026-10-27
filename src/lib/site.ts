/**
 * Site facts shared across pages. Change them here, not in page copy.
 *
 * This is a personal, non-commercial portfolio (Vercel Hobby plan): no prices,
 * packages or booking offers belong anywhere on the site.
 */
export const site = {
  name: 'OneSmallPhoto',
  owner: 'Joshua Small',
  tagline: 'Photography is how I live, not how I make a living.',
  triadCities: ['Greensboro', 'High Point', 'Winston-Salem'],
  shootingSince: 2010,
} as const;

export const nav = [
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/the-triad', label: 'The Triad' },
  { href: '/contact', label: 'Contact' },
] as const;

/**
 * Pages linked from the footer only. Under the hood shows how the site is
 * built, which is for people curious about the code, not the photographs.
 */
export const footerNav = [{ href: '/under-the-hood', label: 'Under the hood' }] as const;
