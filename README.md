<div align="center">
  <p><i>Two divine beings emerged from the dawn of code — the Planner who sees all paths, and the Builder who walks them.</i></p>
  <p><b>Super Agent Suite</b> · Plan → Review → Build → Verify · Zero hallucination</p>
  <p><a href="README_ZH.md">📖 中文文档</a></p>
</div>

---

## What's This Plugin

oh-my-opencode-slim is an agent orchestration plugin for OpenCode, featuring two **primary agents** — **Super_Plan** (规划之神) and **Super_Build** (建造之神) — that work together through a rigorous Plan → Review → Build → Verify workflow.

The core idea: **separate planning from execution**, enforce quality through dual-review gates, and never repeat failed approaches. Super_Plan thinks deeply, Super_Build executes ruthlessly, and the user verifies the result.

### Key Features

- **🗺️ Code Map System** — Persistent codebase understanding (`.codemap/codemap.json` + `codemap.md`), auto-generated and auto-updated
- **📋 Structured Planning** — Draft plan → Plannotator review → User approval → Final plan (dual format: `.md` + `.json`)
- **🧠 Brainstorming** — Multiple candidate approaches with trade-off analysis for complex decisions
- **⚡ Parallel Execution** — Independent tasks dispatched to multiple @fixer workers simultaneously
- **🔍 Dual Review Pipeline** — LSP syntax check (Gate 1) + Acceptance criteria verification (Gate 2)
- **📜 Fix History Tracking** — Records every fix attempt (approach, result, failure reason) to avoid repeating failed strategies
- **🔄 Verification Loop** — User tests the fix, reports `/test_result pass|fail`, failed fixes auto-rollback and re-trigger planning
- **🧹 Context Isolation** — `/clear_context` command between Plan and Build phases to prevent hallucination from stale context

---

## 🏛️ Meet the Gods

### 👑 Super_Plan — The Planning God

**Role**: Chief Architect. Surveys the codebase, clarifies requirements, generates structured execution plans.

**8-Phase Workflow**:

| Phase | Action |
|-------|--------|
| 1. Code Map & Fix History | Check existing code map and previous fix attempts |
| 2. Code Map Generation | If no map exists, delegate @explorer to scan and create one |
| 3. Requirement Analysis | Combine code map + fix history + user request, ask targeted questions |
| 4. Brainstorming | (Optional) Use `brainstorm` skill for 2-3 candidate approaches |
| 5. Draft Plan | Generate DRAFT plan (not final yet) |
| 6. Plannotator Review | User reviews, modifies, and approves the draft |
| 7. Final Plan | After approval, generate `final_plan.md` + `final_plan.json` |
| 8. Handoff | Tell user to run `/clear_context` then `@super_build` |

**Key Principle**: Super_Plan NEVER implements code. It plans, questions, and documents.

**Prompt**: [super-plan.ts](src/agents/super-plan.ts)

---

### 👑 Super_Build — The Build God

**Role**: Chief Engineering Director. Reads the approved plan, dispatches @fixer workers, enforces dual-review quality gates.

**7-Phase Workflow**:

| Phase | Action |
|-------|--------|
| 1. Load Contract | Read `final_plan.json` + fix history |
| 2. Task Decomposition | Analyze dependencies, group parallel-safe tasks, detect file conflicts |
| 3. Parallel Execution | Dispatch independent tasks to multiple @fixer instances |
| 4. Dual Review | Gate 1: LSP syntax check → Gate 2: Acceptance criteria verification |
| 5. Conflict Resolution | Auto-merge or re-execute conflicting tasks sequentially |
| 6. Update | Update code map + record fix attempt as `pending_verification` |
| 7. Final Report | Summary + prompt user to test with `/test_result` |

**Key Principle**: Super_Build NEVER marks an issue as resolved — only the user can confirm a fix works.

**Prompt**: [super-build.ts](src/agents/super-build.ts)

---

### 🛠️ Supporting Agents

These agents are delegated to by the two Gods:

| Agent | Role | Used By |
|-------|------|---------|
| **@explorer** | Codebase reconnaissance — scans files, generates code maps | Super_Plan, Super_Build |
| **@librarian** | External knowledge retrieval — documentation, web search | Super_Plan |
| **@oracle** | Strategic advisor — architecture decisions, complex debugging | Super_Plan, Super_Build |
| **@fixer** | Implementation specialist — executes scoped code changes | Super_Build |

---

## 🔄 The Complete Workflow

### Plan → Build → Verify Cycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    @super_plan [your request]                    │
│                                                                  │
│  1. Check code map (read_codemap)                                │
│     └─ No map? → @explorer scans → update_codemap               │
│  2. Check fix history (read_fix_history)                         │
│     └─ Previous failures? → "I see this was tried before..."    │
│  3. Ask clarifying questions (2-4 max)                           │
│  4. [Optional] Brainstorm 2-3 approaches                         │
│  5. Generate DRAFT plan                                          │
│  6. [Plannotator] User reviews & approves                        │
│  7. Generate final_plan.md + final_plan.json                     │
│  8. "Run /clear_context then @super_build"                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    /clear_context
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    @super_build                                  │
│                                                                  │
│  1. Read final_plan.json + fix history                           │
│  2. Decompose tasks → detect conflicts → schedule batches        │
│  3. Dispatch @fixer workers (parallel where safe)                │
│  4. For each task:                                               │
│     Gate 1: lsp_check (tsc + biome)                              │
│     Gate 2: Acceptance criteria verification                     │
│     └─ Failed? → Retry (up to maxRetries)                       │
│     └─ Record fix attempt in history                             │
│  5. Resolve conflicts (auto-merge or sequential retry)           │
│  6. Update code map + mark fix as pending_verification           │
│  7. "Please test and run /test_result pass|fail"                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    User tests...
                           │
              ┌────────────┴────────────┐
              │                         │
     /test_result pass         /test_result fail [reason]
              │                         │
              ▼                         ▼
     ✅ Issue resolved!        ❌ Verification failed
     Fix history: resolved     Fix history: recurring
                                    │
                              Git rollback to
                              pre-build commit
                                    │
                              Re-run @super_plan
                              (sees previous failures)
```

### Commands Reference

| Command | Description |
|---------|-------------|
| `@super_plan [request]` | Start the planning phase for a feature or bug fix |
| `@super_build` | Execute the approved plan with quality gates |
| `/clear_context` | Clear conversation context between Plan and Build phases |
| `/test_result pass` | Mark the fix as verified and resolved |
| `/test_result fail [reason]` | Mark the fix as failed, rollback code, re-trigger planning |

### Tools Reference

| Tool | Agent | Description |
|------|-------|-------------|
| `read_codemap` | Super_Plan | Read the project code map |
| `update_codemap` | Super_Plan, Super_Build | Create or update the code map |
| `generate_plan` | Super_Plan | Generate final_plan.md + final_plan.json |
| `read_plan` | Super_Build | Load the approved execution plan |
| `lsp_check` | Super_Build | Run syntax/type checking (tsc + biome) |
| `read_fix_history` | Super_Plan, Super_Build | Read previous fix attempts |
| `record_fix_attempt` | Super_Build | Record a fix attempt result |
| `resolve_issue` | /test_result pass | Mark an issue as resolved |

### Skills Reference

| Skill | Agent | Description |
|-------|-------|-------------|
| `brainstorm` | Super_Plan | Generate 2-3 candidate approaches with trade-off analysis |
| `plannotator` | Super_Plan | Visual plan review — add/remove/modify/split/merge tasks |

---

## 📦 Installation

### Option 1: Install from npm (Recommended)

```bash
# Install the plugin globally
bunx oh-my-opencode-slim@latest install
```

The installer:
1. Copies the plugin to `~/.config/opencode/plugins/oh-my-opencode-slim/`
2. Registers it in OpenCode's `opencode.json` and `tui.json`
3. Generates default configuration with model presets

### Option 2: Install from Local Source

If you've cloned or modified the source:

```bash
# 1. Build the plugin
cd /path/to/oh-my-opencode-slim
bun install
bun run build

# 2. Install from local directory
bunx oh-my-opencode-slim install --local /path/to/oh-my-opencode-slim
```

Or manually register in `~/.config/opencode/opencode.json`:

```jsonc
{
  "plugin": ["file:///path/to/oh-my-opencode-slim"]
}
```

### Option 3: Publish to npm and Install

If you want to publish your own version:

```bash
# 1. Update version in package.json
#    "version": "1.0.7"

# 2. Build and verify
bun run build
bun run typecheck
bun run check:ci

# 3. Publish to npm
npm publish

# 4. Install from npm
bunx oh-my-opencode-slim@latest install
```

For scoped packages (e.g., `@yourorg/oh-my-opencode-slim`):

```bash
# Publish
npm publish --access public

# Install
npx @yourorg/oh-my-opencode-slim install
```

### Post-Installation Setup

1. **Log in to your AI providers**:

   ```bash
   opencode auth login
   ```

2. **Refresh available models**:

   ```bash
   opencode models --refresh
   ```

3. **Configure models** — edit `~/.config/opencode/oh-my-opencode-slim.json`:

   ```jsonc
   {
     "$schema": "https://unpkg.com/oh-my-opencode-slim@latest/oh-my-opencode-slim.schema.json",
     "preset": "openai",
     "presets": {
       "openai": {
         "super_plan": { "model": "openai/gpt-5.5", "skills": ["brainstorm", "plannotator"], "mcps": ["*", "!context7"] },
         "super_build": { "model": "openai/gpt-5.5", "skills": [], "mcps": [] },
         "oracle": { "model": "openai/gpt-5.5", "variant": "high", "skills": ["simplify"], "mcps": [] },
         "librarian": { "model": "openai/gpt-5.4-mini", "variant": "low", "skills": [], "mcps": ["websearch", "context7", "grep_app"] },
         "explorer": { "model": "openai/gpt-5.4-mini", "variant": "low", "skills": [], "mcps": [] },
         "fixer": { "model": "openai/gpt-5.4-mini", "variant": "low", "skills": [], "mcps": [] }
       }
     },
     "superPlan": {
       "maxQuestions": 4,
       "brainstormEnabled": true
     },
     "superBuild": {
       "maxRetries": 3,
       "taskTimeoutMs": 300000,
       "parallelTasks": 3,
       "lspChecker": "auto"
     },
     "codemap": {
       "enabled": true,
       "autoUpdate": true
     }
   }
   ```

4. **Verify setup**:

   ```bash
   opencode
   # Then type: ping all agents
   ```

---

## ⚙️ Configuration Reference

### Super_Plan Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxQuestions` | number | 4 | Max clarification questions before generating a plan |
| `brainstormEnabled` | boolean | true | Enable brainstorming phase for open-ended requests |

### Super_Build Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxRetries` | number | 3 | Max retry attempts per task when review fails |
| `taskTimeoutMs` | number | 300000 | Timeout per task in milliseconds |
| `parallelTasks` | number | 3 | Max tasks to execute in parallel |
| `lspChecker` | `"auto"` \| `"tsc"` \| `"biome"` \| `"both"` | `"auto"` | Which syntax checker to use |

### Code Map Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | true | Enable code map generation and maintenance |
| `autoUpdate` | boolean | true | Auto-update code map after Super_Build completes |

---

## 📂 Generated Files

The plugin creates these files in your project root:

| File | Description |
|------|-------------|
| `codemap.md` | Human-readable code map |
| `.codemap/codemap.json` | Machine-readable code map |
| `.codemap/fix-history.json` | Fix attempt history with fingerprint matching |
| `final_plan.md` | Human-readable execution plan |
| `.plan/final_plan.json` | Machine-readable execution plan |

---

## 📚 Documentation

| Doc | What it covers |
|-----|----------------|
| **[Configuration](docs/configuration.md)** | Config file locations, JSONC support, prompt overrides, and full option reference |
| **[Council](docs/council.md)** | Run multiple models in parallel and synthesize a single answer with `@council` |
| **[Interview](docs/interview.md)** | Turn rough ideas into a structured markdown spec through a browser-based Q&A flow |
| **[Session Management](docs/session-management.md)** | Reuse recent child-agent sessions with short aliases |
| **[Skills](docs/skills.md)** | Built-in and recommended skills |
| **[MCPs](docs/mcps.md)** | MCP permissions per agent |

---

## 🙏 Acknowledgments

This project is built upon the shoulders of giants. We are grateful to the open source community and the following projects:

### Upstream Project
- **[oh-my-opencode-slim](https://github.com/alvinunreal/oh-my-opencode-slim)** by [Alvin](https://boringdystopia.ai/) and [Boring Dystopia Development](https://github.com/alvinunreal) — the original project this plugin is forked from, licensed under MIT

### Core Dependencies
- **[OpenCode SDK](https://github.com/opencode-ai/sdk)** — Plugin SDK for OpenCode's agentic coding environment
- **[Model Context Protocol (MCP)](https://modelcontextprotocol.io/)** — The open protocol for AI tool integration, via [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- **[Zod](https://zod.dev/)** — TypeScript-first schema declaration and validation library
- **[Biome](https://biomejs.dev/)** — Fast formatter and linter for web development

### Special Thanks
- The OpenCode team for building such a powerful extensible agentic coding environment
- The maintainers of Exa, Tavily, Context7, and Grep.app for providing MCP services

---

## 📄 License
See [LICENSE](LICENSE) for the full license text.
