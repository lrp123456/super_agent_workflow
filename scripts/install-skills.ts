import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const packageRoot = dirname(__dirname);

const CUSTOM_SKILLS = [
  { name: 'simplify', sourcePath: 'src/skills/simplify' },
  { name: 'codemap', sourcePath: 'src/skills/codemap' },
  { name: 'brainstorm', sourcePath: 'src/skills/brainstorm' },
  { name: 'plannotator', sourcePath: 'src/skills/plannotator' },
];

function getSkillsTargetDir(): string {
  const configDir =
    process.env.OPENCODE_CONFIG_DIR ||
    process.env.XDG_CONFIG_HOME ||
    join(homedir(), '.config');
  return join(configDir, 'opencode', 'skills');
}

function copyDirRecursive(src: string, dest: string): void {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  const entries = readdirSync(src);
  for (const entry of entries) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      const destDir = dirname(destPath);
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }
      copyFileSync(srcPath, destPath);
    }
  }
}

function installSkills(): void {
  const targetDir = getSkillsTargetDir();
  let installed = 0;
  let failed = 0;

  console.log('[build:skills] Installing custom skills...');
  console.log(`[build:skills] Target directory: ${targetDir}`);

  for (const skill of CUSTOM_SKILLS) {
    const sourcePath = join(packageRoot, skill.sourcePath);
    const targetPath = join(targetDir, skill.name);

    if (!existsSync(sourcePath)) {
      console.warn(`[build:skills] ⚠ Source not found: ${sourcePath}`);
      failed++;
      continue;
    }

    try {
      mkdirSync(dirname(targetPath), { recursive: true });
      copyDirRecursive(sourcePath, targetPath);
      console.log(`[build:skills] ✓ Installed: ${skill.name}`);
      installed++;
    } catch (err) {
      console.error(`[build:skills] ✗ Failed to install ${skill.name}: ${err}`);
      failed++;
    }
  }

  console.log(
    `[build:skills] Result: ${installed} installed, ${failed} failed`,
  );

  if (failed > 0 && installed === 0) {
    console.warn(
      '[build:skills] All skill installations failed. ' +
        'Skills will still be available via `bunx oh-my-opencode-slim install`.',
    );
  }
}

installSkills();
