# 太虚问道

[在线试玩：https://lenhaonan.github.io/taixu/](https://lenhaonan.github.io/taixu/)

一个纯前端修仙动作 RPG 竖切片，打开网页即可游玩。

## 在线游玩

直接打开：

```text
https://lenhaonan.github.io/taixu/
```

当前项目通过 GitHub Pages 的 `gh-pages` 分支发布。别人不需要安装任何东西，浏览器打开链接即可游玩。

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
