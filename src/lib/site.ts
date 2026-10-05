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
  homeBase: 'Trinity, NC',
  triadCities: ['Greensboro', 'High Point', 'Winston-Salem'],
  shootingSince: 2010,
} as const;

export const nav = [
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/the-triad', label: 'The Triad' },
  { href: '/under-the-hood', label: 'Under the hood' },
  { href: '/contact', label: 'Contact' },
] as const;
