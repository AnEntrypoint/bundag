#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('=== 10-EPOCH SUPERVISED TEST HARNESS ===\n');
const testStart = Date.now();

try {
  console.log('Starting: node --expose-gc run-10-epochs.js');
  console.log('Expected: ~5 minutes for 10 epochs\n');

  const output = execSync('node --expose-gc run-10-epochs.js', {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 600000,
    stdio: 'inherit'
  });

  const elapsed = Math.round((Date.now() - testStart) / 1000);
  console.log(`\n✓ Test completed in ${elapsed}s`);
  process.exit(0);

} catch (e) {
  const elapsed = Math.round((Date.now() - testStart) / 1000);
  console.error(`\n✗ Test failed after ${elapsed}s`);
  console.error(`Exit code: ${e.status}`);

  if (e.message.includes('timeout')) {
    console.error('ERROR: Test timeout (600s exceeded)');
  }

  process.exit(1);
}
