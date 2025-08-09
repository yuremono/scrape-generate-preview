const hostInput = document.getElementById("host");
const loadBtn = document.getElementById("load");
const resetBtn = document.getElementById("reset");
const iframe = document.getElementById("preview");
const chatForm = document.getElementById("chat");
const msgInput = document.getElementById("msg");
const logEl = document.getElementById("log");
const divider = document.getElementById("divider");
const rightPane = document.querySelector(".right");
const forceCkb = document.getElementById("force");

function normalizeCssPropName(name) {
  if (!name || typeof name !== "string") return name;
  if (name.startsWith("--")) return name; // CSS変数はそのまま
  if (name.includes("-")) return name.toLowerCase();
  // camelCase → kebab-case
  return name.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
}

function log(line) {
  // message と edits を分けて表示
  if (line && typeof line === "object" && line.role === "assistant" && line.payload) {
    const { message, edits } = line.payload;
    const msgDiv = document.createElement("div");
    if (message) {
      const p = document.createElement("p");
      p.textContent = message;
      msgDiv.appendChild(p);
    }
    if (Array.isArray(edits)) {
      const det = document.createElement("details");
      const sum = document.createElement("summary");
      sum.textContent = `編集詳細 (${edits.length})`;
      det.appendChild(sum);
      const pre = document.createElement("pre");
      pre.textContent = JSON.stringify(edits, null, 2);
      det.appendChild(pre);
      msgDiv.appendChild(det);
    }
    logEl.appendChild(msgDiv);
  } else {
    // デバッグ系は非表示
    if (line && typeof line === "object" && (line.debug || line.role === "user")) {
      return;
    }
    const pre = document.createElement("pre");
    pre.textContent = typeof line === "string" ? line : JSON.stringify(line, null, 2);
    logEl.appendChild(pre);
  }
  logEl.scrollTop = logEl.scrollHeight;
}

async function loadHost(hostOrUrl, { force = false } = {}) {
  const isUrl = /^(https?:)?\/\//i.test(hostOrUrl);
  const apiBase = location.port === "3000" ? "http://localhost:8787" : "";
  if (isUrl) {
    // 準備APIを叩いてから読み込む
    log("サイトを準備中…");
    const res = await fetch(`${apiBase}/api/prepare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: hostOrUrl, force })
    });
    if (!res.ok) {
      const t = await res.text();
      log(`準備に失敗しました: ${t}`);
      return;
    }
    const json = await res.json();
    const host = json.host || new URL(hostOrUrl).hostname;
    log(`準備完了: ${host}`);
    iframe.src = `../output/${encodeURIComponent(host)}/index.html`;
    hostInput.value = host;
    return;
  }
  // 既存ホスト: 存在しなければ自動準備を試みる
  const res = await fetch(`${apiBase}/api/status?host=${encodeURIComponent(hostOrUrl)}`).catch(() => null);
  const ok = !!res && res.ok && (await res.json()).prepared;
  if (!ok) {
    return loadHost(`https://${hostOrUrl}`, { force });
  }
  iframe.src = `../output/${encodeURIComponent(hostOrUrl)}/index.html`;
}

loadBtn.addEventListener("click", () => loadHost(hostInput.value.trim(), { force: !!forceCkb?.checked }));
resetBtn.addEventListener("click", () => {
  // 再読み込み（iframeのキャッシュ回避にクエリ文字列）
  const src = iframe.src;
  iframe.src = "about:blank";
  setTimeout(() => { iframe.src = src.replace(/[?&]t=\d+$/, "") + (src.includes("?") ? "&" : "?") + "t=" + Date.now(); }, 50);
});

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = msgInput.value.trim();
  if (!text) return;
  log({ role: "user", text });
  try {
    const apiBase = location.port === "3000" ? "http://localhost:8787" : "";
    const res = await fetch(`${apiBase}/api/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host: hostInput.value.trim(), text }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`API ${res.status}: ${t}`);
    }
    const payload = await res.json();
    log({ role: "assistant", payload });
    applyEditsToIframe(payload);
  } catch (err) {
    log(String(err));
  }
});

function queryIframe(selector) {
  const doc = iframe.contentDocument;
  if (!doc) return null;
  try { return doc.querySelector(selector); } catch { return null; }
}

function buildPicsumUrlForImage(_imgEl) {
  // 要望により、幅・高さの自動取得は行わず固定サイズで返す
  // Picsumの仕様上サイズ指定は必須のため 600x400 に固定
  const rand = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return `https://picsum.photos/600/400?random=${rand}`;
}

function applyEditsToIframe(result) {
  // 期待ペイロード: { message, edits: [ { section, path, op, ... } ] }
  if (!result || !Array.isArray(result.edits)) return;
  for (const edit of result.edits) {
    const { section, path } = edit;
    const op = edit.op || edit.operation; // 後方互換
    // sectionがある場合は data-section を起点に相対セレクタ
    let selector = path && path.trim().length > 0 ? path.trim() : null;
    // セクションが指定される場合の解決規則
    if (section) {
      if (selector) {
        // path が #<section> で始まる場合は、そのID部分を取り除き、セクション起点の相対に変換
        const idPrefix = `#${section}`;
        if (selector.startsWith(idPrefix)) {
          let rest = selector.slice(idPrefix.length).trim();
          if (rest.startsWith(">")) rest = rest.slice(1).trim();
          selector = rest ? `[data-section="${CSS.escape(section)}"] ${rest}` : `[data-section="${CSS.escape(section)}"]`;
        } else if (!/^\[data-section=/.test(selector)) {
          // すでに data-section を含まないなら前置
          selector = `[data-section="${CSS.escape(section)}"] ${selector}`;
        }
      } else {
        selector = `[data-section="${CSS.escape(section)}"]`;
      }
    }
    let el = selector ? queryIframe(selector) : null;
    // フォールバック: 相対で見つからなければ絶対pathで再試行
    if (!el && path) {
      el = queryIframe(path);
    }
    // H1配下のテキストが <span> で分割されているケースは子要素を除去してから置換する
    if (!el) { continue; }
    switch (op) {
      case "setText":
        // テキスト全置換（子要素は保持したい場合は setHTML を使う）
        el.textContent = edit.value ?? "";
        break;
      case "setHTML":
        el.innerHTML = edit.value ?? "";
        break;
      case "setAttr":
        if (edit.attr) {
          if (edit.attr.toLowerCase() === "src" && el.tagName === "IMG") {
            // 画像置換は picsum.photos を優先
            const picUrl = buildPicsumUrlForImage(el);
            // lazy-load 系属性や srcset を無効化して確実に反映
            el.removeAttribute("srcset");
            el.removeAttribute("sizes");
            el.removeAttribute("data-src");
            el.removeAttribute("data-srcset");
            // <picture> 対応: 既存の <source> を無効化
            const picture = el.closest && el.closest('picture');
            if (picture) {
              picture.querySelectorAll('source').forEach(s => s.remove());
            }
            el.setAttribute("src", picUrl);
          } else if (edit.attr.toLowerCase() === "srcset" && el.tagName === "IMG") {
            // srcset 指定時も picsum に揃える
            const picUrl = buildPicsumUrlForImage(el);
            el.setAttribute("src", picUrl);
            el.removeAttribute("srcset");
            el.removeAttribute("sizes");
          } else {
            el.setAttribute(edit.attr, edit.value ?? "");
          }
        }
        break;
      case "setStyle":
        if (edit.prop) {
          const propName = normalizeCssPropName(edit.prop);
          el.style.setProperty(propName, edit.value ?? "");
        } else if (edit.value && typeof edit.value === "object") {
          for (const [k, v] of Object.entries(edit.value)) {
            const propName = normalizeCssPropName(k);
            el.style.setProperty(propName, v);
          }
        } else if (typeof edit.value === "string") {
          // CSS宣言文字列をパース（例: "background-color: #d0f0c0; color: #333;")
          edit.value.split(";").map(s => s.trim()).filter(Boolean).forEach(decl => {
            const i = decl.indexOf(":");
            if (i > 0) {
              const prop = normalizeCssPropName(decl.slice(0, i).trim());
              const val = decl.slice(i + 1).trim();
              if (prop && val) el.style.setProperty(prop, val);
            }
          });
        }
        // デバッグ出力は抑制（必要なら開発時のみ有効化）
        break;
      default:
        log({ warn: "unknown op", edit });
    }
  }
}

// リサイズ（ドラッグで左右パネル幅を調整）
(() => {
  let dragging = false;
  let startX = 0;
  let startPct = 25; // %
  let raf = 0;

  divider.addEventListener("mousedown", (e) => {
    dragging = true;
    startX = e.clientX;
    // 現在の%幅を計算
    const rect = rightPane.getBoundingClientRect();
    const parentRect = rightPane.parentElement.getBoundingClientRect();
    startPct = Math.max(10, Math.min(80, (rect.width / parentRect.width) * 100));
    // ドラッグ中は不要な相互作用を停止
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    iframe.style.pointerEvents = "none";
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const parentRect = rightPane.parentElement.getBoundingClientRect();
    const dx = e.clientX - startX; // 右に動かすと右ペインは狭まる
    const deltaPct = (dx / parentRect.width) * 100;
    let nextPct = startPct - deltaPct;
    nextPct = Math.max(15, Math.min(80, nextPct));
    // rAFでまとめて適用
    if (!raf) {
      raf = requestAnimationFrame(() => {
        rightPane.style.setProperty("--rightPct", `${nextPct}%`);
        raf = 0;
      });
    }
  });
  window.addEventListener("mouseup", () => { 
    dragging = false; 
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    iframe.style.pointerEvents = "";
  });
})();

// 初期ロード
loadHost(hostInput.value.trim());


