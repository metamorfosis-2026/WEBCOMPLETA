const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

const root = process.cwd();
const envLocalPath = path.join(root, '.env.local');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: false });
}

const prismaCliPath = require.resolve('prisma/build/index.js');
const result = spawnSync(process.execPath, [prismaCliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
