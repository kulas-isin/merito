# Merito — 客戶評估與管理系統

> Know their merit before you commit — 值不值得接，先看 Merito。

給接案團隊用的客戶管理系統。純前端，沒有後端、沒有 build step，開 `index.html` 就能用；
設定 GitHub 同步後，團隊共用同一份資料。

---

## 六個分頁

| 分頁 | 做什麼 |
|---|---|
| **儀表板** | 全公司體檢：哪些案子在燒錢、哪些錢沒收到、哪些客戶該提防 |
| **客戶** | 每個客戶一份檔案：聯絡人與決策鏈、評估歷史、專案、收款、經驗、動態記錄 |
| **接案評估** | 接案前 7 項評分（滿分 35），即時給 Go / Caution / Avoid 判定與紅旗警訊 |
| **專案追蹤** | 合約 vs 投入成本的損益表，含快速記工時 |
| **需求異動** | 記錄客戶追加的需求、產生確認訊息、追處理狀態、匯出 Excel |
| **報價收款** | 報價單狀態與成交率、收款里程碑與逾期提醒 |
| **經驗記錄** | 踩過的雷與換來的教訓，可搜尋、可標籤 |
| **設定** | 同步設定、團隊成員、匯出匯入 |

### 評估的七道題

1. 預算 vs 工作量是否成比例
2. 需求清晰度
3. 是否為第一次外包（沒換過團隊）
4. 決策鏈是否穩定
5. 新需求的付費意願
6. 溝通態度是否互惠
7. 合作安全度（客戶自行接手的風險）

每題 1–5 分。**打 1 或 2 分會觸發紅旗**，直接列在判定區。

| 總分 | 判定 |
|---|---|
| 27–35 | **Go** — 值得接 |
| 18–26 | **Caution** — 可接，但要設好界線 |
| 0–17 | **Avoid** — 伸手牌警報 |

---

## 團隊共用：設定 GitHub 同步

資料存成一個 repo 裡的 `data.json`。團隊每個人填自己的 token，共用同一個 repo。

> **資料 repo 一定要用 private。**
> 客戶名稱、合約金額、你對客戶的評語，放進 public repo 等於公開。
> App 本身放 public repo 沒問題，但資料要分開。設定頁會自動偵測並警告。

### 步驟

1. 開一個 **private** repo，例如 `你的帳號/merito-data`（空的就好，不用先建檔案）
2. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens**
   - Repository access：只勾那個資料 repo
   - Permissions → **Contents: Read and write**
3. 打開 Merito → 設定分頁，填 owner / repo / 分支 / 路徑 / token，按「儲存並測試連線」
4. 團隊其他人重複 2–3 步（各自的 token，同一個 repo）

### 同步怎麼運作

- 改動後 **4 秒**沒有新動作就自動推送；也可以按右上角同步狀態手動推
- 推送前一定先抓遠端最新版**逐筆合併**才寫回，所以兩個人同時改不同客戶不會互相蓋掉
- 同一筆記錄被兩邊都改到時，以 `updatedAt` 較新的為準
- 刪除是寫墓碑（`deleted:true`）而不是直接移除，刪除才會同步給隊友；180 天後自動清理
- 每次同步都是一個 commit，所以 GitHub 上有完整版本歷史，改壞了可以翻回去

### 沒設定同步也能用

資料存在瀏覽器 localStorage，功能完全一樣，只是不跟別人同步、換裝置不會跟著走。
可以到「設定 → 備份與轉移」匯出 JSON。

---

## 需求異動：從「順便改一下」到白紙黑字

接案最會失血的地方，是客戶一句「順便改一下」，做完了沒人記得要收錢。
這個模組把流程固定成四步：

1. **當下記一筆** —— 誰講的、在哪講的（LINE／會議／Email）、要改什麼。專案列表和客戶檔案都有「＋異動」快捷
2. **報價** —— 填預估工時與金額；不打算收錢就留空，會標成「免費吸收」並累計時數，讓你看見自己送了多少
3. **發確認訊息** —— 一鍵產生可直接貼給客戶的文字（內容、工時、金額、對時程的影響、請對方回覆「確認」）。
   按下去的同時狀態自動推進到「已報價待確認」，超過一週沒回會標紅字
4. **標記已確認** —— 記下誰、哪天、在哪確認的。**確認後金額自動併入該專案的損益，不用再去改合約金額**

> 專案的「合約金額」永遠是原始合約。已確認的異動是另外加上去的，
> 表格會顯示「原 120,000 ＋異動 8,000」。不要為了記異動去改合約金額，會重複計算。

隨時可以產出**處理狀態回報**（依狀態分組、結算已確認與待確認金額、免費吸收時數），
貼進 LINE、Email 或週報都行；也可以**匯出 Excel**（CSV 帶 BOM，Excel 開不會亂碼）。

---

## 用 AI 把對話紀錄轉成資料

LINE／Slack／Email 的對話紀錄可以丟給 AI，請它輸出 Merito 格式的 JSON，
到「設定 → **貼上 JSON 匯入**」整段貼進去就好 —— 不用存檔、不用一筆一筆手打。
按下匯入前會先跑一次體檢，列出哪些是新增、哪些會更新既有，並標出缺 `id`、
缺 `updatedAt`、`clientId` 找不到客戶這幾種**匯入後不會報錯只會默默失敗**的問題。

完整的欄位規格與可直接複製的提示詞在 **[docs/ai-import.md](docs/ai-import.md)**。

---

## 部署

### GitHub Pages

repo → Settings → Pages → Source 選 `main` 分支的根目錄，網址就會是
`https://<帳號>.github.io/merito/`。

### 本機

直接用瀏覽器開 `index.html` 就行（GitHub API 支援跨來源請求，`file://` 也能同步）。
或起個靜態伺服器：

```bash
npx serve .
```

---

## 專案結構

```
index.html            畫面骨架與分頁
css/app.css           全站樣式
js/util.js            共用工具（跳脫、金額、日期、base64、CSV）
js/store.js           資料層：本機快取 + GitHub 同步 + 逐筆合併
js/ui.js              Modal／Toast／表單產生器／領域常數（評估題庫、狀態）
js/views/*.js         七個分頁各一支
js/main.js            路由與啟動
```

資料模型（`data.json`）：`clients` `contacts` `assessments` `projects` `quotes`
`payments` `lessons` `activities` `members`，每筆都有 `id` / `createdAt` /
`updatedAt` / `updatedBy`。

---

## 注意事項

- **Token 存在瀏覽器的 localStorage**，不會傳去 GitHub 以外的地方。共用電腦用完請按「清除 Token」。
- Token 權限只給那一個資料 repo 的 Contents 讀寫，不要用 classic token 開全帳號權限。
- 舊版單檔 Merito 的 localStorage 資料（`merito_track_v1` / `merito_lesson_v1`）會在第一次開啟時自動搬進新結構。
