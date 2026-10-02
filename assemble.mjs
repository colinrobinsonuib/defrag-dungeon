#!/usr/bin/env node

/**
 * Defrag Dungeon - Workshop Assembler
 *
 * Collects finished rooms from participant forks and compiles them into
 * a sequential dungeon manifest (rooms.json + rooms/<username>/).
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOMS_DIR = path.join(__dirname, 'rooms');
const ROOMS_MANIFEST = path.join(__dirname, 'rooms.json');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function log(msg = '') {
  console.log(msg);
}

function logSuccess(msg) {
  console.log(`  ${colors.green}✔${colors.reset} ${msg}`);
}

function logError(msg) {
  console.log(`  ${colors.red}✖ ${colors.bold}ERROR:${colors.reset} ${msg}`);
}

function logWarning(msg) {
  console.log(`  ${colors.yellow}⚠ ${colors.bold}WARN:${colors.reset} ${msg}`);
}

function parseGitHubUrl(urlStr) {
  const trimmed = urlStr.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  // Support local test notation: "local:alice:./path/to/dist"
  if (trimmed.startsWith('local:')) {
    const parts = trimmed.split(':');
    if (parts.length >= 3) {
      return {
        isLocal: true,
        username: parts[1],
        localPath: parts.slice(2).join(':')
      };
    }
  }

  // Support standard GitHub URLs:
  // https://github.com/alice/defrag-dungeon
  // https://github.com/alice/defrag-dungeon.git
  // git@github.com:alice/defrag-dungeon.git
  const ghRegex = /(?:https:\/\/github\.com\/|git@github\.com:)([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+?)(?:\.git|\/)?$/i;
  const match = trimmed.match(ghRegex);

  if (match) {
    return {
      isLocal: false,
      username: match[1].toLowerCase(),
      repo: match[2],
      url: trimmed
    };
  }

  return {
    isInvalid: true,
    raw: trimmed
  };
}

function getForkUrls() {
  const args = process.argv.slice(2);
  let urls = [];

  if (args.length > 0) {
    // Check if first arg is an existing file (like forks.txt)
    const possibleFile = path.resolve(process.cwd(), args[0]);
    if (fs.existsSync(possibleFile) && fs.statSync(possibleFile).isFile()) {
      const content = fs.readFileSync(possibleFile, 'utf8');
      urls = content.split('\n').map(s => s.trim()).filter(Boolean);
    } else {
      // Treat args as URLs directly
      urls = args;
    }
  } else {
    // Check for default forks.txt in repo root
    const defaultFile = path.join(__dirname, 'forks.txt');
    if (fs.existsSync(defaultFile)) {
      const content = fs.readFileSync(defaultFile, 'utf8');
      urls = content.split('\n').map(s => s.trim()).filter(Boolean);
    }
  }

  return urls;
}

function isDefaultStarterRoom(meta) {
  if (!meta) return false;
  const title = (meta.title || '').trim().toLowerCase();
  const author = (meta.author || '').trim().toLowerCase();
  return title === 'sector 07: memory matrix' && author === 'ada lovelace';
}

function validateAndReadRoom(distDir, username, roomLabel = 'room') {
  // 1. Check directory existence
  if (!fs.existsSync(distDir)) {
    throw new Error(`Directory '${roomLabel}/dist/' does not exist in fork for ${username}.`);
  }

  // 2. Check index.html
  const indexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Missing required entrypoint '${roomLabel}/dist/index.html' for ${username}`);
  }

  const indexContent = fs.readFileSync(indexPath, 'utf8');
  let htmlTitle = '';
  const titleMatch = indexContent.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    htmlTitle = titleMatch[1].trim();
    const quoteMatch = htmlTitle.match(/["'\(]([^"'()]{3,40})["'\)]/);
    if (quoteMatch && htmlTitle.toLowerCase().includes('defrag dungeon')) {
      htmlTitle = quoteMatch[1];
    }
  }

  // 3. Check room.json (synthesize if missing)
  const metaPath = path.join(distDir, 'room.json');
  let metadata = null;
  if (fs.existsSync(metaPath)) {
    try {
      const raw = fs.readFileSync(metaPath, 'utf8');
      metadata = JSON.parse(raw);
    } catch (err) {
      logWarning(`'${roomLabel}/dist/room.json' contains invalid JSON for ${username}. Recovering.`);
    }
  }

  if (!metadata) {
    metadata = {
      title: htmlTitle || `${username} ${roomLabel}`,
      author: username,
      color: '#10b981',
      description: ''
    };
  }

  // If room.json still has starter text, check if index.html was actually customized
  if (isDefaultStarterRoom(metadata)) {
    const isUntouchedStarter = indexContent.includes('Sector 07: Memory Matrix') && indexContent.includes('cell-btn') && !indexContent.includes('Scott');
    if (!isUntouchedStarter && (htmlTitle && !htmlTitle.includes('Sector 07'))) {
      logWarning(`Detected custom game in ${roomLabel} with unedited room.json for ${username}. Auto-repaired as "${htmlTitle}".`);
      metadata.title = htmlTitle;
      metadata.author = username === 'preemcast-source' ? 'Jack' : username;
    }
  }

  if (!metadata.title || typeof metadata.title !== 'string' || !metadata.title.trim()) {
    metadata.title = htmlTitle || `${username} Room`;
  }

  if (!metadata.author || typeof metadata.author !== 'string' || !metadata.author.trim()) {
    metadata.author = username;
  }

  if (!metadata.color || typeof metadata.color !== 'string' || !metadata.color.trim()) {
    metadata.color = '#00f0ff';
  }

  return metadata;
}

function copyFolderRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyFolderRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function run() {
  log(`\n${colors.bold}${colors.cyan}====================================================`);
  log(`  👾 DEFRAG DUNGEON - WORKSHOP ROOM ASSEMBLER`);
  log(`====================================================${colors.reset}\n`);

  const rawEntries = getForkUrls();

  if (rawEntries.length === 0) {
    logWarning('No fork URLs or fork file specified.');
    log(`\n${colors.bold}Usage:${colors.reset}`);
    log(`  node assemble.mjs forks.txt`);
    log(`  node assemble.mjs https://github.com/alice/defrag-dungeon https://github.com/bob/defrag-dungeon`);
    log(`\nOr create a ${colors.bold}forks.txt${colors.reset} file in the root directory listing fork URLs one per line.\n`);
    log(`A sample template is provided at: ${colors.cyan}forks.example.txt${colors.reset}\n`);
    process.exit(1);
  }

  log(`Discovered ${colors.bold}${rawEntries.length}${colors.reset} candidate fork entries.`);
  log(`Target rooms directory: ${colors.dim}${ROOMS_DIR}${colors.reset}\n`);

  if (!fs.existsSync(ROOMS_DIR)) {
    fs.mkdirSync(ROOMS_DIR, { recursive: true });
  }

  const assembledRooms = [];
  const errors = [];
  const tempDirsToClean = [];
  const ROOM_CANDIDATES = ['room-1', 'room-2', 'room-3', 'room-4', 'room-5', 'room'];

  for (let i = 0; i < rawEntries.length; i++) {
    const raw = rawEntries[i];
    const parsed = parseGitHubUrl(raw);

    if (!parsed) continue;

    if (parsed.isInvalid) {
      logError(`Could not parse GitHub repository from URL: "${parsed.raw}"`);
      errors.push({ id: raw, error: 'Invalid URL format' });
      continue;
    }

    const username = parsed.username;
    log(`\n[${i + 1}/${rawEntries.length}] Processing fork: ${colors.bold}${username}${colors.reset} ...`);

    try {
      let repoRootPath = '';

      if (parsed.isLocal) {
        const resolvedLocal = path.resolve(process.cwd(), parsed.localPath);
        // If specified path is directly a dist directory (e.g. ./room-1/dist)
        if (path.basename(resolvedLocal) === 'dist' || fs.existsSync(path.join(resolvedLocal, 'room.json'))) {
          const meta = validateAndReadRoom(resolvedLocal, username, 'custom');
          if (isDefaultStarterRoom(meta)) {
            logWarning(`Excluding default test room "${meta.title}" by ${meta.author} for ${username}`);
            continue;
          }
          const targetRoomDir = path.join(ROOMS_DIR, username);
          if (fs.existsSync(targetRoomDir)) {
            fs.rmSync(targetRoomDir, { recursive: true, force: true });
          }
          copyFolderRecursive(resolvedLocal, targetRoomDir);
          assembledRooms.push({
            id: username,
            title: meta.title,
            author: meta.author,
            color: meta.color,
            description: meta.description || '',
            path: `rooms/${username}/index.html`
          });
          logSuccess(`Imported room: "${meta.title}" by ${meta.author}`);
          continue;
        }
        repoRootPath = resolvedLocal;
        log(`  📁 Reading local source: ${repoRootPath}`);
      } else {
        // Clone into temporary folder using shallow git clone
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `defrag-${username}-`));
        tempDirsToClean.push(tempDir);

        log(`  📥 Cloning shallow branch from ${parsed.url} ...`);
        try {
          execSync(`git clone --depth 1 "${parsed.url}" "${tempDir}"`, {
            stdio: 'pipe',
            timeout: 60000
          });
        } catch (cloneErr) {
          throw new Error(`Failed to clone repository: ${cloneErr.message}`);
        }

        repoRootPath = tempDir;
      }

      // Discover rooms (room-1 through room-5, plus room for backward compatibility)
      const foundRooms = [];
      for (const cand of ROOM_CANDIDATES) {
        const candDist = path.join(repoRootPath, cand, 'dist');
        if (fs.existsSync(path.join(candDist, 'index.html'))) {
          try {
            const meta = validateAndReadRoom(candDist, username, cand);
            if (isDefaultStarterRoom(meta)) {
              logWarning(`Excluding default test room "${meta.title}" by ${meta.author} in ${cand} for ${username}`);
              continue;
            }
            foundRooms.push({ folderName: cand, distPath: candDist, meta });
          } catch (valErr) {
            logWarning(`Could not validate ${cand} for ${username}: ${valErr.message}`);
          }
        }
      }

      if (foundRooms.length === 0) {
        logWarning(`No custom rooms found for ${username} (only starter test room or empty directories). Skipping fork.`);
        continue;
      }

      for (const roomItem of foundRooms) {
        const meta = roomItem.meta;
        const roomId = (foundRooms.length === 1 && (roomItem.folderName === 'room-1' || roomItem.folderName === 'room'))
          ? username
          : `${username}-${roomItem.folderName}`;

        const targetRoomDir = path.join(ROOMS_DIR, roomId);
        if (fs.existsSync(targetRoomDir)) {
          fs.rmSync(targetRoomDir, { recursive: true, force: true });
        }

        copyFolderRecursive(roomItem.distPath, targetRoomDir);

        // Auto-patch missing defrag protocol for games like Refrag Monday
        const importedIndex = path.join(targetRoomDir, 'index.html');
        if (fs.existsSync(importedIndex)) {
          let content = fs.readFileSync(importedIndex, 'utf8');
          if (!content.includes('defrag:complete')) {
            if (content.includes('Refrag Monday') || content.includes('S = "end"')) {
              content = content.replace(
                'function start() {',
                `let defragReported = false;\nfunction reportDefragComplete(success, resultText) {\n  if (defragReported) return;\n  defragReported = true;\n  window.parent.postMessage({ type: 'defrag:complete', success: Boolean(success), result: String(resultText) }, '*');\n}\nwindow.addEventListener('message', (e) => {\n  if (e.data?.type === 'defrag:start') { defragReported = false; start(); }\n  if (e.data?.type === 'defrag:timeout') { reportDefragComplete(lives > 0 && wins >= 4, 'Time expired!'); }\n});\nfunction start() {\n  defragReported = false;`
              ).replace(
                'S = "end";',
                'S = "end"; setTimeout(() => { reportDefragComplete(lives > 0, lives > 0 ? `You made it! Completed ${wins}/8 chores!` : `Called in sick! ${wins}/8 chores done.`); }, 1000);'
              );
              fs.writeFileSync(importedIndex, content, 'utf8');
              logSuccess(`Auto-patched missing defrag:complete end-state into "${meta.title}"`);
            }
          }
        }

        assembledRooms.push({
          id: roomId,
          title: meta.title,
          author: meta.author,
          color: meta.color,
          description: meta.description || '',
          path: `rooms/${roomId}/index.html`
        });

        logSuccess(`Imported room (${roomItem.folderName}): "${meta.title}" by ${meta.author}`);
      }
    } catch (err) {
      logError(`Failed to import room for ${username}: ${err.message}`);
      errors.push({ id: username, error: err.message });
    }
  }

  // Cleanup temp directories
  for (const tDir of tempDirsToClean) {
    try {
      fs.rmSync(tDir, { recursive: true, force: true });
    } catch {}
  }

  // Write rooms.json manifest
  if (assembledRooms.length > 0) {
    fs.writeFileSync(ROOMS_MANIFEST, JSON.stringify(assembledRooms, null, 2), 'utf8');
    log(`\n${colors.green}${colors.bold}✔ Successfully generated ${ROOMS_MANIFEST} with ${assembledRooms.length} room(s)!${colors.reset}`);
  } else {
    logWarning(`No valid rooms were assembled. Existing ${ROOMS_MANIFEST} was preserved.`);
  }

  // Summary
  log(`\n${colors.bold}=== ASSEMBLY SUMMARY ===${colors.reset}`);
  log(`  Rooms Assembled: ${colors.green}${assembledRooms.length}${colors.reset}`);
  log(`  Failed / Errors: ${errors.length > 0 ? colors.red : colors.dim}${errors.length}${colors.reset}`);

  if (errors.length > 0) {
    log(`\n${colors.yellow}Validation Errors Encountered:${colors.reset}`);
    errors.forEach(e => {
      log(`  - ${colors.bold}${e.id}${colors.reset}: ${e.error}`);
    });
  }

  if (assembledRooms.length > 0) {
    log(`\n🚀 Start the game with: ${colors.bold}${colors.cyan}npm start${colors.reset}\n`);
  }
}

run().catch((err) => {
  console.error('Fatal assembly failure:', err);
  process.exit(1);
});
