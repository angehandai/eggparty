# Party Rush · Floating Candy Factory

一个无需安装游戏引擎的原创派对闯关 Demo。项目使用原生 HTML5 Canvas + JavaScript 绘制，所有角色、地图、UI 和视觉元素均为程序生成。

## 运行

直接双击 `index.html`，或在项目目录启动任意静态文件服务器后访问该文件：

```powershell
python -m http.server 8000
```

然后打开 `http://localhost:8000/`。

## 已实现

- PARTY RUSH 主菜单、设置弹窗、PLAY / PLAY AGAIN / MAIN MENU
- 第三人称视角风格的彩色 3D 透视赛道（Floating Candy Factory）
- WASD 移动、Space 跳跃、Shift 冲刺输入
- 12 名参赛者（1 名玩家 + 11 名能力不同的 AI）
- 旋转棒、移动平台、摆锤、弹跳平台、旋转风车、消失平台
- 检查点 1–4、掉落复活、连续掉落三次淘汰
- 玩家与 AI 的碰撞/击退、随机失误、到达终点和排名
- HUD：Players Left、Checkpoint、进度条和控制提示
- 结果界面、名次、用时和重新开始
- 纯 CSS / Canvas 的粒子、彩色材质、云层、终点标志和反馈动画

## 文件

- `index.html`：页面结构、菜单、HUD 和结果界面
- `styles.css`：卡通 UI 样式与布局
- `game.js`：渲染、输入、玩家、AI、障碍、检查点、竞赛和粒子逻辑

这是一个可直接运行的 playable-first 原型；音频、真正网络联机、骨骼动画和 Unity/URP 资产属于后续生产阶段。
