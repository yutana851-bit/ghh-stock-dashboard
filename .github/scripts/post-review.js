
// Turns Bob's `--format json` result into a Markdown PR comment.
//
//   node post-review.js bob-result.json review.md
//
// Never throws away a failure: if Bob did not finish, the comment says so
// instead of staying silent (a silent reviewer looks the same as "no problems").

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const MARKER = '<!-- bob-review -->';

// Bob prints one JSON object. If anything else sneaks onto stdout first,
// fall back to the last line that is a JSON object.
export function parseResult(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    for (const line of raw.trim().split('\n').reverse()) {
      if (!line.trim().startsWith('{')) continue;
      try { return JSON.parse(line); } catch { /* keep looking */ }
    }
    return null;
  }
}

export function buildComment(raw) {
  const result = parseResult(raw);
  if (!result) {
    return `${MARKER}\n### Bob review\n\n⚠️ Bob did not finish, so this PR has **not** been reviewed. The run produced no readable result. Check the Actions log and re-run the job.`;
  }

  const message = typeof result.last_message === 'string' ? result.last_message.trim() : '';
  if (result.status !== 'success' || !message) {
    return `${MARKER}\n### Bob review\n\n⚠️ Bob did not finish (status: \`${result.status ?? 'unknown'}\`), so this PR has **not** been reviewed. Check the Actions log and re-run the job.`;
  }

  const cost = result.stats?.session_costs;
  const footer = cost !== undefined && cost !== null ? `\n\n<sub>Reviewed by IBM Bob Shell. Cost: ${typeof cost === 'object' ? JSON.stringify(cost) : cost} Bobcoins.</sub>` : '\n\n<sub>Reviewed by IBM Bob Shell.</sub>';
  return `${MARKER}\n${message}${footer}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , input, output] = process.argv;
  if (!input || !output) {
    console.error('Usage: node post-review.js bob-result.json review.md');
    process.exit(2);
  }
  let raw = '';
  try { raw = readFileSync(input, 'utf8'); } catch { /* handled as "no result" */ }
  writeFileSync(output, buildComment(raw) + '\n');
  console.log(`Wrote ${output}`);
}
