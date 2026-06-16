#!/usr/bin/env node
/**
 * Builds a standalone `loxone` executable via Node's Single Executable Applications
 * (SEA), so the CLI runs with no separate Node install. Run `npm run build` first
 * (this consumes the bundled CJS entry dist/cli.cjs).
 *
 *   npm run build:binary   →   dist/loxone   (or dist/loxone.exe on Windows)
 *
 * Linux/Windows need only `postject` (fetched via npx). macOS additionally requires
 * stripping + re-signing the copied binary (codesign) — see the Node SEA docs.
 */
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync } from 'node:fs';

const isWindows = process.platform === 'win32';
const output = isWindows ? 'dist/loxone.exe' : 'dist/loxone';
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });

console.log('1/3  generating the SEA blob…');
run(process.execPath, ['--experimental-sea-config', 'sea-config.json']);

console.log(`2/3  copying the Node runtime → ${output}…`);
copyFileSync(process.execPath, output);

console.log('3/3  injecting the blob (postject)…');
const isMac = process.platform === 'darwin';
// macOS verifies the signature, which postject invalidates — strip it first, re-sign after.
if (isMac) run('codesign', ['--remove-signature', output]);
const postjectArgs = [output, 'NODE_SEA_BLOB', 'dist/sea-prep.blob', '--sentinel-fuse', FUSE];
if (isMac) postjectArgs.push('--macho-segment-name', 'NODE_SEA');
run('npx', ['--yes', 'postject', ...postjectArgs]);
if (isMac) run('codesign', ['--sign', '-', output]); // ad-hoc sign so macOS will run it
if (!isWindows) chmodSync(output, 0o755);

console.log(`\n✓ Built ${output} — a self-contained CLI (no Node install required).`);
