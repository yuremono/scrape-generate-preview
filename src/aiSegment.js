#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { getConfig } = require("./config");

function readText(p) { return fs.readFileSync(p, "utf8"); }
function writeText(p, c) { fs.writeFileSync(p, c, "utf8"); }

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
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`OpenAI API error: ${resp.status} ${t}`);
  }
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "";
  return content;
}

async function aiSegment({ host }) {
  const { openaiApiKey } = getConfig();
  if (!openaiApiKey || openaiApiKey === "OPENAI_API_KEY") {
    throw new Error("OPENAI_API_KEY が設定されていません。ENV_EXAMPLE を参考に環境変数を設定してください。");
  }

  const outDir = path.join(process.cwd(), "output", host);
  const featuresPath = path.join(outDir, "features.json");
  if (!fs.existsSync(featuresPath)) {
    throw new Error("features.json が見つかりません。先に npm run collect:features を実行してください。");
  }
  const features = JSON.parse(readText(featuresPath));

  const system = "あなたはウェブのレイアウト構造を理解し、視覚的なセクションを人間が納得する単位で分割できるアシスタントです。セマンティックタグに依存せず、視覚的まとまりを優先してセクション化します。出力はJSONで返却してください。";
  const user = `以下はページから収集した視覚的特徴リストです。見出しの有無、矩形サイズ、位置関係、背景色の変化なども参考に、目で見て明確に分かるセクション単位に分割してください。各セクションにはid(例: s-001)と、根拠(どの特徴が効いたか)の短いメモを含めてください。\n\n${JSON.stringify(features, null, 2)}`;

  const content = await callOpenAI({ apiKey: openaiApiKey, system, user });
  // JSON想定だが、保険としてパース失敗時はそのままテキスト保存
  let json;
  try { json = JSON.parse(content); } catch { json = { raw: content }; }

  const resultJson = path.join(outDir, "segments.json");
  const resultYml = path.join(outDir, "segments.yml");
  writeText(resultJson, JSON.stringify(json, null, 2));
  writeText(resultYml, toYaml(json) + "\n");
  console.log("分割結果:", resultJson);
  console.log("分割結果:", resultYml);
}

async function main() {
  const host = process.argv[2];
  if (!host) {
    console.error("使い方: npm run ai:segment -- <ホスト名>");
    process.exit(1);
  }
  await aiSegment({ host });
}

main().catch((err) => {
  console.error("AI分割中にエラー:", err);
  process.exit(1);
});


