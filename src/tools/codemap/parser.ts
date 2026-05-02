import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CODEMAP_DIR,
  CODEMAP_JSON_FILE,
  CODEMAP_MD_FILE,
  type CodeMapEntry,
} from './types';

export function findCodemapJson(projectRoot: string): string | null {
  const jsonPath = path.join(projectRoot, CODEMAP_DIR, CODEMAP_JSON_FILE);
  if (fs.existsSync(jsonPath)) {
    return jsonPath;
  }
  return null;
}

export function findCodemapMd(projectRoot: string): string | null {
  const mdPath = path.join(projectRoot, CODEMAP_MD_FILE);
  if (fs.existsSync(mdPath)) {
    return mdPath;
  }
  return null;
}

export function codemapExists(projectRoot: string): boolean {
  return findCodemapJson(projectRoot) !== null;
}

export function readCodemapJson(projectRoot: string): CodeMapEntry | null {
  const jsonPath = findCodemapJson(projectRoot);
  if (!jsonPath) return null;

  try {
    const content = fs.readFileSync(jsonPath, 'utf-8');
    const parsed = JSON.parse(content) as CodeMapEntry;
    if (parsed.version && parsed.modules) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function readCodemapMd(projectRoot: string): string | null {
  const mdPath = findCodemapMd(projectRoot);
  if (!mdPath) return null;

  try {
    return fs.readFileSync(mdPath, 'utf-8');
  } catch {
    return null;
  }
}

export function writeCodemapJson(
  projectRoot: string,
  entry: CodeMapEntry,
): void {
  const dir = path.join(projectRoot, CODEMAP_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const jsonPath = path.join(dir, CODEMAP_JSON_FILE);
  fs.writeFileSync(jsonPath, JSON.stringify(entry, null, 2), 'utf-8');
}

export function writeCodemapMd(projectRoot: string, content: string): void {
  const mdPath = path.join(projectRoot, CODEMAP_MD_FILE);
  fs.writeFileSync(mdPath, content, 'utf-8');
}

export function codemapToJson(entry: CodeMapEntry): string {
  return JSON.stringify(entry, null, 2);
}

export function codemapToMarkdown(entry: CodeMapEntry): string {
  const lines: string[] = [];
  lines.push(`# Code Map: ${entry.projectRoot}`);
  lines.push('');
  lines.push(`**Generated**: ${entry.generatedAt}`);
  lines.push(`**Version**: ${entry.version}`);
  lines.push('');
  lines.push('## Summary');
  lines.push(entry.summary);
  lines.push('');

  if (entry.keyPatterns) {
    lines.push('## Key Patterns');
    if (entry.keyPatterns.namingConventions) {
      lines.push(`- **Naming**: ${entry.keyPatterns.namingConventions}`);
    }
    if (entry.keyPatterns.directoryStructure) {
      lines.push(
        `- **Directory Structure**: ${entry.keyPatterns.directoryStructure}`,
      );
    }
    if (entry.keyPatterns.entryPoints?.length) {
      lines.push(
        `- **Entry Points**: ${entry.keyPatterns.entryPoints.join(', ')}`,
      );
    }
    lines.push('');
  }

  for (const mod of entry.modules) {
    renderModuleMarkdown(lines, mod, 2);
  }

  return lines.join('\n');
}

function renderModuleMarkdown(
  lines: string[],
  mod: CodeMapEntry['modules'][number],
  level: number,
): void {
  const prefix = '#'.repeat(level);
  lines.push(`${prefix} ${mod.name}`);
  lines.push(`- **Path**: ${mod.path}`);
  lines.push(`- **Description**: ${mod.description}`);
  lines.push('');

  if (mod.files.length > 0) {
    lines.push(`${prefix}# Files`);
    for (const file of mod.files) {
      lines.push(`- \`${file.path}\`: ${file.description}`);
      if (file.exports?.length) {
        lines.push(`  - Exports: ${file.exports.join(', ')}`);
      }
      if (file.dependencies?.length) {
        lines.push(`  - Dependencies: ${file.dependencies.join(', ')}`);
      }
    }
    lines.push('');
  }

  if (mod.submodules?.length) {
    for (const sub of mod.submodules) {
      renderModuleMarkdown(lines, sub, level + 1);
    }
  }
}
