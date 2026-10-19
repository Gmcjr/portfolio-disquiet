// The one secret scan (CI and the pre-commit hook). With file arguments it scans
// those files; with none, every tracked file plus the built site in dist/.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { findSecrets } from './secrets/find';

const SKIP = new Set(['bun.lock']);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const args = process.argv.slice(2);
const targets =
  args.length > 0
    ? args
    : [
        ...execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n'),
        ...(existsSync('dist') ? walk('dist') : []),
      ];

let found = false;
for (const file of targets) {
  if (
    file === '' ||
    SKIP.has(file) ||
    !existsSync(file) ||
    statSync(file).isDirectory()
  ) {
    continue;
  }
  for (const line of findSecrets(readFileSync(file, 'utf8'))) {
    console.log(`${file}:${line} possible Resend API key`);
    found = true;
  }
}
if (found) process.exit(1);
