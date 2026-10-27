---
description: 把静态 HTML（单个文件或整个目录）一键发布到 Netlify 并返回可分享的公开链接，无需安装 Netlify CLI。当用户想把网页、HTML、PRD、demo、原型、设计稿、页面发布上线、生成链接发给同事或朋友，或说"发布到 netlify"、"部署这个网页"、"给我一个链接"、"把这个 html 传上去"、"上线看看效果"、"分享这个页面"时使用。仅支持静态文件（无 vite/react 等构建）。跨平台（macOS/Windows 通用），仅靠一个 Netlify token。
name: netlify-publish
---
# netlify-publish —— 静态网页一键发布

把静态 HTML 发布到 Netlify，返回可分享的独立链接。无需 Netlify CLI，仅靠一个 token；首次自动建站，每次发布生成独立版本链接（历史版本各自保留）。

## 脚本位置

发布脚本在本 skill 目录下的 `scripts/publish.mjs`。**调用时用本 skill 的实际绝对路径**（加载本 skill 时系统会给出 base directory），不要依赖 `~` 展开——Windows 的 cmd 不支持 `~`。下文用 `$SKILL` 代指本 skill 的绝对目录。

## 前置

- **Node 18+**（脚本用原生 `fetch`/`crypto`）。未装则先提示用户安装 Node。

## 配置 token（当用户运行 `/netlify-publish setup`，或要配置 / 更新 token）

⚠️ **核心原则：Claude 只「引导 + 验证」，绝不直接写入 token。** Claude 执行或写入 token 会被权限系统拦截（凭证泄露）；token 必须由用户自己执行命令保存。所以这里是**对话式引导**，一步步带用户完成，非技术人也能跟着走。

用户敲 `/netlify-publish setup`（不带 token）后，按下面 **4 步**引导，**每步等用户回应再继续**：

**① 引导生成 token**
告诉用户：发布需要一个 Netlify token。请打开
https://app.netlify.com/user/settings#applications → **Personal access tokens** → New access token，生成后复制（形如 `nfp_xxx...`）。没账号先注册登录 Netlify。

**② 收集 token 和项目名**
请用户把 token **粘贴到对话**。同时问：**项目名想叫什么？**

> ⚠️ **务必提醒用户**：默认值 `share` 几乎肯定**已被全局占用**（太通用），硬要用会自动变成 `share-随机后缀`（如 `share-324820`），链接难看。**引导用户设一个独特、有意义的名字**——小写字母/数字/连字符，如 `lrs-share`、名字或缩写。它会出现在每个链接里：`别名--项目名.netlify.app`。

**③ 保存（用户自己执行）**
拿到 token 后，让用户用 `!` 前缀运行下面命令（用户自己执行，token 不经 Claude 工具，故不受权限拦截；脚本会自动验证 token 有效才保存）：

```
! node "$SKILL/scripts/publish.mjs" --setup --token <用户token> --name <项目名>
```

把 `<用户token>` 换成真实 token、`<项目名>` 换成用户选的名字；用户没指定项目名就省略 `--name`（默认 `share`）。看到 `✅ token 已保存` 即成功。

**④ 验证（Claude 执行）**
用户跑完后，Claude 运行**不含 token**的命令确认：

```bash
node "$SKILL/scripts/publish.mjs" --check
```

输出 `token : 有效（…）` 即配置成功，可进入发布；`无效` 则引导用户重新生成 token 再来。

> **为何用 `--token` 而非交互式**：Claude Code 的 `!` 命令不是交互终端，读不到键盘输入，所以必须把 token 作为参数传入。
> **想交互式粘贴**：让用户在独立终端（macOS Terminal.app / Windows PowerShell，那里才是真 TTY）运行 `node "$SKILL/scripts/publish.mjs" --setup`，按提示粘贴 token 回车。
> token 存于 `~/.netlify-publish/config.json`（权限 600）；也支持环境变量 `NETLIFY_AUTH_TOKEN`（优先级更高）。
> **Windows**：`$SKILL` 用实际绝对路径，命令在 PowerShell 跑。

## 发布

```bash
node "$SKILL/scripts/publish.mjs" <文件或目录> [--alias 别名]
```

- 传 `.html` 文件 → 发布单文件；传目录 → 递归发布整目录（含 assets，自动忽略 `.DS_Store` 等隐藏文件）。
- `--alias`：可选，自定义版本别名（生成 `<alias>--<站点>.netlify.app`）。不传则自动用 `<文件名>-<YYMMDDHHMM>`，每次链接不同、历史保留。
- **首次发布会自动创建一个 Netlify 站点并记到配置里**，用户无需干预，也无需手动管 site_id。

**输出**：stdout 第一行是主链接（`https://<alias>--<站点>.netlify.app`），直接转交给用户即可；stderr 有人类可读的详情。

## 执行要点

1. 脚本报"未找到 token" → 先走上面的 setup（向用户索取 token）。
2. 发布成功后，把 stdout 第一行链接明确交给用户，并说明这是本次的独立版本链接、历史版本各自保留。
3. 用户只说"发布这个页面"但没指定文件 → 先确认目标文件或目录路径。
4. 发布带 assets 的目录时，确认目录路径正确——脚本会上传目录下所有非隐藏文件。
5. **跨平台**：脚本只用 Node 内置模块、不调系统命令，macOS/Windows 通用。Windows 下把命令里的 `~` 换成 `$HOME`（PowerShell）或 `%USERPROFILE%`（cmd），`$SKILL` 用实际绝对路径。

## 常见问题

- **链接 401 / 跳转到登录页（访问时，非 token 问题）**：Netlify 新 team 默认把项目设为**私有**。首次发布（新建站点）后若链接要求登录，去 `https://app.netlify.com/projects/<站点名>/configuration/general` → **Visitor access** → 设为 **Public**（每个站点一次即可）。想一劳永逸，在 **Team settings → Access & security → Visitor access** 关闭默认保护。（这是平台政策，API 暂无法自动关闭；脚本已在发布时尝试自动处理。）
- **401 / token 报错（发布时报）**：token 失效或权限不足，重新生成并 `--setup`。
- **链接打开 502 / 还没好**：CDN 处理中，几秒后刷新即可（脚本已轮询最多 30s）。
- **站点名冲突**：脚本首次建站时已自动换随机后缀重试，无需处理。
- **单文件发布**：脚本自动映射到 `/index.html`，所以根链接直达内容，无需拼文件名。
