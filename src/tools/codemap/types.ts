export interface CodeMapFile {
  path: string;
  description: string;
  exports?: string[];
  dependencies?: string[];
  lastModified?: string;
}

export interface CodeMapModule {
  name: string;
  path: string;
  description: string;
  files: CodeMapFile[];
  submodules?: CodeMapModule[];
}

export interface CodeMapEntry {
  version: number;
  generatedAt: string;
  projectRoot: string;
  summary: string;
  modules: CodeMapModule[];
  keyPatterns?: {
    namingConventions?: string;
    directoryStructure?: string;
    entryPoints?: string[];
  };
}

export const CODEMAP_VERSION = 1;

export const CODEMAP_DIR = '.codemap';
export const CODEMAP_JSON_FILE = 'codemap.json';
export const CODEMAP_MD_FILE = 'codemap.md';

export interface PlanTask {
  id: string;
  title: string;
  targetFiles: string[];
  instructions: string[];
  acceptanceCriteria: string[];
  dependencies?: string[];
}

export interface PlanContext {
  goal: string;
  coreDependencies: string[];
  constraints?: string[];
}

export interface PlanDocument {
  version: number;
  generatedAt: string;
  context: PlanContext;
  tasks: PlanTask[];
}

export const PLAN_VERSION = 1;

export const PLAN_MD_FILE = 'final_plan.md';
export const PLAN_JSON_FILE = 'final_plan.json';
export const PLAN_DIR = '.plan';
