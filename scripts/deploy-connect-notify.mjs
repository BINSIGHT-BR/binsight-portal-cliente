#!/usr/bin/env node
/**
 * Deploy Connect Notify Apps Script via clasp.
 * Requer: npx @google/clasp login (conta com Apps Script API ativa)
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const deployDir = join(root, 'apps-script/deploy/connect-notify');
const gsPath = join(deployDir, 'ConnectNotify.gs');
const envProd = join(root, '.env.production');
const PLACEHOLDER = '___NOTIFY_SECRET_PLACEHOLDER___';

function run(cmd, cwd = deployDir) {
  console.log('>', cmd);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

const secret =
  process.env.NOTIFY_SECRET?.trim() ||
  (existsSync(envProd)
    ? readFileSync(envProd, 'utf8').match(/^VITE_NOTIFY_SECRET=(.+)$/m)?.[1]?.trim()
    : '') ||
  randomBytes(24).toString('hex');

let gs = readFileSync(gsPath, 'utf8');
if (!gs.includes(PLACEHOLDER)) {
  console.error(`ConnectNotify.gs must contain ${PLACEHOLDER}`);
  process.exit(1);
}
gs = gs.replace(PLACEHOLDER, secret);
writeFileSync(gsPath, gs, 'utf8');

try {
  if (!existsSync(join(deployDir, '.clasp.json'))) {
    run(
      'npx -y @google/clasp@latest create --type standalone --title "Connect Notify" --parentId 1ciJ-9TtKvEKiU7AVwKJIVrcnlPQUzxXy'
    );
  }
  run('npx -y @google/clasp@latest push');
  run('npx -y @google/clasp@latest run installNotifySecret');
  run('npx -y @google/clasp@latest deploy --description "Connect Notify v1"');
  const deployments = execSync('npx -y @google/clasp@latest list-deployments', {
    cwd: deployDir,
    encoding: 'utf8',
  });
  const match = deployments.match(/AKfyc[a-zA-Z0-9_-]+/);
  const webappUrl = match
    ? `https://script.google.com/macros/s/${match[0]}/exec`
    : '';
  console.log('\nWeb App URL:', webappUrl || '(copie em Implantações no editor Apps Script)');
  console.log('NOTIFY_SECRET:', secret);

  if (existsSync(envProd)) {
    let env = readFileSync(envProd, 'utf8');
    env = env.replace(/^VITE_NOTIFY_SECRET=.*$/m, `VITE_NOTIFY_SECRET=${secret}`);
    if (webappUrl) {
      env = env.replace(/^VITE_NOTIFY_WEBAPP_URL=.*$/m, `VITE_NOTIFY_WEBAPP_URL=${webappUrl}`);
    }
    writeFileSync(envProd, env, 'utf8');
    console.log('Atualizado .env.production');
  }
} finally {
  gs = readFileSync(gsPath, 'utf8').replace(secret, PLACEHOLDER);
  writeFileSync(gsPath, gs, 'utf8');
}
