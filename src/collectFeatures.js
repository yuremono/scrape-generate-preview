#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeText(filePath, content) {
  ensureDirectoryExists(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

function toYaml(obj, indent = 0) {
  const pad = (n) => " ".repeat(n);
  if (obj === null) return "null";
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return obj.map((v) => `${pad(indent)}- ${toYaml(v, indent + 2).replace(/^\s+/, "")}`).join("\n");
  }
  if (typeof obj === "object") {
    const entries = Object.entries(obj);
    if (entries.length === 0) return "{}";
    return entries
      .map(([k, v]) => {
        const valYaml = toYaml(v, indent + 2);
        if (/^\{|^\[|\n/.test(valYaml)) return `${pad(indent)}${k}:\n${valYaml}`;
        return `${pad(indent)}${k}: ${valYaml}`;
      })
      .join("\n");
  }
  if (typeof obj === "string") {
    if (obj === "") return "''";
    if (/[:#\-\n]/.test(obj)) return JSON.stringify(obj);
    return obj;
  }
  return String(obj);
}

async function collectFeatures({ host, port = 5173 }) {
  const baseUrl = `http://localhost:${port}/${host}`;
  const targets = [
    `${baseUrl}/index.optimized.html`,
    `${baseUrl}/index.html`,
  ];

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);

  let urlToUse = null;
  for (const u of targets) {
    try {
      const res = await page.goto(u, { waitUntil: "networkidle2" });
      if (res && res.ok()) {
        urlToUse = u;
        break;
      }
    } catch (_) {}
  }
  if (!urlToUse) {
    await browser.close();
    throw new Error("ローカルプレビューに接続できませんでした。npm run preview を実行してください。");
  }

  const features = await page.evaluate(() => {
    const pick = (el, win = window) => {
      const cs = win.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const area = Math.max(0, rect.width) * Math.max(0, rect.height);
      const visible =
        cs.display !== "none" &&
        cs.visibility !== "hidden" &&
        parseFloat(cs.opacity || "1") > 0 &&
        area > 1;

      const hasHeading = el.querySelector("h1,h2,h3") !== null;
      const bg = cs.backgroundColor;
      const margin = { top: cs.marginTop, right: cs.marginRight, bottom: cs.marginBottom, left: cs.marginLeft };
      const padding = { top: cs.paddingTop, right: cs.paddingRight, bottom: cs.paddingBottom, left: cs.paddingLeft };
      const text = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120);
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || "",
        classes: (el.className || "").toString().split(/\s+/).filter(Boolean),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        visible,
        hasHeading,
        backgroundColor: bg,
        margin,
        padding,
        text,
        childCount: el.children ? el.children.length : 0,
      };
    };

    const candidates = new Set();
    const pushAll = (nodes) => nodes.forEach((n) => candidates.add(n));

    pushAll(Array.from(document.body.children));
    pushAll(Array.from(document.querySelectorAll("header, nav, main, footer, section, article, aside")));
    pushAll(Array.from(document.querySelectorAll("[id]")));
    pushAll(Array.from(document.querySelectorAll(".hero, .mv, .container, .row, .col, .card, .box, .grid")));

    const arr = Array.from(candidates).filter(Boolean);
    const picked = arr.map((el) => pick(el));
    // 可視かつ一定面積以上に限定
    const filtered = picked
      .map((f, idx) => ({ ...f, index: idx }))
      .filter((f) => f.visible && f.rect.width * f.rect.height >= 500);
    return { url: location.href, count: filtered.length, items: filtered };
  });

  await browser.close();

  const outDir = path.join(process.cwd(), "output", host);
  const jsonPath = path.join(outDir, "features.json");
  const ymlPath = path.join(outDir, "features.yml");
  writeText(jsonPath, JSON.stringify(features, null, 2));
  writeText(ymlPath, toYaml(features) + "\n");

  console.log("特徴量出力:", jsonPath);
  console.log("特徴量出力:", ymlPath);
}

async function main() {
  const host = process.argv[2];
  if (!host) {
    console.error("使い方: npm run collect:features -- <ホスト名>");
    process.exit(1);
  }
  await collectFeatures({ host });
}

main().catch((err) => {
  console.error("特徴量収集中にエラー:", err);
  process.exit(1);
});


