// Decides what a build may do to the database, from the build's environment
// alone. Kept apart from scripts/migrate.mjs so tests can cover every case.

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ action: 'migrate' | 'skip' | 'fail', message: string }}
 */
export function migrationPlan(env) {
  const vercelEnv = env.VERCEL_ENV;
  const url = env.DATABASE_URL;

  if (vercelEnv && vercelEnv !== 'production') {
    // Today previews get no DATABASE_URL at all (it is set for Production only),
    // so they can't reach the real data. If one ever appears on a preview, the
    // build stops unless someone has said it is a separate database.
    if (url && env.PREVIEW_DATABASE_ISOLATED !== 'true') {
      return {
        action: 'fail',
        message:
          `This ${vercelEnv} build can see a DATABASE_URL. Previews must not use the production ` +
          'database: remove DATABASE_URL from the Preview environment in Vercel, or, if it is a ' +
          'separate preview database, also set PREVIEW_DATABASE_ISOLATED=true for Preview.',
      };
    }
    return {
      action: 'skip',
      message: `Skipping database migrations on a ${vercelEnv} build; only production builds migrate.`,
    };
  }

  if (!url) {
    return {
      action: 'fail',
      message: 'DATABASE_URL is not set; add it in Vercel project settings (Production).',
    };
  }
  if (!/^postgres(ql)?:\/\//.test(url)) {
    return { action: 'fail', message: 'DATABASE_URL is not a postgres:// connection string.' };
  }
  return { action: 'migrate', message: 'Applying database migrations.' };
}
