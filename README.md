# dept-skills

部门 skill 仓库。skill 是一个装着 `SKILL.md` 的文件夹，遵循 [Agent Skills](https://agentskills.io) 开放标准——装进 `~/.agents/skills` 共享目录后，Codex、ZCode、Cursor 等工具都能识别；Claude Code 走软链。

## 目录

| skill | 用途 |
| --- | --- |
| commit-msg | 按项目规范生成 Git 提交信息 |
| release-note | 两段式发版说明：交测试明细 + 审批留档简报 |

## 安装（选一种）

**任何环境（推荐）**

```sh
git clone https://github.com/liruisen/dept-skills && cd dept-skills && ./install.sh
```

更新：`git pull && ./install.sh`

**Node 环境**

```sh
npx skills add https://github.com/liruisen/dept-skills
npx skills update
```

**客户端（Claude Code / ZCode）**

```
/plugin marketplace add liruisen/dept-skills
```

**最省事**：把仓库链接发给你的 Agent，说「把这个仓库的 skill 装上」，授权它自己处理。

## 上架一个 skill

1. 在 `skills/` 下加一个目录：`skills/<name>/SKILL.md`
2. `.claude-plugin/marketplace.json` 的 `plugins` 数组添一行（可选，只服务客户端用户）
3. 提 MR，审查通过后合并——**合并即上架，即发版**，全组 `git pull && ./install.sh` 即可拿到

命名用小写连字符（如 `commit-msg`），与目录名一致。

## 约定

- 第三方 skill 固定版本引入，升级同样走 MR
- 改 skill = 改文件 + MR，历史即审计记录
