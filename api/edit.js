#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { getConfig } = require("../src/config");
const { spawn } = require("child_process");
const cheerio = require("cheerio");

// 簡易HTTPハンドラ（Vercel/Netlify Functions風）
// node api/edit.js serve でローカル開発サーバとしても利用可能

async function callOpenAI({ apiKey, system, user }) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`OpenAI error ${resp.status}: ${t}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

function tryParseEditPayload(content) {
  // 正規化
  content = String(content || "").replace(/\r/g, "\n").replace(/[\uFEFF\u200B]/g, "");
  // 1) そのままJSONとして
  try { return JSON.parse(content); } catch {}
  // 2) ```json ... ``` フェンス抽出
  const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try { return JSON.parse(fence[1]); } catch {}
  }
  // 3) 最初の { ... } ブロックを大雑把に抽出
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const maybe = content.slice(start, end + 1);
    try { return JSON.parse(maybe); } catch {}
  }
  return { raw: content };
}

function normalizeEdits(obj) {
  let edits = [];
  if (Array.isArray(obj)) {
    edits = obj;
  } else if (Array.isArray(obj?.edits)) {
    edits = obj.edits;
  } else if (Array.isArray(obj?.operations)) {
    edits = obj.operations;
  }
  return edits.map((e) => ({
    section: e.section ?? null,
    path: e.path ?? e.selector ?? null,
    op: e.op ?? e.operation ?? null,
    attr: e.attr ?? null,
    prop: e.prop ?? null,
    value: e.value ?? null,
  })).filter((e) => e.op && (e.path || e.section));
}

// ルートからの絶対CSSセレクタを生成（id優先、なければ tag:nth-of-type）
function buildAbsoluteSelector($, el) {
  const parts = [];
  let cur = el;
  let guard = 0;
  while (cur && cur.type === 'tag' && guard++ < 2048) {
    const tag = cur.name;
    const id = $(cur).attr('id');
    if (id) { parts.push(`#${id}`); break; }
    // nth-of-type を計算
    const parent = cur.parent;
    let index = 1;
    if (parent && parent.children) {
      for (const sib of parent.children) {
        if (sib === cur) break;
        if (sib && sib.type === 'tag' && sib.name === tag) index += 1;
      }
    }
    parts.push(`${tag}:nth-of-type(${index})`);
    cur = parent;
    if (cur && cur.type === 'root') break;
  }
  parts.reverse();
  return parts.join(' > ');
}

// "card3 の 4つ目の 画像" のような曖昧指定を補正
function applyClassOrdinalHeuristic($, text) {
  const result = [];
  const numMatch = text.match(/([0-9０-９]+)\s*(?:つ目|番目|個目|枚目)/);
  const classMatch = text.match(/([A-Za-z0-9_-]+)\s*(?:クラス|class)/i);
  if (!numMatch || !classMatch) return result;
  const raw = numMatch[1];
  const index = parseInt(String(raw).replace(/[０-９]/g, s => String('0123456789'.indexOf(s))), 10);
  if (!Number.isFinite(index) || index <= 0) return result;
  const cls = classMatch[1];

  // コンテナ: .<class>
  const container = $(`.${cls}`).first();
  if (!container || container.length === 0) return result;

  // 「直下の div の N番目の中の img」を優先。それが無ければ container 配下の img 全体のN番目
  let target = container.find('> div').eq(index - 1).find('img').first();
  if (!target || target.length === 0) {
    target = container.find('img').eq(index - 1);
  }
  if (!target || target.length === 0) return result;

  const abs = buildAbsoluteSelector($, target.get(0));
  if (!abs) return result;
  result.push({ path: abs, op: 'setAttr', attr: 'src', value: 'https://picsum.photos/600/400?random=ai' });
  return result;
}

function buildPrompt({ host, text, targetsJson }) {
  const system = "あなたは、自然言語の編集指示をHTML/CSS編集命令(JSON)に変換することでwebサイトを編集するエンジニアです。" +
    "対象の特定は口語的な意味を優先し data-section と相対セレクタ(path)で行い、操作は setText/setHTML/setAttr/setStyle のいずれかで表現してください。" +
    "背景色などセクション全体の見た目を変える指示の場合は、見出し(h1〜h6)を含む最も近い data-section 要素を対象に setStyle してください。" +
    "色名はCSSで解釈できる値にしてください（例: '薄い緑' → 'lightgreen' または '#e6f4ea'）。" +
    "出力は前置き無しの純粋なJSONで返してください。コードフェンス禁止。" +
    "画像の置換指示では <img> の src/srcset を更新してください。フリー素材の例として 'https://picsum.photos' を使っても構いません（例: https://picsum.photos/1200/800.webp）。" +
    "JSONのキーは必ず { message, edits } とし、message はユーザーが使用する主言語で変更内容の要約・注意点を説明、edits は [{section?, path, op, value?, attr?, prop?}] としてください。";
  const user = `対象ホスト: ${host}\nユーザ指示: ${text}\n\nセクションとターゲット例(JSON; 部分):\n${targetsJson}\n`;
  return { system, user };
}

async function handleEdit(req, res) {
  try {
    const { openaiApiKey } = getConfig();
    if (!openaiApiKey || openaiApiKey === "OPENAI_API_KEY") {
      res.statusCode = 500; res.end("OPENAI_API_KEY is not configured"); return;
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));

    const host = String(body.host || "").trim();
    const text = String(body.text || "").trim();
    if (!host || !text) { res.statusCode = 400; res.end("host and text are required"); return; }

    const outDir = path.join(process.cwd(), "output", host);
    const htmlPath = path.join(outDir, "index.html");
    if (!fs.existsSync(htmlPath)) { res.statusCode = 404; res.end("index.html not found"); return; }

    // プロンプト支援用に、ページ内の data-section と data-targets の一部、およびセクションカタログを抽出
    const html = fs.readFileSync(htmlPath, "utf8");
    const $ = cheerio.load(html);
    const targets = [];
    $('[data-section]').each((_, el) => {
      const sectionId = $(el).attr('data-section') || '';
      const dt = $(el).attr('data-targets') || '';
      if (!sectionId || !dt) return;
      try {
        const json = JSON.parse(dt);
        targets.push({ section: sectionId, keys: Object.keys(json), sample: json });
      } catch {}
    });
    const sections = [];
    $('[data-section]').each((idx, el) => {
      const sectionId = $(el).attr('data-section') || '';
      const tag = el.name || '';
      const idAttr = $(el).attr('id') || '';
      const classes = (($(el).attr('class') || '').split(/\s+/).filter(Boolean));
      const headingTexts = $(el).find('h1,h2,h3').slice(0,3).map((i,h)=>$(h).text().replace(/\s+/g,' ').trim().slice(0,80)).get();
      const roleHint = [tag, idAttr, ...classes].join(' ').toLowerCase();
      const kind = roleHint.includes('header') || tag === 'header' ? 'header'
                 : roleHint.includes('footer') || tag === 'footer' ? 'footer'
                 : (roleHint.includes('hero') || roleHint.includes('mv')) ? 'hero'
                 : 'section';
      sections.push({ index: idx, section: sectionId, tag, id: idAttr, classes, kind, headings: headingTexts });
    });

    const { system, user } = buildPrompt({ host, text, targetsJson: JSON.stringify({ targets, sections }, null, 2) });
    let content = await callOpenAI({ apiKey: openaiApiKey, system, user });
    const rawParsed = tryParseEditPayload(content);
    const edits = normalizeEdits(rawParsed);
    let finalEdits = edits;
    let message = typeof rawParsed?.message === "string" ? rawParsed.message : "変更内容を反映しました。";

    // フォールバック: LLMが特定できない場合の簡易ヒューリスティック
    if ((!finalEdits || finalEdits.length === 0) && /背景色/.test(text)) {
      // 1) h1があるセクション
      if (/h1/.test(text)) {
        const h1 = $('h1').first();
        if (h1 && h1.length) {
          const sec = h1.parents('[data-section]').first();
          const secId = sec.attr('data-section');
          if (secId) {
            finalEdits = [{ section: secId, op: 'setStyle', value: { 'background-color': '#d0f0c0' } }];
            message = `見出し(h1)を含むセクション(${secId})の背景色を変更しました。`;
          }
        }
      }
      // 2) メインビジュアル
      if ((!finalEdits || finalEdits.length === 0) && /(メインビジュアル|ヒーロー|MV)/i.test(text)) {
        const hero = $('[data-section].mv, [data-section].hero, [data-section] .mv, [data-section] .hero').closest('[data-section]').first();
        const secId = hero.attr('data-section');
        if (secId) {
          finalEdits = [{ section: secId, op: 'setStyle', value: { 'background-color': '#d0f0c0' } }];
          message = `メインビジュアル想定セクション(${secId})の背景色を変更しました。`;
        }
      }
    }

    // フォールバック: クラス + 序数（例: "card3 クラスの4つ目の画像"）
    if (!finalEdits || finalEdits.length === 0) {
      const e2 = applyClassOrdinalHeuristic($, text);
      if (e2.length > 0) {
        finalEdits = e2;
        message = message || "指定クラス内のN番目の画像を置換しました。";
      }
    }

    const payload = { message, edits: finalEdits || [], raw: content };

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(payload));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain");
    res.end(String(err?.stack || err));
  }
}

function isPreparedHost(host) {
  const outDir = path.join(process.cwd(), "output", host);
  const htmlPath = path.join(outDir, "index.html");
  return fs.existsSync(htmlPath);
}

function runNode(scriptRelPath, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(process.cwd(), scriptRelPath), ...args], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(); else reject(new Error(`${scriptRelPath} exited with code ${code}`));
    });
  });
}

async function handlePrepare(req, res) {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    let inputUrl = String(body.url || body.host || "").trim();
    const force = Boolean(body.force);
    if (!inputUrl) { res.statusCode = 400; res.end("url is required"); return; }
    if (!/^https?:\/\//i.test(inputUrl)) inputUrl = `https://${inputUrl}`;
    let host;
    try { host = new URL(inputUrl).hostname; } catch { res.statusCode = 400; res.end("invalid url"); return; }

    const outDir = path.join(process.cwd(), "output", host);
    if (force && fs.existsSync(outDir)) {
      await fs.promises.rm(outDir, { recursive: true, force: true });
    }

    if (isPreparedHost(host) && !force) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ host, prepared: true, skipped: true }));
      return;
    }

    // 1) scrape → 2) optimize → 3) tag
    await runNode("src/scrape.js", [inputUrl]);
    await runNode("src/optimize.js", [host]);
    await runNode("src/TagElements.js", [host]);

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ host, prepared: true }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain");
    res.end(String(err?.stack || err));
  }
}

async function handleStatus(req, res, urlObj) {
  try {
    const host = String(urlObj.searchParams.get("host") || "").trim();
    if (!host) { res.statusCode = 400; res.end("host query is required"); return; }
    const prepared = isPreparedHost(host);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ host, prepared }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain");
    res.end(String(err?.stack || err));
  }
}

async function handler(req, res) {
  // CORS 共通
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(""); return; }

  const urlObj = new URL(req.url, "http://localhost");
  const { pathname } = urlObj;
  if (pathname === "/api/edit" && req.method === "POST") return handleEdit(req, res);
  if (pathname === "/api/prepare" && req.method === "POST") return handlePrepare(req, res);
  if (pathname === "/api/status" && req.method === "GET") return handleStatus(req, res, urlObj);

  res.statusCode = 404;
  res.end("Not Found");
}

// 簡易サーバモード: node api/edit.js serve
if (require.main === module) {
  const mode = process.argv[2];
  if (mode === "serve") {
    const http = require("http");
    const server = http.createServer(handler);
    const port = process.env.PORT ? Number(process.env.PORT) : 8787;
    server.listen(port, () => console.log(`API listening on http://localhost:${port}`));
  } else {
    console.log("Usage: node api/edit.js serve");
  }
}

module.exports = handler;


