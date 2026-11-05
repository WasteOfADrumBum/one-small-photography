// Opens, updates or closes one GitHub issue per alert kind, so a failing
// production check reaches the owner as an issue notification (and email, if
// their GitHub settings send one) without a new issue on every failed run.
//
//   node scripts/ci/alert-issue.mjs open  <kind> "<title>" "<details>"
//   node scripts/ci/alert-issue.mjs close <kind> "<details>"
//
// Needs GITHUB_TOKEN (issues: write) and GITHUB_REPOSITORY.
const [action, kind, ...rest] = process.argv.slice(2);
const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
if (!token || !repo || !['open', 'close'].includes(action) || !kind) {
  console.error(
    'usage: alert-issue.mjs open|close <kind> ...  (GITHUB_TOKEN and GITHUB_REPOSITORY required)',
  );
  process.exit(2);
}
const label = 'production-alert';
const marker = `<!-- alert:${kind} -->`;
const api = async (path, init = {}) => {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok)
    throw new Error(`${init.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

const open = (await api(`/issues?state=open&labels=${label}&per_page=50`)).filter((i) =>
  i.body?.includes(marker),
);
const runUrl = `${process.env.GITHUB_SERVER_URL}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`;

if (action === 'open') {
  const [title, details = ''] = rest;
  const body = `${details}\n\nRun: ${runUrl}`;
  if (open[0]) {
    // Already reported: one comment per further failure, no new issue.
    await api(`/issues/${open[0].number}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body: `Still failing.\n\n${body}` }),
    });
    console.log(`Updated alert issue #${open[0].number}.`);
  } else {
    const issue = await api('/issues', {
      method: 'POST',
      body: JSON.stringify({
        title,
        labels: [label],
        body: `${marker}\n${body}\n\nThis issue closes itself when the check passes again.`,
      }),
    });
    console.log(`Opened alert issue #${issue.number}.`);
  }
} else {
  const [details = 'The check passes again.'] = rest;
  for (const issue of open) {
    await api(`/issues/${issue.number}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body: `${details}\n\nRun: ${runUrl}` }),
    });
    await api(`/issues/${issue.number}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
    });
    console.log(`Closed alert issue #${issue.number}.`);
  }
}
