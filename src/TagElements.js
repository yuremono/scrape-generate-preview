#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeText(filePath, content) {
  ensureDirectoryExists(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

// Minimal CSS.escape polyfill (sufficient for IDs/classes in selectors)
function cssEscape(value) {
  const str = String(value);
  let result = "";
  for (let i = 0; i < str.length; i += 1) {
    const codeUnit = str.charCodeAt(i);
    // Alphanumeric and underscore and hyphen are safe
    if (
      (codeUnit >= 0x0030 && codeUnit <= 0x0039) || // 0-9
      (codeUnit >= 0x0041 && codeUnit <= 0x005a) || // A-Z
      (codeUnit >= 0x0061 && codeUnit <= 0x007a) || // a-z
      codeUnit === 0x005f || // _
      codeUnit === 0x002d // -
    ) {
      result += str.charAt(i);
      continue;
    }
    // Space
    if (codeUnit === 0x0020) {
      result += "\\ ";
      continue;
    }
    // Everything else: escape as hex
    const hex = codeUnit.toString(16).toUpperCase();
    result += `\\${hex} `;
  }
  // If the first char is a digit, escape it
  if (/^[0-9]/.test(result)) {
    result = `\\3${result[0]} ${result.slice(1)}`;
  }
  return result;
}

function getElementKey(el) {
  const tag = el.tagName || el.name || "*";
  const id = (el.attribs && el.attribs.id) || "";
  const classAttr = (el.attribs && el.attribs.class) || "";
  const firstClass = classAttr.split(/\s+/).filter(Boolean)[0] || "";
  if (id) return id;
  if (firstClass) return firstClass;
  return tag;
}

function computePathFromAncestor($, ancestorEl, targetEl) {
  // Build a CSS-like path from ancestorEl (exclusive) to targetEl (inclusive)
  const parts = [];
  let cur = targetEl;

  // Safety guard to avoid infinite loops
  let steps = 0;
  while (cur && cur !== ancestorEl && steps < 2048) {
    steps += 1;
    const tag = cur.tagName || cur.name;
    if (!tag) break;

    const id = (cur.attribs && cur.attribs.id) || "";
    if (id) {
      parts.push(`#${cssEscape(id)}`);
      break; // id is unique enough; we can terminate early
    }

    // Determine nth-of-type among element siblings
    const parent = cur.parent;
    let indexOfType = 1;
    if (parent && parent.children) {
      for (const sibling of parent.children) {
        if (!sibling || sibling === cur) break;
        if (sibling.type === "tag") {
          const sTag = sibling.tagName || sibling.name;
          if (sTag === tag) indexOfType += 1;
        }
      }
    }

    const selectorPart = `${tag}:nth-of-type(${indexOfType})`;
    parts.push(selectorPart);
    cur = parent;
  }

  parts.reverse();
  return parts.join(" > ");
}

function uniqueElements(arr) {
  const seen = new Set();
  const out = [];
  for (const el of arr) {
    const key = el && el.startIndex !== undefined ? `${el.startIndex}` : `${Math.random()}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(el);
    }
  }
  return out;
}

function pickSectionCandidates($) {
  const candidates = [];
  // Obvious section containers
  $("header, nav, main, footer, section, article, aside").each((_, el) => candidates.push(el));
  // Any element with id (often meaningful blocks)
  $("[id]").each((_, el) => candidates.push(el));
  // Common layout/class names seen widely
  $(
    ".hero, .mv, .container, .row, .col, .card, .box, .grid, .wrapper, .content, .section, .block, .Product, .Cando, .form_wrap, .mv_img, .mv_it"
  ).each((_, el) => candidates.push(el));

  // Also include direct body children as top-level blocks
  $("body").children().each((_, el) => candidates.push(el));

  // Dedupe preserving order by element reference
  const out = [];
  const seenEls = new Set();
  for (const el of candidates) {
    if (!seenEls.has(el)) {
      seenEls.add(el);
      out.push(el);
    }
  }
  return out;
}

function collectTargetsWithin($, rootEl) {
  // Helper to build relative paths for all matches
  const buildPaths = (selector) => {
    const list = [];
    $(rootEl)
      .find(selector)
      .each((_, child) => {
        const rel = computePathFromAncestor($, rootEl, child);
        if (rel) list.push(rel);
      });
    return list;
  };

  // First match shortcuts
  const firstPath = (selector) => {
    const first = $(rootEl).find(selector).get(0);
    if (!first) return undefined;
    return computePathFromAncestor($, rootEl, first);
  };

  const targets = {
    // Headings
    title: firstPath("h1, h2, h3"),
    headings: buildPaths("h1, h2, h3, h4, h5, h6"),

    // Textual content
    paragraphs: buildPaths("p"),
    lists: buildPaths("ul, ol"),
    listItems: buildPaths("li"),

    // Media
    images: buildPaths("img"),
    pictureImages: buildPaths("picture img"),
    videos: buildPaths("video, source"),

    // Interactive
    links: buildPaths("a"),
    buttons: buildPaths("button, .btn, [role='button']"),

    // Forms
    forms: buildPaths("form"),
    inputs: buildPaths("input, textarea, select"),
  };

  return targets;
}

function tagSections({ host }) {
  const outDir = path.join(process.cwd(), "output", host);
  const optimizedHtmlPath = path.join(outDir, "index.optimized.html");
  const fallbackHtmlPath = path.join(outDir, "index.html");

  const srcHtmlPath = fs.existsSync(optimizedHtmlPath)
    ? optimizedHtmlPath
    : fallbackHtmlPath;

  if (!fs.existsSync(srcHtmlPath)) {
    throw new Error(`HTMLが見つかりません: ${srcHtmlPath}`);
  }

  const html = readText(srcHtmlPath);
  const $ = cheerio.load(html);

  const candidates = pickSectionCandidates($);

  // Track used keys for suffixing duplicates (id以外のキー前提)
  const usedCounts = new Map();

  for (const el of candidates) {
    let sectionKey = getElementKey(el);
    if (!sectionKey) continue;

    // If key comes from id, assume unique and do not suffix
    const hasId = Boolean(el.attribs && el.attribs.id);
    if (!hasId) {
      const prev = usedCounts.get(sectionKey) || 0;
      if (prev > 0) {
        // Add numeric suffix starting from 1 (e.g., "box-1", "box-2", ...)
        sectionKey = `${sectionKey}-${prev}`;
      }
      usedCounts.set(getElementKey(el), prev + 1);
    }

    // Attach data-section (unique per document)
    $(el).attr("data-section", sectionKey);

    // Collect targets within this section
    const targets = collectTargetsWithin($, el);
    try {
      const json = JSON.stringify(targets);
      $(el).attr("data-targets", json);
    } catch (_) {
      // Skip if stringify fails
    }
  }

  const outPath = path.join(outDir, "index.html");
  writeText(outPath, $.html({ decodeEntities: false }));
  console.log("タグ付け出力:", outPath);
}

async function main() {
  const host = process.argv[2];
  if (!host) {
    console.error("使い方: node src/TagElements.js <ホスト名> 例) node src/TagElements.js micro-f.co.jp");
    process.exit(1);
  }
  tagSections({ host });
}

if (require.main === module) {
  main().catch((err) => {
    console.error("タグ付け中にエラー:", err);
    process.exit(1);
  });
}


