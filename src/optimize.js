#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cheerio = require("cheerio");
const postcss = require("postcss");

function ensureDirectoryExists(targetDirPath) {
  if (!fs.existsSync(targetDirPath)) {
    fs.mkdirSync(targetDirPath, { recursive: true });
  }
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeText(filePath, content) {
  ensureDirectoryExists(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

function generateHash(input) {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 8);
}

function normalizeCssDeclarations(styleText) {
  return styleText
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((decl) => {
      const [prop, ...rest] = decl.split(":");
      return `${(prop || "").trim()}:${(rest.join(":") || "").trim()}`;
    })
    .sort()
    .join(";");
}

function replaceAllLinksWithHash($) {
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (href !== "#") {
      $(el).attr("href", "#");
    }
  });
}

function anonymizeTextNodes($) {
  const walker = (node) => {
    node.children && node.children.forEach(walker);
    if (node.type === "text") {
      const original = node.data || "";
      const normalized = original.replace(/\s+/g, " ");
      if (normalized.trim().length === 0) return;
      // 日本語らしさが高い場合は日本語のダミー、その他は英語風のダミー
      const isLikelyJapanese = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(normalized);
      const token = isLikelyJapanese ? "ダミーテキスト" : "lorem";
      const repeat = Math.max(1, Math.round(normalized.length / token.length));
      const replacement = Array.from({ length: repeat })
        .map(() => token)
        .join(isLikelyJapanese ? "" : " ")
        .slice(0, normalized.length);
      node.data = replacement;
    }
  };
  walker($.root()[0]);
}

function extractInlineStylesAndRewriteHtml($) {
  // 指示により、style 属性の抽出・クラス化は行わない。
  // 画像については style からの width/height 情報を補完するのみ。
  $("img[style]").each((_, el) => {
    const styleTextRaw = ($(el).attr("style") || "").trim();
    if (!styleTextRaw) return;
    try {
      const widthMatch = styleTextRaw.match(/(?:^|;|\s)width\s*:\s*(\d+(?:\.\d+)?)px/i);
      const heightMatch = styleTextRaw.match(/(?:^|;|\s)height\s*:\s*(\d+(?:\.\d+)?)px/i);
      if (widthMatch && !$(el).attr("width")) {
        $(el).attr("width", String(Math.round(parseFloat(widthMatch[1]))));
      }
      if (heightMatch && !$(el).attr("height")) {
        $(el).attr("height", String(Math.round(parseFloat(heightMatch[1]))));
      }
    } catch (_) {}
  });
  return ""; // 追加CSSは生成しない
}

function isSelectorSafelisted(selector) {
  return /\.js-/.test(selector) || /\.is-/.test(selector) || /\.active/.test(selector);
}

function simplifySelectorForMatch(selector) {
  // 疑似クラス・疑似要素・:not() 内はざっくり削除して、マッチ検出用の簡易セレクタを返す
  let s = selector;
  // :not(...) 丸ごと削除
  s = s.replace(/:not\((?:[^()]+|\([^()]*\))*\)/g, "");
  // 疑似クラス・疑似要素を削除（:hover, :focus, :active, ::before 等）
  s = s.replace(/:{1,2}[a-zA-Z-]+(\([^)]*\))?/g, "");
  // 連続スペース整理
  s = s.replace(/\s+/g, " ").trim();
  return s || selector; // 空になったら元を返しておく（安全側）
}

function selectorMatchesDom($, selector) {
  try {
    const simplified = simplifySelectorForMatch(selector);
    // cheerio が未対応のセレクタが含まれる場合エラーに備える
    const count = $(simplified).length;
    return count > 0;
  } catch (e) {
    return true; // よく分からないものは削除しない（安全側）
  }
}

function collectLeadingComments(root) {
  const comments = [];
  for (const node of root.nodes || []) {
    if (node.type === "comment") {
      comments.push(node.text);
    } else if (node.type === "atrule" && node.name === "charset") {
      // @charset は先頭維持
      comments.push(`@charset ${node.params};`);
    } else if (node.type !== "comment") {
      break;
    }
  }
  return comments;
}

function purgeUnusedCss(cssText, $) {
  const root = postcss.parse(cssText);
  const leadingComments = collectLeadingComments(root);

  const newRoot = postcss.root();
  // 先頭コメントを移設
  for (const c of leadingComments) {
    if (c.startsWith("@charset")) {
      newRoot.append(postcss.atRule({ name: "charset", params: c.replace(/^@charset\s+|;$/g, "") }));
    } else {
      newRoot.append(postcss.comment({ text: c }));
    }
  }

  function processContainer(container, outContainer) {
    container.each((node) => {
      if (node.type === "rule") {
        // セレクタを分割して使用されているものだけ残す
        const parts = node.selectors || String(node.selector || "").split(",");
        const keptSelectors = parts
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((sel) => isSelectorSafelisted(sel) || selectorMatchesDom($, sel));

        if (keptSelectors.length > 0) {
          const newRule = postcss.rule({ selector: keptSelectors.join(", ") });
          node.nodes && node.nodes.forEach((decl) => newRule.append(decl.clone()));
          outContainer.append(newRule);
        }
      } else if (node.type === "atrule") {
        if (node.name === "media") {
          const newAt = postcss.atRule({ name: node.name, params: node.params });
          processContainer(node, newAt);
          if (newAt.nodes && newAt.nodes.length > 0) {
            outContainer.append(newAt);
          }
        } else if (node.name === "keyframes") {
          // キーフレームは温存
          outContainer.append(node.clone());
        } else {
          // その他の at-rule はそのまま温存
          outContainer.append(node.clone());
        }
      } else if (node.type === "comment") {
        outContainer.append(node.clone());
      } else {
        // その他（例：空行）はスキップ
      }
    });
  }

  processContainer(root, newRoot);
  return newRoot.toResult({ map: false }).css;
}

function buildStructuredOutline($) {
  // 視覚的に明確なセクションを近似：body直下、および id を持つ大きめのブロックを抽出
  const sections = [];

  const topLevel = $("body").children();
  topLevel.each((_, el) => {
    const $el = $(el);
    const tag = el.tagName || el.name || "";
    const id = $el.attr("id") || "";
    const classList = ($el.attr("class") || "").split(/\s+/).filter(Boolean);
    const text = $el.text().replace(/\s+/g, " ").trim().slice(0, 120);

    // 子ブロック（idや見出しを持つもの）
    const childBlocks = [];
    $el.find("section, article, [id], h1, h2, h3").each((__, child) => {
      const $c = $(child);
      const tagC = child.tagName || child.name || "";
      const idC = $c.attr("id") || "";
      const classListC = ($c.attr("class") || "").split(/\s+/).filter(Boolean);
      const textC = $c.text().replace(/\s+/g, " ").trim().slice(0, 80);
      if (idC || /h[1-3]/i.test(tagC) || /section|article/i.test(tagC)) {
        childBlocks.push({ tag: tagC, id: idC, classes: classListC, text: textC });
      }
    });

    sections.push({ tag, id, classes: classList, text, children: childBlocks.slice(0, 30) });
  });

  return { sections };
}

function toYaml(obj, indent = 0) {
  const pad = (n) => " ".repeat(n);
  if (obj === null) return "null";
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return obj
      .map((v) => `${pad(indent)}- ${toYaml(v, indent + 2).replace(/^\s+/, "")}`)
      .join("\n");
  }
  if (typeof obj === "object") {
    const entries = Object.entries(obj);
    if (entries.length === 0) return "{}";
    return entries
      .map(([k, v]) => {
        const valYaml = toYaml(v, indent + 2);
        if (/^\{|^\[|\n/.test(valYaml)) {
          return `${pad(indent)}${k}:\n${valYaml}`;
        }
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

async function main() {
  const host = process.argv[2];
  if (!host) {
    console.error("使い方: npm run optimize -- <ホスト名> 例) npm run optimize -- micro-f.co.jp");
    process.exit(1);
  }

  const siteDir = path.join(process.cwd(), "output", host);
  const htmlPath = path.join(siteDir, "index.html");
  const optimizedHtmlPath = path.join(siteDir, "index.optimized.html");
  const stylesDir = path.join(siteDir, "styles");
  const manifestPath = path.join(siteDir, "css-manifest.json");

  if (!fs.existsSync(htmlPath)) {
    console.error(`HTMLが見つかりません: ${htmlPath}`);
    process.exit(1);
  }

  const html = readText(htmlPath);
  const $ = cheerio.load(html);

  // 1) インラインスタイル抽出 -> .i-<hash> クラス化
  const inlineCss = extractInlineStylesAndRewriteHtml($);
  const inlineCssPath = path.join(stylesDir, "inline-extracted.css");
  const shouldWriteInline = Boolean(inlineCss && inlineCss.trim().length > 0);
  if (shouldWriteInline) {
    writeText(inlineCssPath, inlineCss);
  }

  // 2) リンクのダミー化
  replaceAllLinksWithHash($);

  // 3) テキストの匿名化は一旦無効化（後段AI処理後に実施）
  // anonymizeTextNodes($);

  // 4) CSSの未使用セレクタ削除（ファイル単位）。CDNはそのまま、同一ホストのCSSのみ最適化して差し替え
  let manifest = null;
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(readText(manifestPath));
    } catch (_) {
      manifest = null;
    }
  }

  if (manifest && Array.isArray(manifest.assets)) {
    for (const asset of manifest.assets) {
      const { name, originHref } = asset;
      if (!name || !originHref) continue;
      try {
        const urlObj = new URL(originHref);
        const isSameHost = urlObj.hostname === host;
        if (!isSameHost) {
          // CDN/外部は変更しない
          continue;
        }
        const cssFilePath = path.join(stylesDir, name);
        if (!fs.existsSync(cssFilePath)) continue;
        let targetName = name; // デフォルトは元CSSにフォールバック
        try {
          const cssText = readText(cssFilePath);
          const purged = purgeUnusedCss(cssText, $);
          const optimizedName = `optimized-${name}`;
          const optimizedPath = path.join(stylesDir, optimizedName);
          writeText(optimizedPath, purged);
          targetName = optimizedName;
        } catch (_) {
          // フォールバックで元CSSを使う
        }
        // HTML内の該当<link>を書き換え（絶対/ルート相対/相対 すべて対応）
        const variants = new Set([
          originHref,
          urlObj.pathname, // 例: /css/style.css
          urlObj.pathname.replace(/^\//, ""), // 例: css/style.css
        ]);
        $("link[rel='stylesheet']").each((_, el) => {
          const hrefCur = ($(el).attr("href") || "").trim();
          if (!hrefCur) return;
          if (variants.has(hrefCur)) {
            $(el).attr("href", `./styles/${targetName}`);
          }
        });
      } catch (_) {
        // 解析できなければスキップ
      }
    }
  }

  // 5) 最適化HTMLを書き出し（既存の<link>は維持。必要なら inline-extracted.css を追加）
  const head = $("head");
  if (inlineCss && inlineCss.trim().length > 0) {
    head.append(`<link rel="stylesheet" href="./styles/inline-extracted.css">`);
  }

  writeText(optimizedHtmlPath, $.html({ decodeEntities: false }));

  // 6) 構造化データ出力（JSON/YAML）
  const outline = buildStructuredOutline($);
  const structuredJsonPath = path.join(siteDir, "structured.json");
  const structuredYamlPath = path.join(siteDir, "structured.yml");
  writeText(structuredJsonPath, JSON.stringify(outline, null, 2));
  writeText(structuredYamlPath, toYaml(outline) + "\n");

  console.log("最適化出力: ");
  console.log(" HTML:", optimizedHtmlPath);
  if (manifest && Array.isArray(manifest.assets)) {
    const optimizedList = manifest.assets
      .map((a) => a && a.name && path.join(stylesDir, `optimized-${a.name}`))
      .filter((p) => p && fs.existsSync(p));
    if (optimizedList.length > 0) {
      console.log(" CSS (optimized per file):");
      optimizedList.forEach((p) => console.log("  -", p));
    }
  }
  if (shouldWriteInline) {
    console.log(" CSS (inline-extracted):", path.join(stylesDir, "inline-extracted.css"));
  }
  console.log(" JSON:", structuredJsonPath);
  console.log(" YAML:", structuredYamlPath);
}

main().catch((error) => {
  console.error("最適化中にエラーが発生しました:", error);
  process.exit(1);
});


