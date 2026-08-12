# 棋友・線上象棋

免登入的即時兩人中國象棋：建立房間、複製邀請連結、朋友加入後立即同步走棋。

## 本機啟動

安裝 Node.js 18 以上版本後，在這個資料夾執行：

```bash
npm install
npm start
```

然後開啟 `http://localhost:3000`。

## 上網（零月費起步）

這個版本需要一個能持續執行 Node.js 的免費服務，因為即時對戰需要 WebSocket。可使用 Render 或 Railway 的免費方案：

1. 把整個資料夾放進 GitHub 儲存庫。
2. 在 Render / Railway 建立新的 Web Service，連接該儲存庫。
3. 建置指令填 `npm install`，啟動指令填 `npm start`。
4. 平台提供的免費網址就是可分享給朋友的遊戲網址。

不要用 GitHub Pages 單獨部署這個版本；它只能放靜態網頁，不能提供即時房間伺服器。

### GitHub Pages 試玩版（只有電腦對戰）

本專案已經附上 GitHub Pages 自動部署設定。推送到 GitHub 後，到儲存庫的 **Settings → Pages → Build and deployment**，把來源選成 **GitHub Actions**。之後每次推送到 `main`，GitHub 會自動發布 `public` 資料夾。

Pages 網址通常是：`https://你的帳號.github.io/儲存庫名稱/`。這個網址可以試玩完整的電腦對戰，而且離線也可玩；好友即時對戰仍需要把整個專案部署到 Render 或 Railway。

## 已包含

- 紅黑兩人房間與邀請連結
- 🤖 離線電腦對戰：紅方玩家對黑方電腦，可選簡單、普通、困難
- 手機與電腦自動縮放
- 伺服器端合法走棋驗證（車、馬腳、象眼、炮、士／將宮、過河兵、飛將、將軍與將死）
- 重新開始與斷線後等待對手再次加入

電腦對戰不會傳送棋局資料；它在瀏覽器內以 Minimax 搭配 Alpha-Beta 剪枝搜尋走法。三個難度分別使用搜尋深度 1、2、3，並以子力、兵的推進與過河、中心活動、將帥安全、將軍狀態等評估局面。
