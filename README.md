# 太虚问道

一个纯前端修仙动作 RPG 竖切片，打开网页即可游玩。

## 在线部署

本项目是静态站点，适合直接部署到 GitHub Pages、Netlify、Vercel 或任意静态文件服务器。

GitHub Pages 推荐设置：

- Branch: `main`
- Folder: `/ (root)`

部署后入口文件是仓库根目录的 `index.html`。

## 本地运行

```powershell
python -m http.server 8787 --bind 127.0.0.1
```

然后打开：

```text
http://127.0.0.1:8787/
```

## 操作

- WASD：移动
- 鼠标：瞄准
- 鼠标左键 / 空格：归元剑
- Shift：踏风位移
- Q：雷火印
- E：服丹
- R：尝试突破

## 文件

- `index.html`：页面结构
- `styles.css`：全屏 HUD 与视觉样式
- `game.js`：实时战斗、地图、怪物、任务、境界与掉落逻辑
