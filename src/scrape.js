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

// ---- Color utilities for placeholder generation ----
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function srgbToLinear(c) {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}
function relativeLuminance({ r, g, b }) {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function hexToRgb(hex) {
  let h = hex.replace(/^#/, "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length < 6) return null;
  const num = parseInt(h.slice(0, 6), 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function rgbToHex({ r, g, b }) {
  const to2 = (n) => n.toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}
function parseRgbFunc(str) {
  // rgb(255, 0, 0) / rgba(255,0,0,0.5)
  const m = str.match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const parts = m[1].split(/\s*,\s*/).map((p) => p.trim());
  if (parts.length < 3) return null;
  const r = Math.max(0, Math.min(255, Math.round(parseFloat(parts[0]))));
  const g = Math.max(0, Math.min(255, Math.round(parseFloat(parts[1]))));
  const b = Math.max(0, Math.min(255, Math.round(parseFloat(parts[2]))));
  return { r, g, b };
}
function hslToRgb(h, s, l) {
  // h: [0,360), s,l: [0,1]
  h = ((h % 360) + 360) % 360; s = clamp01(s); l = clamp01(l);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1=0, g1=0, b1=0;
  if (h < 60) { r1=c; g1=x; b1=0; }
  else if (h < 120) { r1=x; g1=c; b1=0; }
  else if (h < 180) { r1=0; g1=c; b1=x; }
  else if (h < 240) { r1=0; g1=x; b1=c; }
  else if (h < 300) { r1=x; g1=0; b1=c; }
  else { r1=c; g1=0; b1=x; }
  return { r: Math.round((r1 + m) * 255), g: Math.round((g1 + m) * 255), b: Math.round((b1 + m) * 255) };
}
function parseHslFunc(str) {
  // hsl(210, 50%, 40%) / hsla(...)
  const m = str.match(/hsla?\(([^)]+)\)/i);
  if (!m) return null;
  const parts = m[1].split(/\s*,\s*/).map((p) => p.trim());
  if (parts.length < 3) return null;
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  return hslToRgb(h, s, l);
}
function collectCssColors(cssTexts) {
  const colorCounts = new Map();
  const addColor = (rgb) => {
    if (!rgb) return;
    const hex = rgbToHex(rgb).toLowerCase();
    colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
  };
  const hexRe = /#([0-9a-f]{3}|[0-9a-f]{6})\b/ig;
  const rgbRe = /rgba?\([^\)]+\)/ig;
  const hslRe = /hsla?\([^\)]+\)/ig;
  for (const text of cssTexts) {
    if (!text) continue;
    const t = String(text);
    let m;
    while ((m = hexRe.exec(t))) { addColor(hexToRgb(m[0])); }
    while ((m = rgbRe.exec(t))) { addColor(parseRgbFunc(m[0])); }
    while ((m = hslRe.exec(t))) { addColor(parseHslFunc(m[0])); }
  }
  const colors = Array.from(colorCounts.entries()).map(([hex, count]) => {
    const rgb = hexToRgb(hex); const lum = relativeLuminance(rgb);
    return { hex, rgb, lum, count };
  });
  return colors;
}
function choosePalette(colors) {
  if (!colors || colors.length === 0) {
    return [
      { hex: "#e5e7eb", rgb: hexToRgb("#e5e7eb"), lum: relativeLuminance(hexToRgb("#e5e7eb")) },
      { hex: "#1f2937", rgb: hexToRgb("#1f2937"), lum: relativeLuminance(hexToRgb("#1f2937")) },
      { hex: "#93c5fd", rgb: hexToRgb("#93c5fd"), lum: relativeLuminance(hexToRgb("#93c5fd")) },
    ];
  }
  // 上位色を頻度順→上位12色に絞る
  const top = [...colors].sort((a,b)=>b.count - a.count).slice(0, 12);
  // 輝度順
  const byLum = [...top].sort((a,b)=>a.lum - b.lum);
  const darkest = byLum[0];
  const lightest = byLum[byLum.length - 1];
  const middle = byLum[Math.floor(byLum.length / 2)];
  // サイクル用配列
  const others = byLum.filter(c => c !== darkest && c !== lightest && c !== middle);
  return [middle, darkest, lightest, ...others];
}
function pickTextColorForBackground(bg) {
  // シンプルに背景が明るければ濃色、暗ければ白
  return (bg.lum >= 0.6) ? "#111111" : "#ffffff";
}
function buildSvgDataUri({ width=600, height=400, bgHex, textHex, label="IMAGE" }) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n`+
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`+
  `  <rect width="100%" height="100%" fill="${bgHex}"/>\n`+
  `  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="${textHex}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="${Math.round(Math.min(width, height) * 0.12)}" font-weight="600">${esc(label)}</text>\n`+
  `</svg>`;
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return uri;
}

function generateLoremLabel(index) {
  const phrases = [
    "Lorem ipsum",
    "Dolor sit amet",
    "Consectetur",
    "Adipiscing elit",
    "Sed do eiusmod",
    "Tempor incididunt",
    "Ut labore",
    "Dolore magna",
  ];
  return phrases[index % phrases.length];
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
		console.error(
			"使い方: npm run scrape -- <URL> もしくは node src/scrape.js <URL>"
		);
		process.exit(1);
	}

	const normalizedUrl = normalizeUrl(inputUrl);

	const outDir = path.join(
		process.cwd(),
		"output",
		new URL(normalizedUrl).hostname
	);
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

	await page.goto(normalizedUrl, {
		waitUntil: "networkidle2",
		timeout: 60_000,
	});

	// 完全なHTML（SSRされたDOM）を取得
	const html = await page.content();

	// CSSを収集
	const { stylesheets, inlineStyles } = await extractStylesFromPage(page);

	// HTMLをcheerioで整形（不要なscriptなどを除外）
	const $ = cheerio.load(html);
	$("script").remove();
	$("link[rel='preload']").remove();
	$("link[rel='prefetch']").remove();

	// 画像・動画はプレースホルダに置換（サイトのCSSから抽出した色でSVG生成）
	try {
		const cssTexts = [
			...stylesheets.map((s) => (s && s.css) || ""),
			...inlineStyles.map((s) => (s && s.css) || ""),
		];
		const colors = collectCssColors(cssTexts);
		const palette = choosePalette(colors);
		let counter = 0;
    $("img").each((_, el) => {
			const idx = counter++;
			const bg = palette[idx % palette.length];
			const fgHex = pickTextColorForBackground(bg);
      const label = generateLoremLabel(idx);
			const uri = buildSvgDataUri({
				width: 600,
				height: 400,
				bgHex: bg.hex,
				textHex: fgHex,
				label,
			});
			$(el).attr("src", uri);
			$(el).removeAttr("srcset");
			$(el).removeAttr("sizes");
			$(el).attr("alt", "placeholder");
		});
	} catch (_) {
		// フォールバック: 1x1 gif
		$("img").each((_, el) => {
			$(el).attr(
				"src",
				"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
			);
			$(el).attr("alt", "placeholder");
		});
	}
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


