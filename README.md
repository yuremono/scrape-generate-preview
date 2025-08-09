# scrape-generate-preview

AIウェブサイトビルダーの実験プロジェクト。既存サイトをスクレイピングし、最小限の変換・最適化を施した上で、AIによる自然言語編集（テキスト/属性/スタイル）をデモできる環境を提供します。

## 機能概要

- スクレイピング: Puppeteer でHTML/CSSを取得（画像・動画はダミー）
- 最適化: 未使用CSSの削除（同一ホストのみ）、リンクのダミー化、構造出力
- セクションタグ付け: `data-section` と `data-targets` を自動付与
- AI編集デモ: iframeでプレビューを表示し、チャット指示から編集命令JSONを生成→DOMに即時適用

### 最近のアップデート
- URL入力だけで準備が完了する自動化
  - 新規API: `POST /api/prepare`（スクレイプ→最適化→タグ付けを自動実行）、`GET /api/status`
  - フロントの`loadHost`がURL/ホスト両対応に。未準備時は自動準備→プレビュー
- セレクタ解決と画像置換の堅牢化
  - `section+path`の補正と絶対セレクタへのフォールバック
  - 画像置換時は`<picture>`の`<source>`無効化、`srcset/sizes/data-*`除去、`https://picsum.photos/600/400?random=...`固定
- 曖昧指定の補正（クラス＋序数）
  - 例: 「card3の4つ目の画像」を`.card3`内のN番目画像として特定し絶対セレクタを生成（API側ヒューリスティック）


## スクリプト（npm scripts）

```
npm run scrape -- https://<URL>
npm run optimize -- <ホスト名>
npm run preview
npm run collect:features -- <ホスト名>
npm run ai:segment -- <ホスト名>
npm run tag -- <ホスト名>

# デモ（ローカル）
npm run demo:api   # /api/edit を起動（http://localhost:8787）
npm run demo       # /demo UI（http://localhost:3000/demo/）と output サーバ
```

## ディレクトリ構成（主要）

- `src/`
  - `scrape.js` / `optimize.js` / `collectFeatures.js` / `aiSegment.js` / `TagElements.js`
- `output/<host>/`
  - `index.html`（タグ付け済み）/ `index.optimized.html` / `styles/` / `structured.json|yml` 等
- `demo/`
  - `index.html`（iframe＋チャットUI）/ `app.js`
- `api/`
  - `edit.js`（OpenAIを呼び出して命令JSONを生成／`/api/prepare`・`/api/status` 含む）

## 現状の開発環境と Next.js との違い

- 現状: Node.jsベースの「ユーティリティ実行環境」＋静的HTML（ビルドは不要）
  - 長所: 依存が軽い／スクレイプ対象の素のHTMLをそのまま扱える／起動が速い
  - 短所: ルーティング/SSR/CSR/アセット最適化/HMRなどのWebアプリ機能は自前実装
- Next.js 等（React環境）
  - 長所: ルーティング/SSR/SSG/Edge/画像最適化/バンドル最適化/開発DXが充実
  - 短所: フレームワークの前提にHTMLを合わせる必要がある（生HTMLへの介入が増える）

結論: 現段階は「スクレイプ→変換→編集」を素早く検証する段階のため、フレームワークを被せずにNodeスクリプトで完結させています。将来的に恒常的なUIを提供する段になったら、Next.jsなどへ移行して操作UI・API・認証・デプロイを一体化するのが自然です。

## デモのAPI分離の意味

- OpenAIキー等の秘匿・アクセス制御のため、クライアント直呼びではなく `/api/edit` 経由にしています
- フロント（/demo）とAPI（/api）を同一リポジトリ内で分離することで、
  - 契約（入力:自然言語、出力:命令JSON）が安定
  - 将来のデプロイ先（Vercel Functions等）に移し替えやすい
  - ローカルでもCORS想定の開発が可能

## 既知の制約（テキスト編集）

- 「h1の英語部分だけ」などの曖昧指示は、構造・混在言語・装飾（span等）により誤置換のリスクあり
- MVP方針: 置換対象の旧/新テキストを指示で明示（例: `[[[旧]]] -> {{{新}}}`）し、文字列置換に限定する
- 将来方針: 部分置換オペ（replaceTextDeep/shallow）、選択範囲ベース編集、ユーザ確認ダイアログ

## 製品化に向けた課題（最終形の方向性）

- 直接編集UI（ダブルクリック/選択で編集）
  - 要素の selection → contenteditable → 確定時に正規化・差分反映
  - CMSでも採用例があり、AI補助（文体変換/要約/翻訳）と相性が良い

### ダイレクト選択（実装計画）
1. セレクション層の埋め込み
   - iframe内に選択オーバーレイ（枠・ハンドル・ツールバー）を注入
   - hoverで最近傍要素をハイライト、クリックで固定選択
2. 選択→編集コマンド化
   - 選択要素の絶対CSSパス（id優先）と`data-section`を取得
   - 操作は`setText`/`setHTML`/`setAttr`/`setStyle`に正規化
3. 編集UI
   - テキストは contenteditable（確定で命令JSONに変換）
   - 画像はドロップ/URL入力で`src`を更新（picsum等のプリセット）
   - スタイルは許可プロパティの簡易フォーム（角丸/背景色/余白など）
4. 反映と履歴
   - 命令JSONを`applyEditsToIframe`へ適用（既存ロジックを再利用）
   - 操作履歴（undo/redo）はJSON蓄積で実装
5. AIとの連携
   - 選択要素をコンテキストに提示し、「この要素の…を変更」といった指示へ誘導

最小MVP: ハイライト＋クリック選択→テキスト編集/画像差替/背景色変更を実装。

### 例外対応（`js-`クラスの一括削除）
- 目的: スクレイプ後にJSフック用クラスを除去して、不要なスタイル・誤マッチを回避
- 実装箇所: `src/optimize.js`
  - フラグ: ファイル先頭の `REMOVE_JS_CLASSES`（デフォルト: true）
  - 切替方法: 該当定数を `false` に変更、またはコメントアウト
  - 作用点: 最適化処理の冒頭で HTML から `js-` で始まるクラス名を除去
- 安全なスタイル編集
  - 許可プロパティのホワイトリスト化、スコープ化されたスタイル注入
- セクションの粒度最適化
  - `data-section` の安定IDと`data-targets`の充実化（見出し/本文/画像/CTA 等）
- 永続化と履歴
  - HTML/CSSの保存、差分プレビュー、ロールバック
- デプロイ
  - Vercel等への自動デプロイ、鍵管理（環境変数）、プレビューURLの共有

## ライセンス

MIT（予定）

