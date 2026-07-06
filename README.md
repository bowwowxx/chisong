# 持誦 · 金剛經與大悲咒背誦

> 這個工具最棒的地方是——它不逼你、不催促你，只是安靜地在那裡，每天等你來。就像經文本身一樣。

手機上協助記憶背頌經文的工具。直式排版，純 HTML / CSS / JavaScript，零依賴、零建置步驟，可直接部署到 GitHub Pages。

## 功能

- **誦讀**：直式（豎排）閱讀全文，可調字級，向左滑動翻閱，呼應傳統經本的閱讀方向。
- **提取**：給前段末句，心中默背整段後翻開對照，依「忘了／模糊／記得」評分。
- **接縫**：只考「上一句 → 下一句」的銜接處，專攻背誦最容易斷掉的段落交界。
- **辨異**（僅大悲咒）：選擇題形式分辨「呼嚧呼嚧摩囉／呼嚧呼嚧醯利」這類極相似句。
- **進度**：間隔重複（SRS）排程——記得的題目間隔拉長，忘掉的當場重排、隔日再考。進度存在瀏覽器 `localStorage`。

## 專案結構

```
.
├── index.html          頁面骨架
├── css/
│   └── style.css       紺紙金泥配色與直排版式
├── js/
│   └── app.js          練習邏輯、SRS 排程、資料載入
└── data/
    ├── vajra.json      金剛經（鳩摩羅什譯本，32 分段）
    └── dabei.json      大悲咒（84 句、四大段界、辨異題庫）
```

經文與程式碼分離：要校對或替換版本，只需編輯 `data/` 下的 JSON，不用碰程式。

### 資料格式

`vajra.json`

```json
{ "name": "金剛經", "segs": ["如是我聞。一時佛在舍衛國。…", "…共 32 段"] }
```

`dabei.json`

```json
{
  "name": "大悲咒",
  "lines": ["南無喝囉怛那哆囉夜耶", "…共 84 句"],
  "bounds": [17, 42, 68, 84],
  "drills": [{ "cue": [25], "ans": 26, "dis": [34, 29] }]
}
```

- `bounds`：四大段的結束位置（1-based、含尾）。
- `drills`：辨異題。`cue` 為提示句索引（0-based）、`ans` 為正解索引、`dis` 為誘答索引。

## 部署到 GitHub Pages

1. 建立 repo，把整個資料夾推上去。
2. repo 的 **Settings → Pages → Source** 選 `main` 分支（root）。
3. 稍等片刻，網址會是 `https://<帳號>.github.io/<repo 名>/`。

不需要任何 build 流程或 Actions。

## 全螢幕體驗

已加入跨平台 meta tags，在手機瀏覽器中「加到主畫面」後可全螢幕運行，像原生 App 一樣：

- `apple-mobile-web-app-capable` — iOS Safari 全螢幕
- `apple-mobile-web-app-status-bar-style` — iOS 狀態列樣式
- `mobile-web-app-capable` — Android Chrome 全螢幕

## 本機預覽

經文用 `fetch()` 載入，直接雙擊 `index.html`（`file://`）會被瀏覽器擋下。起個簡單的 http 伺服器即可：

```bash
python3 -m http.server 8000
# 或
npx serve
```

然後開 `http://localhost:8000`。

## 效能

- 無框架、無外部字型、無 CDN——首次載入只有一份 HTML、一份 CSS、一份 JS 與兩份 JSON（合計約 60 KB，gzip 後更小）。
- `index.html` 對兩份 JSON 加了 `<link rel="preload">`，與 JS 平行下載。
- 兩份經文平行抓取，金剛經到手立即渲染，不等待大悲咒。
- GitHub Pages 自帶 CDN 與快取，二次載入幾乎即時。

## iPhone 使用建議

部署到 Pages 後用 Safari 開啟網址，再「分享 → 加到主畫面」，即可像 App 一樣全螢幕使用，`localStorage` 進度也能長期保存（直接開本機 `file://` 檔案時 iOS 的儲存並不可靠，這正是改用網站部署的原因）。

## 經文版本

- 金剛經：鳩摩羅什譯《金剛般若波羅蜜經》通行本，依三十二分分段。
- 大悲咒：伽梵達摩譯八十四句通行本。

若與您持誦的版本有出入，請直接修改 `data/` 下的 JSON。

## License

經文為公有領域。程式碼 MIT。
