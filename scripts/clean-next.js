/*
  Clean Next.js build artifacts.
  Windows-friendly: if `.next` is locked, rename it.
*/

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const nextDir = path.join(root, '.next');

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '_' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
}

try {
  if (!exists(nextDir)) {
    console.log('clean: .next not found');
    process.exit(0);
  }

  try {
    rmrf(nextDir);
    console.log('clean: removed .next');
  } catch (err) {
    const lockedName = `.next_locked_${timestamp()}`;
    const lockedPath = path.join(root, lockedName);

    try {
      fs.renameSync(nextDir, lockedPath);
      console.log(`clean: .next was locked, renamed to ${lockedName}`);
    } catch (renameErr) {
      console.error('clean: .next is locked by a running process.');
      console.error('clean: close `next dev` (or any Node process using this folder) and run again.');
      console.error('clean: if you want an automatic fix on Windows, run: npm run clean:hard');
      process.exit(1);
    }
  }
} catch (err) {
  console.error('clean: unexpected error');
  console.error(err);
  process.exit(1);
}
