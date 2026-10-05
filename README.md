# OneSmallPhoto

The photography portfolio of Joshua Small, made in the North Carolina Triad (Greensboro, High
Point and Winston-Salem).

This is a personal, non-commercial site: no prices, packages or booking offers. It runs entirely
on free tiers with no card on file.

## Stack

| Layer     | Tool                                               |
| --------- | -------------------------------------------------- |
| Framework | Astro with React islands, TypeScript               |
| Styling   | Tailwind CSS v4                                    |
| Motion    | GSAP (ScrollTrigger, Flip) and Lenis               |
| Hosting   | Vercel Hobby                                       |
| Database  | Neon Postgres with Drizzle ORM (next phase)        |
| Photos    | Backblaze B2, resized in the browser (next phase)  |
| CI        | GitHub Actions: format, lint, type check and build |

## Develop

Requires Node 22.12 or newer.

```sh
npm install
npm run dev      # http://localhost:4321
```

| Command           | What it does                    |
| ----------------- | ------------------------------- |
| `npm run dev`     | Start the dev server            |
| `npm run build`   | Build for production            |
| `npm run preview` | Preview the production build    |
| `npm run check`   | Type check Astro and TypeScript |
| `npm run lint`    | Lint with ESLint                |
| `npm run format`  | Format with Prettier            |

## Deploy

Import this repo into Vercel. Every pull request gets a preview URL, and merges to `main`
deploy to production. Secrets (database URL, B2 keys) go in Vercel's environment variables;
see `.env.example` for the names. Never commit them.
