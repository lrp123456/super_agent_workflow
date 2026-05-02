# oh-my-opencode-slim 中文文档

> 两位神明从代码的黎明中诞生——规划之神洞悉一切路径，建造之神踏遍每一条道路。

**[📖 English Documentation](README.md)**

---

## 插件简介

oh-my-opencode-slim 是一个 OpenCode 智能体编排插件，核心是两位**主神**——**Super_Plan（规划之神）** 和 **Super_Build（建造之神）**——通过严格的 **规划 → 审查 → 建造 → 验证** 工作流协同工作。

核心理念：**规划与执行分离**，通过双重审查门控保证质量，永远不重复失败的方案。Super_Plan 深思熟虑，Super_Build 雷厉风行，用户验证最终结果。

### 核心特性

- **🗺️ 代码地图系统** — 持久化的代码库理解（`.codemap/codemap.json` + `codemap.md`），自动生成与更新
- **📋 结构化规划** — 草稿计划 → Plannotator 审查 → 用户批准 → 最终计划（双格式：`.md` + `.json`）
- **🧠 头脑风暴** — 针对复杂决策生成多个候选方案及权衡分析
- **⚡ 并行执行** — 独立任务同时派发给多个 @fixer 工作进程
- **🔍 双重审查流水线** — LSP 语法检查（门控1）+ 验收标准验证（门控2）
- **📜 修复历史追踪** — 记录每次修复尝试（方案、结果、失败原因），避免重复失败策略
- **🔄 验证循环** — 用户测试修复效果，报告 `/test_result pass|fail`，失败自动回滚并重新触发规划
- **🧹 上下文隔离** — Plan 和 Build 阶段之间使用 `/clear_context` 命令清除上下文，防止幻觉

---

## 🏛️ 认识众神

### 👑 Super_Plan — 规划之神

**角色**：首席架构师。审视代码库，澄清需求，生成结构化执行计划。

**8 阶段工作流**：

| 阶段 | 动作 |
|------|------|
| 1. 代码地图 & 修复历史 | 检查现有代码地图和之前的修复尝试 |
| 2. 代码地图生成 | 如果没有地图，委派 @explorer 扫描并创建 |
| 3. 需求分析 | 结合代码地图 + 修复历史 + 用户请求，提出针对性问题 |
| 4. 头脑风暴 | （可选）使用 `brainstorm` 技能生成 2-3 个候选方案 |
| 5. 草稿计划 | 生成 DRAFT 计划（尚未最终确定） |
| 6. Plannotator 审查 | 用户审查、修改并批准草稿 |
| 7. 最终计划 | 批准后，生成 `final_plan.md` + `final_plan.json` |
| 8. 交接 | 告知用户运行 `/clear_context` 然后调用 `@super_build` |

**核心原则**：Super_Plan 永远不实现代码。它只规划、提问和记录。

**提示词**：[super-plan.ts](src/agents/super-plan.ts)

---

### 👑 Super_Build — 建造之神

**角色**：首席工程总监。读取已批准的计划，派发 @fixer 工作进程，执行双重审查质量门控。

**7 阶段工作流**：

| 阶段 | 动作 |
|------|------|
| 1. 加载契约 | 读取 `final_plan.json` + 修复历史 |
| 2. 任务拆解 | 分析依赖关系，分组并行安全任务，检测文件冲突 |
| 3. 并行执行 | 将独立任务派发给多个 @fixer 实例 |
| 4. 双重审查 | 门控1：LSP 语法检查 → 门控2：验收标准验证 |
| 5. 冲突解决 | 自动合并或串行重试冲突任务 |
| 6. 更新 | 更新代码地图 + 记录修复尝试为 `pending_verification` |
| 7. 最终报告 | 摘要 + 提示用户使用 `/test_result` 测试 |

**核心原则**：Super_Build 永远不会自动标记问题为已解决——只有用户才能确认修复有效。

**提示词**：[super-build.ts](src/agents/super-build.ts)

---

### 🛠️ 辅助智能体

这些智能体由两位主神调度：

| 智能体 | 角色 | 调用者 |
|--------|------|--------|
| **@explorer** | 代码库侦察——扫描文件，生成代码地图 | Super_Plan, Super_Build |
| **@librarian** | 外部知识检索——文档查找，网络搜索 | Super_Plan |
| **@oracle** | 战略顾问——架构决策，复杂调试 | Super_Plan, Super_Build |
| **@fixer** | 实现专家——执行限定范围的代码变更 | Super_Build |

---

## 🔄 完整工作流

### 规划 → 建造 → 验证 循环

```
┌─────────────────────────────────────────────────────────────────┐
│                  @super_plan [你的需求]                           │
│                                                                  │
│  1. 检查代码地图 (read_codemap)                                   │
│     └─ 没有地图？→ @explorer 扫描 → update_codemap               │
│  2. 检查修复历史 (read_fix_history)                               │
│     └─ 之前失败过？→ "我看到这个问题之前尝试过..."                  │
│  3. 提出澄清问题（最多 2-4 个）                                   │
│  4. [可选] 头脑风暴 2-3 个方案                                    │
│  5. 生成草稿计划 (DRAFT)                                          │
│  6. [Plannotator] 用户审查并批准                                  │
│  7. 生成 final_plan.md + final_plan.json                         │
│  8. "请运行 /clear_context 然后调用 @super_build"                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    /clear_context
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    @super_build                                  │
│                                                                  │
│  1. 读取 final_plan.json + 修复历史                              │
│  2. 拆解任务 → 检测冲突 → 排定批次                                │
│  3. 派发 @fixer 工作进程（安全并行）                               │
│  4. 对每个任务：                                                  │
│     门控1：lsp_check (tsc + biome)                               │
│     门控2：验收标准验证                                            │
│     └─ 失败？→ 重试（最多 maxRetries 次）                        │
│     └─ 在历史中记录修复尝试                                       │
│  5. 解决冲突（自动合并或串行重试）                                 │
│  6. 更新代码地图 + 标记修复为 pending_verification                │
│  7. "请测试并运行 /test_result pass|fail"                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    用户测试...
                           │
              ┌────────────┴────────────┐
              │                         │
     /test_result pass         /test_result fail [原因]
              │                         │
              ▼                         ▼
     ✅ 问题已解决！             ❌ 验证失败
     修复历史：resolved          修复历史：recurring
                                     │
                               Git 回滚到
                               建造前的提交
                                     │
                               重新运行 @super_plan
                               （会看到之前的失败记录）
```

### 使用示例

**场景：修复 Token 过期问题**

```
你: @super_plan 认证模块的 Token 过期后没有自动刷新

Super_Plan: 让我先检查代码地图和修复历史...
Super_Plan: 我看到这个问题之前尝试过 2 次：
  - 第 1 次：在中间件中添加 Token 刷新逻辑 → 竞态条件导致失败
  - 第 2 次：使用 RefreshToken 队列串行化 → 队列超时导致请求堆积
  我会采用完全不同的策略。

Super_Plan: 我有几个问题：
  1. 当前使用的是 JWT 还是 Session Token？
  2. 是否需要支持并发请求时的 Token 刷新？

你: JWT，需要支持并发刷新

Super_Plan: [生成草稿计划]
Super_Plan: 请审查这个计划，确认后我将生成最终版本。

你: 计划看起来不错，批准

Super_Plan: 最终计划已生成。请运行 /clear_context 然后调用 @super_build

你: /clear_context

你: @super_build

Super_Build: 读取计划... 发现 3 个任务，2 个可并行执行。
Super_Build: 任务 1/3: LSP 检查通过，验收标准验证通过 ✅
Super_Build: 任务 2/3: LSP 检查通过，验收标准验证通过 ✅
Super_Build: 任务 3/3: LSP 检查通过，验收标准验证通过 ✅
Super_Build: 所有任务已完成。请测试修复效果：
  /test_result pass
  /test_result fail [描述问题]

你: [测试后] /test_result pass

系统: ✅ 修复已验证，问题标记为已解决！
```

---

## 📋 命令参考

| 命令 | 说明 |
|------|------|
| `@super_plan [需求]` | 启动规划阶段，用于功能开发或 Bug 修复 |
| `@super_build` | 执行已批准的计划，通过质量门控 |
| `/clear_context` | 在规划和建造阶段之间清除对话上下文 |
| `/test_result pass` | 标记修复已验证通过 |
| `/test_result fail [原因]` | 标记修复失败，回滚代码，重新触发规划 |

## 🔧 工具参考

| 工具 | 智能体 | 说明 |
|------|--------|------|
| `read_codemap` | Super_Plan | 读取项目代码地图 |
| `update_codemap` | Super_Plan, Super_Build | 创建或更新代码地图 |
| `generate_plan` | Super_Plan | 生成 final_plan.md + final_plan.json |
| `read_plan` | Super_Build | 加载已批准的执行计划 |
| `lsp_check` | Super_Build | 运行语法/类型检查（tsc + biome） |
| `read_fix_history` | Super_Plan, Super_Build | 读取之前的修复尝试 |
| `record_fix_attempt` | Super_Build | 记录修复尝试结果 |
| `resolve_issue` | /test_result pass | 标记问题为已解决 |

## 🎯 技能参考

| 技能 | 智能体 | 说明 |
|------|--------|------|
| `brainstorm` | Super_Plan | 生成 2-3 个候选方案及权衡分析 |
| `plannotator` | Super_Plan | 可视化计划审查——增删改拆合并任务 |

---

## 📦 安装

### 方式一：从 npm 安装（推荐）

```bash
bunx oh-my-opencode-slim@latest install
```

安装器会：
1. 将插件复制到 `~/.config/opencode/plugins/oh-my-opencode-slim/`
2. 在 OpenCode 的 `opencode.json` 和 `tui.json` 中注册
3. 生成默认配置及模型预设

### 方式二：从本地源码安装

如果你克隆或修改了源码：

```bash
# 1. 构建插件
cd /path/to/oh-my-opencode-slim
bun install
bun run build

# 2. 从本地目录安装
bunx oh-my-opencode-slim install --local /path/to/oh-my-opencode-slim
```

或手动在 `~/.config/opencode/opencode.json` 中注册：

```jsonc
{
  "plugin": ["file:///path/to/oh-my-opencode-slim"]
}
```

### 方式三：发布到 npm 后安装

如果你想发布自己的版本：

```bash
# 1. 在 package.json 中更新版本号
#    "version": "1.0.7"

# 2. 构建并验证
bun run build
bun run typecheck
bun run check:ci

# 3. 发布到 npm
npm publish

# 4. 从 npm 安装
bunx oh-my-opencode-slim@latest install
```

如果是作用域包（如 `@yourorg/oh-my-opencode-slim`）：

```bash
# 发布
npm publish --access public

# 安装
npx @yourorg/oh-my-opencode-slim install
```

### 安装后配置

1. **登录 AI 提供商**：

   ```bash
   opencode auth login
   ```

2. **刷新可用模型**：

   ```bash
   opencode models --refresh
   ```

3. **配置模型** — 编辑 `~/.config/opencode/oh-my-opencode-slim.json`：

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

4. **验证安装**：

   ```bash
   opencode
   # 然后输入：ping all agents
   ```

---

## ⚙️ 配置参考

### Super_Plan 配置

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `maxQuestions` | number | 4 | 生成计划前最多提出的澄清问题数 |
| `brainstormEnabled` | boolean | true | 是否为开放式需求启用头脑风暴阶段 |

### Super_Build 配置

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `maxRetries` | number | 3 | 审查失败时每个任务的最大重试次数 |
| `taskTimeoutMs` | number | 300000 | 每个任务的超时时间（毫秒） |
| `parallelTasks` | number | 3 | 最大并行执行任务数 |
| `lspChecker` | `"auto"` \| `"tsc"` \| `"biome"` \| `"both"` | `"auto"` | 使用哪种语法检查器 |

### 代码地图配置

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | boolean | true | 是否启用代码地图生成和维护 |
| `autoUpdate` | boolean | true | Super_Build 完成后是否自动更新代码地图 |

---

## 📂 生成的文件

插件会在项目根目录创建以下文件：

| 文件 | 说明 |
|------|------|
| `codemap.md` | 人类可读的代码地图 |
| `.codemap/codemap.json` | 机器可读的代码地图 |
| `.codemap/fix-history.json` | 修复尝试历史（含指纹匹配） |
| `final_plan.md` | 人类可读的执行计划 |
| `.plan/final_plan.json` | 机器可读的执行计划 |

---

## 🔑 问题标识机制

修复历史使用**三层匹配**来判断是否是同一个问题：

1. **显式 ID 匹配**（最高优先级）：用户可指定 `issueId`（如 `#bug-auth-token`），精确匹配
2. **指纹精确匹配**：基于关键词 + 目标文件路径的 SHA256 哈希（前12位），同一问题同一文件 = 同一指纹
3. **模糊匹配**（兜底）：关键词重叠度（权重0.6）+ 路径重叠度（权重0.4），阈值≥0.5 才匹配

修复状态流转：

```
open → pending_verification → resolved
                            → recurring（验证失败后）
```

---

## 📚 更多文档

| 文档 | 内容 |
|------|------|
| **[Configuration](docs/configuration.md)** | 配置文件位置、JSONC 支持、提示词覆盖、完整选项参考 |
| **[Council](docs/council.md)** | 使用 `@council` 并行运行多个模型并综合答案 |
| **[Interview](docs/interview.md)** | 通过浏览器问答流程将粗略想法转化为结构化规格 |
| **[Session Management](docs/session-management.md)** | 复用最近的子智能体会话 |
| **[Skills](docs/skills.md)** | 内置和推荐技能 |
| **[MCPs](docs/mcps.md)** | 每个智能体的 MCP 权限 |

---

## 🙏 致谢

本项目站在巨人的肩膀上。感谢开源社区和以下项目：

### 上游项目
- **[oh-my-opencode-slim](https://github.com/alvinunreal/oh-my-opencode-slim)** — 由 [Alvin](https://boringdystopia.ai/) 和 [Boring Dystopia Development](https://github.com/alvinunreal) 创建的本插件上游项目，MIT 协议授权

### 核心依赖
- **[OpenCode SDK](https://github.com/opencode-ai/sdk)** — OpenCode 智能体编程环境的插件 SDK
- **[Model Context Protocol (MCP)](https://modelcontextprotocol.io/)** — AI 工具集成的开放协议，via [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- **[Zod](https://zod.dev/)** — TypeScript 优先的 schema 声明和验证库
- **[Biome](https://biomejs.dev/)** — 面向 Web 开发的高速格式化器和 Linter

### 特别感谢
- OpenCode 团队打造了如此强大且可扩展的智能体编程环境
- Exa、Tavily、Context7 和 Grep.app 的维护者提供了 MCP 服务

---

## 📄 许可证

MIT License

本项目是 [oh-my-opencode-slim](https://github.com/alvinunreal/oh-my-opencode-slim) 的分支及衍生作品，原作者为 Alvin (alvinunreal) 和 Boring Dystopia Development，原始许可协议为 MIT License。

本分支的修改包括：重构智能体架构（Super_Plan / Super_Build 主智能体）、代码地图系统、计划生成/审查流水线、修复历史追踪、验证循环及上下文隔离命令。

完整许可文本请参见 [LICENSE](LICENSE)。
