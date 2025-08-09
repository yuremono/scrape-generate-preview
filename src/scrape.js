#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const url = require("url");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const postcss = require("postcss");
const safeParser = require("postcss-safe-parser");

/**
 * Usage:
 *   npm run scrape -- https://example.com
 *   or
 *   node src/scrape.js https://example.com
 */

function ensureDirectoryExists(targetDirPath) {
  if (!fs.existsSync(targetDirPath)) {
    fs.mkdirSync(targetDirPath, { recursive: true });
  }
}

function normalizeUrl(providedUrl) {
  try {
    const normalized = new url.URL(providedUrl);
    return normalized.toString();
  } catch (error) {
    throw new Error(`URLが不正です: ${providedUrl}`);
  }
}

async function extractStylesFromPage(page) {
  // すべての<link rel="stylesheet">のCSSテキスト、style要素の内容、computed stylesではなく静的CSSを収集
  const { stylesheets, inlineStyles } = await page.evaluate(async () => {
    const absoluteUrl = (relative) => new URL(relative, location.href).toString();

    const linkNodes = Array.from(
      document.querySelectorAll('link[rel="stylesheet"]')
    );
    const styleNodes = Array.from(document.querySelectorAll("style"));

    const stylesheets = await Promise.all(
      linkNodes.map(async (link) => {
        try {
          const href = link.getAttribute("href");
          if (!href) return null;
          const res = await fetch(absoluteUrl(href));
          if (!res.ok) return null;
          const text = await res.text();
          return { href: absoluteUrl(href), css: text };
        } catch (e) {
          return null;
        }
      })
    );

    const inlineStyles = styleNodes.map((node, idx) => ({
      id: `inline-style-${idx + 1}`,
      css: node.textContent || "",
    }));

    return {
      stylesheets: stylesheets.filter(Boolean),
      inlineStyles,
    };
  });

  return { stylesheets, inlineStyles };
}

async function parseAndFormatCss(cssText) {
  try {
    const root = postcss.parse(cssText, { parser: safeParser });
    return root.toResult({ map: false }).css;
  } catch (error) {
    // 解析に失敗しても元のテキストを返す
    return cssText;
  }
}

async function saveScrapedAssets({ targetDirPath, html, cssAssets }) {
  ensureDirectoryExists(targetDirPath);

  const htmlPath = path.join(targetDirPath, "index.html");
  fs.writeFileSync(htmlPath, html, "utf8");

  const cssDir = path.join(targetDirPath, "styles");
  ensureDirectoryExists(cssDir);

  const manifest = [];
  for (const asset of cssAssets) {
    const baseName = asset.name || "styles.css";
    const filePath = path.join(cssDir, baseName);
    fs.writeFileSync(filePath, asset.css, "utf8");
    manifest.push({
      name: baseName,
      path: `./styles/${baseName}`,
      originHref: asset.originHref || null,
      originId: asset.originId || null,
    });
  }

  const manifestPath = path.join(targetDirPath, "css-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify({ assets: manifest }, null, 2), "utf8");

  return { htmlPath, cssDir, manifestPath };
}

async function main() {
  const inputUrl = process.argv[2];
  if (!inputUrl) {
    console.error("使い方: npm run scrape -- <URL> もしくは node src/scrape.js <URL>");
    process.exit(1);
  }

  const normalizedUrl = normalizeUrl(inputUrl);

  const outDir = path.join(process.cwd(), "output", new URL(normalizedUrl).hostname);
  ensureDirectoryExists(outDir);

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    // 画像や動画などはスキップ（差し替え方針のため）
    if (["image", "media", "font"].includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  await page.goto(normalizedUrl, { waitUntil: "networkidle2", timeout: 60_000 });

  // 完全なHTML（SSRされたDOM）を取得
  const html = await page.content();

  // CSSを収集
  const { stylesheets, inlineStyles } = await extractStylesFromPage(page);

  // HTMLをcheerioで整形（不要なscriptなどを除外）
  const $ = cheerio.load(html);
  $("script").remove();
  $("link[rel='preload']").remove();
  $("link[rel='prefetch']").remove();

  // 画像・動画はダミー置換
  $("img").each((_, el) => {
    $(el).attr("src", "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==");
    $(el).attr("alt", "placeholder");
  });
  $("video, source").remove();

  // 収集したCSSをPostCSSで安全に整形（ローカル保存のみ。HTMLの<link>は維持）
  const cssAssets = [];

  for (let i = 0; i < stylesheets.length; i += 1) {
    const sheet = stylesheets[i];
    const formatted = await parseAndFormatCss(sheet.css);
    const name = `external-${i + 1}.css`;
    cssAssets.push({ name, css: formatted, originHref: sheet.href });
  }

  for (let i = 0; i < inlineStyles.length; i += 1) {
    const inline = inlineStyles[i];
    const formatted = await parseAndFormatCss(inline.css);
    const name = `inline-${i + 1}.css`;
    cssAssets.push({ name, css: formatted, originId: inline.id });
  }

  // 元HTMLの<link rel="stylesheet">や<style>は維持
  const cleanedHtml = $.html({ decodeEntities: false });

  const { htmlPath, cssDir, manifestPath } = await saveScrapedAssets({
    targetDirPath: outDir,
    html: cleanedHtml,
    cssAssets,
  });

  await browser.close();

  console.log("保存先:", outDir);
  console.log("HTML:", htmlPath);
  console.log("CSSディレクトリ:", cssDir);
  console.log("CSSマニフェスト:", manifestPath);
}

main().catch((error) => {
  console.error("エラーが発生しました:", error);
  process.exit(1);
});


