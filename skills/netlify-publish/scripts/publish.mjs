#!/usr/bin/env node
// netlify-publish — 把静态 HTML 一键发布到 Netlify（无需 CLI，直接调 Deploy API）。
// 跨平台（macOS/Windows），零外部依赖，仅用 Node 内置模块。

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import readline from 'node:readline/promises';

const API = 'https://api.netlify.com/api/v1';
const CONFIG_DIR = path.join(os.homedir(), '.netlify-publish');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const IGNORE = new Set(['.DS_Store', 'Thumbs.db', '.git', 'node_modules']);
const TOKEN_HELP_URL = 'https://app.netlify.com/user/settings#applications';

// ---------------- config ----------------
async function readConfig() {
  try {
    return JSON.parse(await fs.readFile(CONFIG_FILE, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
}

async function writeConfig(cfg) {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  try { await fs.chmod(CONFIG_FILE, 0o600); } catch {}
}

function getToken(cfg) {
  return (process.env.NETLIFY_AUTH_TOKEN || cfg.token || '').trim();
}

// ---------------- api ----------------
class ApiError extends Error {
  constructor(method, p, status, text) {
    super(`API ${method} ${p} → ${status}: ${text.slice(0, 400)}`);
    this.status = status;
  }
}

async function api(method, urlPath, token, { body, headers = {} } = {}) {
  const res = await fetch(API + urlPath, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...headers },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new ApiError(method, urlPath, res.status, text);
  return text ? JSON.parse(text) : null;
}

// ---------------- token verify ----------------
async function verifyToken(token) {
  try {
    const u = await api('GET', '/user', token);
    return { ok: true, who: u.email || u.full_name || u.name || '已验证' };
  } catch (e) {
    return { ok: false, status: e.status };
  }
}

// ---------------- files ----------------
function sha1(buf) {
  return crypto.createHash('sha1').update(buf).digest('hex');
}

function posixRel(p) {
  return p.split(path.sep).join('/');
}

// PUT 路径：去掉前导 /，逐段 URL 编码，保留 / 作分隔符
function encodePutPath(posixPath) {
  return posixPath.replace(/^\//, '').split('/').map(encodeURIComponent).join('/');
}

function slug(name) {
  const s = name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'page';
}

function timeStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`; // YYMMDDHHMM
}

async function collectFiles(target) {
  const stat = await fs.stat(target);
  const base = path.resolve(target);
  const out = [];
  if (stat.isFile()) {
    out.push({ abs: base, rel: path.basename(base) });
    return out;
  }
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (IGNORE.has(entry.name) || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) out.push({ abs: full, rel: path.relative(base, full) });
    }
  }
  await walk(base);
  return out;
}

// ---------------- site ----------------
async function ensurePublic(siteId, token, s) {
  if (s.password_context !== 'all') return;
  // Netlify 新建站点默认 password_context='all'（访问需登录）。尝试设为公开：
  for (const v of ['_blank', '', null, 'none', 'non_primary']) {
    try {
      const upd = await api('PATCH', `/sites/${siteId}`, token, {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password_context: v }),
      });
      if (upd.password_context !== 'all') {
        console.error(`[setup] 已调整站点访问（password_context=${JSON.stringify(upd.password_context)}）`);
        return;
      }
    } catch (e) {
      if (e.status !== 422) throw e; // 422=该值无效，试下一个；其他错误抛出
    }
  }
  console.error('[setup] 警告：未能通过 API 关闭站点保护；若链接 401，请在 Netlify 项目设置 Visitor access 设为 Public');
}

async function ensureSite(cfg, token, nameOpt) {
  if (cfg.site_id) {
    const s = await api('GET', `/sites/${cfg.site_id}`, token);
    cfg.subdomain = s.subdomain || s.name;
    cfg.site_name = s.name;
    await ensurePublic(cfg.site_id, token, s);
    await writeConfig(cfg);
    return cfg;
  }
  const baseName = (nameOpt || cfg.default_name || 'share').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '') || 'share';
  for (let attempt = 0; attempt < 4; attempt++) {
    const name = attempt === 0 ? baseName : `${baseName}-${crypto.randomBytes(3).toString('hex')}`;
    try {
      const s = await api('POST', '/sites', token, {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      cfg.site_id = s.id;
      cfg.site_name = s.name;
      cfg.subdomain = s.subdomain || s.name;
      await ensurePublic(cfg.site_id, token, s);
      await writeConfig(cfg);
      console.error(`[setup] 已创建站点：${s.name} → https://${cfg.subdomain}.netlify.app`);
      return cfg;
    } catch (e) {
      if ((e.status === 422 || e.status === 409) && attempt < 3) continue; // 名称冲突，换随机后缀重试
      throw e;
    }
  }
}

// ---------------- publish ----------------
async function publish(target, opts) {
  const cfg = await readConfig();
  const token = getToken(cfg);
  if (!token) {
    console.error('未找到 token。请先在你自己的终端运行: node publish.mjs --setup');
    process.exit(1);
  }

  await ensureSite(cfg, token, opts.name);

  const files = await collectFiles(path.resolve(target));
  if (!files.length) throw new Error('没有可发布的文件：' + target);
  if (files.length === 1) files[0].rel = 'index.html'; // 单文件映射到根路径，根链接直达内容

  const alias = (opts.alias || `${slug(path.basename(path.resolve(target)))}-${timeStamp()}`)
    .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');

  // 计算每个文件 SHA1，构建 { "/路径": sha } 与 sha → {buf,path} 反查
  const fileMap = {};
  const shaInfo = {}; // sha -> { key, buf }
  for (const f of files) {
    const buf = await fs.readFile(f.abs);
    const sha = sha1(buf);
    const key = '/' + posixRel(f.rel);
    fileMap[key] = sha;
    if (!shaInfo[sha]) shaInfo[sha] = { key, buf };
  }

  // 创建 deploy（branch=alias 生成独立版本链接；title 显示在 Netlify 后台）
  const title = opts.title || path.basename(path.resolve(target));
  const deploy = await api('POST', `/sites/${cfg.site_id}/deploys`, token, {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: fileMap, branch: alias, title }),
  });
  const deployId = deploy.id;
  const required = deploy.required || [];

  // 上传 required 里的文件（兼容 sha 数组或 path 数组两种返回）
  let uploaded = 0;
  for (const item of required) {
    let info = shaInfo[item];
    if (!info) {
      const key = item.startsWith('/') ? item : '/' + item;
      const f = files.find((x) => '/' + posixRel(x.rel) === key);
      if (!f) continue;
      info = { key, buf: await fs.readFile(f.abs) };
    }
    await api('PUT', `/deploys/${deployId}/files/${encodePutPath(info.key)}`, token, {
      headers: { 'Content-Type': 'application/octet-stream' },
      body: info.buf,
    });
    uploaded++;
  }

  // 轮询直到 ready
  let state = deploy.state;
  for (let i = 0; i < 30 && state !== 'ready' && state !== 'error'; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    state = (await api('GET', `/deploys/${deployId}`, token)).state;
  }

  const aliasUrl = `https://${alias}--${cfg.subdomain}.netlify.app`;
  const permalink = deploy.deploy_ssl_url || aliasUrl;

  // stdout 第一行 = 主链接（供调用方解析）；stderr = 人类可读详情
  console.log(aliasUrl);
  console.error(`\n✅ 发布完成`);
  console.error(`   链接   : ${aliasUrl}`);
  console.error(`   备用   : ${permalink}`);
  console.error(`   站点   : https://${cfg.subdomain}.netlify.app`);
  console.error(`   上传   : ${uploaded} 个文件（共 ${files.length}）`);
  console.error(`   状态   : ${state}${state !== 'ready' ? '（CDN 可能仍在处理，几秒后刷新即可）' : ''}`);
}

// ---------------- setup / check ----------------
async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

async function setup(opts = {}) {
  let token = (opts.token || '').trim();
  // 1) --token 参数 / 2) stdin 管道（非 TTY，CI 等非交互场景）
  if (!token && !process.stdin.isTTY) token = (await readStdin()).trim();
  // 3) 交互式（TTY：用户在自己终端 / `!` 前缀运行时）—— 小白友好，粘贴回车即可
  if (!token && process.stdin.isTTY) {
    console.log('');
    console.log('═'.repeat(56));
    console.log('  Netlify Token 配置');
    console.log('═'.repeat(56));
    console.log('还没有 token？打开下面地址生成（Personal access tokens → New access token）：');
    console.log('  ' + TOKEN_HELP_URL);
    console.log('');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      token = (await rl.question('请粘贴你的 token（形如 nfp_xxx...）后回车：\n> ')).trim();
    } finally {
      rl.close();
    }
    console.log('');
  }
  if (!token) {
    const existing = await readConfig();
    token = (existing.token || '').trim();   // 未提供新 token 则复用已配置的
  }
  if (!token) {
    console.error('❌ 未输入 token，配置已取消。');
    console.error('   请在你自己的终端运行：node publish.mjs --setup');
    process.exit(1);
  }
  // 验证 token（脚本内部 fetch，token 不进命令行）
  process.stderr.write('正在验证 token...');
  const v = await verifyToken(token);
  if (!v.ok) {
    console.error('\n❌ token 验证失败（HTTP ' + v.status + '）。请确认 token 正确且未过期。');
    console.error('   生成地址：' + TOKEN_HELP_URL);
    process.exit(1);
  }
  console.error(' 通过（账户：' + v.who + '）');
  const cfg = await readConfig();
  cfg.token = token;
  if (opts.name) {
    cfg.default_name = opts.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '') || 'share';
    delete cfg.site_id;     // 指定新项目名 → 下次发布新建站点（弃用旧站）
    delete cfg.site_name;
    delete cfg.subdomain;
    console.error('   项目名 : ' + cfg.default_name + '（下次发布将创建新站点）');
  }
  await writeConfig(cfg);
  console.error('✅ token 已保存到 ' + CONFIG_FILE + '（权限 600）');
  if (!opts.name) {
    console.error('   ⚠️ 未指定项目名，将用默认 "share"——它几乎肯定被占用，会自动变成 share-随机后缀。');
    console.error('      建议起个独特名字：node publish.mjs --setup --name <你的名字或缩写>');
  }
  console.error('   现在可以发布了：node publish.mjs <文件或目录>');
}

async function check() {
  const cfg = await readConfig();
  const token = getToken(cfg);
  if (!token) {
    console.log('token : 未配置（请运行: node publish.mjs --setup）');
    process.exit(1);
  }
  const v = await verifyToken(token);
  console.log('token : ' + (v.ok ? `有效（${v.who}）` : `无效（HTTP ${v.status}，请重新 --setup）`));
  console.log('site  : ' + (cfg.site_id ? `${cfg.site_name}（已建站）` : '未建站（首次发布自动创建）'));
  process.exit(v.ok ? 0 : 1);
}

// ---------------- main ----------------
function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--setup') opts.setup = true;
    else if (a === '--token') opts.token = argv[++i];
    else if (a === '--alias') opts.alias = argv[++i];
    else if (a === '--title') opts.title = argv[++i];
    else if (a === '--name') opts.name = argv[++i];
    else if (a === '--check') opts.check = true;
    else if (a === '-h' || a === '--help') opts.help = true;
    else opts._.push(a);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || (!opts.setup && !opts.check && opts._.length === 0)) {
    console.log(`netlify-publish — 静态 HTML 一键发布到 Netlify（无需 CLI）

用法：
  node publish.mjs <文件|目录> [--alias 别名] [--name 站点名]
  node publish.mjs --setup                 # 交互式配置 token（在自己终端运行）
  node publish.mjs --check                 # 检查 token 与站点状态

首次发布会自动创建一个 Netlify 站点。每次发布生成独立版本链接。
token 优先级：环境变量 NETLIFY_AUTH_TOKEN > ~/.netlify-publish/config.json`);
    return;
  }
  if (opts.setup) return setup(opts);
  if (opts.check) return check();
  return publish(opts._[0], opts);
}

main().catch((e) => {
  console.error('❌ ' + (e && e.message ? e.message : e));
  process.exit(1);
});
