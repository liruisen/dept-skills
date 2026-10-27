# netlify-publish 快速入门

5 步把本地网页发布成公开链接，发给同事或朋友。macOS 和 Windows 通用。

## 前置条件

- Node.js 18 或更高版本。用 `node -v` 检查。
- Claude Code。

## 1. 注册 Netlify 并获取 Token

1. 打开 https://app.netlify.com 注册并登录。
2. 打开 https://app.netlify.com/user/settings#applications → 「Personal access tokens」→ 「New access token」。
3. 复制 Token，形如 `nfp_xxx...`。Token 只显示一次，立即保存。

## 2. 安装 skill

1. 解压 `netlify-publish.zip`，得到 `netlify-publish` 文件夹。
2. 把文件夹路径发给 Claude Code，让它装到 skills 目录。例如：

   > 把 /Users/你/Downloads/netlify-publish 装到 skills 目录

   Claude 会复制到 `~/.claude/skills/`（Windows 为 `%USERPROFILE%\.claude\skills\`）。

3. 执行 `/reload-skills` 加载 skill。

## 3. 配置 Token 和项目名

输入：

```
/netlify-publish setup
```

按 Claude 引导完成：粘贴 Token → 起项目名 → 复制 Claude 给出的命令运行。

警告：项目名不要用 `share`。这个名字几乎肯定已被占用，会自动变成 `share-随机后缀`，链接不美观。用独特名字，例如 `lirs-share`、名字或缩写。

## 4. 发布网页

告诉 Claude「发布 xxx.html」或「帮我把生成的这个 html 发布一下」，或输入：

```
/netlify-publish <文件或目录>
```

得到链接，格式：

```
https://文件名-YYMMDDHHMM--项目名.netlify.app
```

示例：

```
https://01-fluid-aurora-2608101309--lirs-share.netlify.app
```

注意：项目在首次发布时才真正创建（setup 阶段只记下了项目名）。新项目默认私有，所以首次得到的链接可能打不开——接着做第 5 步设为公开。

## 5. 把项目设为公开（首次发布后）

首次发布的链接默认打不开（项目私有，这是 Netlify 新项目的默认策略）。二选一设为公开：

单个项目：打开 `https://app.netlify.com/projects/<项目名>/configuration/general` → 「Visitor access」→ 选「Public」。

一劳永逸（推荐）：打开 https://app.netlify.com/teams → 选团队 → Settings → Access & security → Visitor access → 关闭默认保护。此后新建项目自动公开，无需再单独设置。

设好后链接即可打开，直接发给同事。单个 HTML 文件直达内容；目录会整目录发布；每次发布生成新链接，历史版本各自保留。

## 常见问题

**链接要登录或返回 401** — 项目是私有的，按第 4 步设为 Public。

**项目名变成带随机后缀** — 名字被占用了。换一个独特的名称，重新 `/netlify-publish setup`。

**Token 失效** — 到 https://app.netlify.com/user/settings#applications 重新生成，再 setup。
