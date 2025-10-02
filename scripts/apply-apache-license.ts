#!/usr/bin/env bun

/**
 * Script to apply Apache 2.0 license compliance to the prompt-tool codebase
 *
 * This script:
 * 1. Downloads Apache 2.0 LICENSE file (if not exists)
 * 2. Adds SPDX headers to all TypeScript files (src/, scripts/, root-level)
 * 3. Updates package.json with Apache-2.0 license
 * 4. Verifies LICENSE is included in package files
 */

import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const SPDX_HEADER = `// SPDX-License-Identifier: Apache-2.0
// Copyright 2025 Interaktiv GmbH

`;

const LICENSE_URL = 'https://www.apache.org/licenses/LICENSE-2.0.txt';
const PROJECT_ROOT = resolve(join(import.meta.dir, '..'));
const LICENSE_PATH = join(PROJECT_ROOT, 'LICENSE');
const PACKAGE_JSON_PATH = join(PROJECT_ROOT, 'package.json');
const SRC_DIR = join(PROJECT_ROOT, 'src');
const SCRIPTS_DIR = join(PROJECT_ROOT, 'scripts');

// Root-level TypeScript files that need headers
const ROOT_TS_FILES = [
  join(PROJECT_ROOT, 'drizzle.config.ts')
];

/**
 * Recursively get all .ts files in a directory
 * IMPORTANT: Only processes files within the specified directory
 */
function getTsFiles(dir: string): string[] {
  const files: string[] = [];
  const resolvedDir = resolve(dir);

  // Safety check: ensure we're within project root
  if (!resolvedDir.startsWith(PROJECT_ROOT)) {
    throw new Error(`Security error: Attempted to access directory outside project: ${dir}`);
  }

  // Skip node_modules
  if (resolvedDir.includes('node_modules')) {
    return files;
  }

  const entries = readdirSync(dir);
  for (const entry of entries) {
    // Skip hidden files and node_modules
    if (entry.startsWith('.') || entry === 'node_modules') {
      continue;
    }

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getTsFiles(fullPath));
    } else if (entry.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check if file already has SPDX header
 */
function hasSpdxHeader(content: string): boolean {
  return content.includes('SPDX-License-Identifier: Apache-2.0');
}

/**
 * Add SPDX header to file
 */
function addSpdxHeader(filePath: string, allowedDirs: string[]): boolean {
  // Safety check: ensure file is within allowed directories
  const resolvedPath = resolve(filePath);
  const isAllowed = allowedDirs.some(dir => resolvedPath.startsWith(dir));

  if (!isAllowed) {
    throw new Error(`Security error: Attempted to modify file outside allowed dirs: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf-8');

  if (hasSpdxHeader(content)) {
    return false; // Already has header
  }

  const newContent = SPDX_HEADER + content;
  writeFileSync(filePath, newContent, 'utf-8');
  return true;
}

/**
 * Download LICENSE file
 */
async function downloadLicense(): Promise<boolean> {
  if (existsSync(LICENSE_PATH)) {
    console.log('✓ LICENSE file already exists');
    return false;
  }

  console.log('Downloading Apache 2.0 license text...');
  const response = await fetch(LICENSE_URL);

  if (!response.ok) {
    throw new Error(`Failed to download LICENSE: ${response.statusText}`);
  }

  const licenseText = await response.text();
  writeFileSync(LICENSE_PATH, licenseText, 'utf-8');
  console.log('✓ LICENSE file created');
  return true;
}

/**
 * Update package.json with Apache-2.0 license
 */
function updatePackageJson(): boolean {
  const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));

  if (packageJson.license === 'Apache-2.0') {
    console.log('✓ package.json already has Apache-2.0 license');
    return false;
  }

  packageJson.license = 'Apache-2.0';

  // Ensure LICENSE is included in package files
  if (!packageJson.files) {
    packageJson.files = [];
  }

  if (!packageJson.files.includes('LICENSE')) {
    packageJson.files.push('LICENSE');
  }

  writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
  console.log('✓ package.json updated with Apache-2.0 license');
  return true;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔧 Applying Apache 2.0 license compliance to Kyra\n');

  // Step 1: Download LICENSE
  console.log('Step 1: LICENSE file');
  await downloadLicense();
  console.log();

  // Step 2: Add SPDX headers to source files
  console.log('Step 2: SPDX headers in TypeScript files');
  console.log(`  Scanning: ${SRC_DIR}`);
  console.log(`  Scanning: ${SCRIPTS_DIR}`);
  console.log(`  Scanning: Root-level files`);

  const allowedDirs = [SRC_DIR, SCRIPTS_DIR, PROJECT_ROOT];
  const srcFiles = getTsFiles(SRC_DIR);
  const scriptFiles = existsSync(SCRIPTS_DIR) ? getTsFiles(SCRIPTS_DIR) : [];

  // Filter root files to only existing ones
  const rootFiles = ROOT_TS_FILES.filter(f => existsSync(f));

  const allFiles = [...srcFiles, ...scriptFiles, ...rootFiles];

  let filesUpdated = 0;

  for (const file of allFiles) {
    const relativePath = file.replace(PROJECT_ROOT + '/', '');
    const updated = addSpdxHeader(file, allowedDirs);

    if (updated) {
      console.log(`  ✓ Added header to ${relativePath}`);
      filesUpdated++;
    } else {
      console.log(`  - Skipped ${relativePath} (already has header)`);
    }
  }

  console.log(`\n  Updated ${filesUpdated}/${allFiles.length} files`);
  console.log();

  // Step 3: Update package.json
  console.log('Step 3: package.json');
  updatePackageJson();
  console.log();

  // Summary
  console.log('✅ Apache 2.0 compliance applied successfully!\n');
  console.log('Files modified:');
  console.log('  - LICENSE (if new)');
  console.log(`  - ${filesUpdated} TypeScript files (src/, scripts/, root-level)`);
  console.log('  - package.json');
  console.log();
  console.log('Next steps:');
  console.log('  1. Review changes: git diff');
  console.log('  2. Commit: git add -A && git commit -m "Add Apache 2.0 license"');
  console.log('  3. Push to remote repository');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
