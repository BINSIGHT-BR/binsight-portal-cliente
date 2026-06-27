#!/usr/bin/env node
/**
 * Injeta chave JSON da service account em functions/.env (GMAIL_SERVICE_ACCOUNT_JSON).
 * Uso: node scripts/inject-gmail-sa-env.mjs ~/Downloads/comercial-binsight-xxxxx.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const keyPath = process.argv[2];

if (!keyPath) {
  console.error('Uso: node scripts/inject-gmail-sa-env.mjs /caminho/para/chave.json');
  process.exit(1);
}

if (!existsSync(keyPath)) {
  console.error('Arquivo não encontrado:', keyPath);
  process.exit(1);
}

const json = readFileSync(keyPath, 'utf8');
const creds = JSON.parse(json);
if (!creds.client_email || !creds.private_key) {
  console.error('JSON inválido — precisa client_email e private_key.');
  process.exit(1);
}

const envPath = join(root, 'functions/.env');
let env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';

// Corrige linha colada (ex.: GMAIL_DELEGATED_USER=...GMAIL_SERVICE_ACCOUNT_JSON=...)
env = env.replace(
  /^(GMAIL_DELEGATED_USER=[^\n]*?)GMAIL_SERVICE_ACCOUNT_JSON=/m,
  '$1\nGMAIL_SERVICE_ACCOUNT_JSON='
);

const line = `GMAIL_SERVICE_ACCOUNT_JSON=${JSON.stringify(json)}`;

if (/^GMAIL_SERVICE_ACCOUNT_JSON=/m.test(env)) {
  env = env.replace(/^GMAIL_SERVICE_ACCOUNT_JSON=.*$/m, line);
} else {
  if (env.length && !env.endsWith('\n')) env += '\n';
  env += line + '\n';
}

writeFileSync(envPath, env, 'utf8');
console.log('OK — GMAIL_SERVICE_ACCOUNT_JSON gravado em functions/.env');
console.log('Service account:', creds.client_email);
console.log('Próximo passo: firebase deploy --only functions:cliente --project comercial-binsight');
