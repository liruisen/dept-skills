---
description: |-
    根据暂存区的内容自动生成符合项目规范的 Git commit message。
    当用户要求生成提交信息、commit message、或执行 git commit / 提交代码相关操作时使用此 skill。
name: commit-msg
---
# Git Commit Message 生成器（通用版）

根据 git 暂存区的内容，生成符合**当前项目**规范的 commit message。通过探测项目配置和 git 历史，自动适配任意项目。

## 基本格式

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>          # 可选，每条要点用 `- ` 开头
<footer>        # 可选
```

## Step 1：探测项目配置

生成前先收集项目上下文：

1. **读 commitlint 配置**（如有：`commitlint.config.*` / `.commitlintrc*` / `package.json` 的 `commitlint` 字段），提取 `type-enum`、`scope-enum`、`maxSubjectLength`。未配置则用下文默认值。
2. **看 git 历史**（`git log --oneline -50`）：
   - **语言偏好**：统计最近提交的 subject 语言，中文多就用中文，否则英文
   - **scope 习惯**：沿用历史中已有的 scope 命名风格（大小写、分隔符）

## Step 2：获取暂存区变更

```bash
git diff --cached --stat   # 改了哪些文件、规模多大
git diff --cached          # 每个文件实际改了什么
```

无暂存内容则提示用户先 `git add`。

> 读 `git diff --cached` 的实际内容**仅为判断改动性质**（新功能 / 重构 / 修 bug），**不要把 diff 细节（代码、符号、文件清单）搬进 commit message**。只凭 `--stat` 臆测会漏掉结构性改动。

## Step 3：分析变更

### 3.1 type

优先用 commitlint 的 type-enum。默认 Conventional Commits 类型：

`feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`

**判断核心：影响「产品行为」还是「工程流程」？**

- 产品行为（终端用户可感知的功能 / 缺陷）→ `feat` / `fix`
- 工程流程（构建 / 测试 / 发布 / CI / 维护代码）→ `build` / `ci` / `chore`

⚠️ 不要因为「新增了文件或函数」就判 `feat`——工程基建（构建脚本、配置、CI）同样新增文件函数，但不面向用户。

### 3.2 scope

按优先级推断：

1. commitlint `scope-enum`（若配置）
2. 与历史提交的 scope 模式匹配
3. 按变更文件所在目录 / 模块推断（如 `src/<module>/` → `<module>`）

- 单模块改动 → 用该模块名
- **跨模块 / 通用层（composables、utils 等）→ 默认省略 scope**，不要逗号堆砌

### 3.3 subject

- **语言**：跟随 Step 1 检测到的偏好
- **动词开头**：中文「添加 / 修复 / 优化 / 重构 / 移除」；英文 imperative `add / fix / optimize / refactor / remove`
- **简洁**：只说「做了什么」，基于 diff，不编造，不以句号结尾
- **长度**：遵循 commitlint 限制，未配置则力求精简

## Step 4：输出

**禁止自动执行 git commit。** 把 message 放在代码块里输出，方便复制粘贴。

body 规范：

- **能一行 subject 说清就别写 body**
- 写 body 时，每条要点用 **`- `** 开头
- 只写「为什么改 / 背景动机 / 影响面」，**禁止罗列文件路径、模块清单、代码符号**
- 控制在 ≤3 条

## 示例

**示例 1 — 单模块，中文**

变更：新增 `src/views/Settings/Automation/Automation.vue`、`src/router/index.ts` 加路由

```
feat(settings): 添加自动化配置页面
```

**示例 2 — 带 body，跨模块省略 scope**

变更：`src/composables/useShiftWheel.ts` 加触摸板手势分支，影响日历房态等多个横向表格

```
fix: 横向滚动支持触摸板水平手势

- 之前仅识别 Shift+滚轮，触摸板水平滑动无效
- 新增触摸板手势判断，原 Shift+滚轮行为不变
```

## 注意事项

1. **沿用项目术语**：scope 命名风格跟随历史（kebab-case、camelCase 等）。
2. **不编造**：无法确定 type / scope 时，询问用户。
3. **配置优先**：commitlint 规则始终优先于本文档默认值。
