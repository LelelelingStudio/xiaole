# Leleleling Studio 产品知识库

> 用途：作为工作室 AI 助手的长期上下文，供其介绍产品、回答功能问题、协助开发与维护。
> 数据来源：各仓库 README、实际代码与已有项目进展，**不是对每个站点线上状态的全量测试报告**。
> 重要约定：文中所有数字（次数、上限、条数、字数）均为**当前实现值**，不是永久承诺；改动时以仓库代码为准。
> 整理日期：2026-11-27 ｜ 产品数：**12 个在营产品 + 1 个历史入口**

---

## 一、工作室总览

### 1.1 定位

Leleleling Studio（了了了岭工作室）是一个独立数字产品工作室，方向覆盖 AI 应用、HTML5 游戏与游戏平台、电子书阅读、图像格式与处理、搜索聚合、任务管理、点对点传输、知识可视化。

既有面向普通用户的应用，也有面向开发者的 SDK、API、图片格式与语言库。

官方网站：https://leleleling.site
品牌语：Explore the undiscovered.（探索未至之境）

### 1.2 风格与原则

- 产品有明确实际用途，不为炫技而做。
- 界面直观、学习成本低；技术条件允许时优先轻量与低依赖。
- 多产品支持中英文；部分支持 PWA 安装。
- 产品间可共享技术与基础设施，但定位必须各自清晰。
- **对外介绍只能以已实现功能为依据，路线图不能写成已上线。**

### 1.3 在营产品（12）

| 产品 | 类别 | 一句话 |
| --- | --- | --- |
| 了了了游 Lelele Game | 游戏平台 | HTML5 小游戏平台，玩家玩、开发者投稿 |
| 了了了读 Lelele Read | 阅读 | 在线书库 + 统一阅读器，EPUB 导入导出 |
| Happy Farmer | 游戏 | 慢节奏农场经营 |
| TimePin 时光扣 | 效率工具 | 按重要性与紧急度排优先级的任务管理 |
| LSFP | 图像技术 | 自研图片格式 + 转换工具 + JS/Python 库 |
| 了了了搜 Lelele Search | 搜索 | 多来源聚合搜索 + AI 摘要 + 词条库 |
| 小了 SDK Xiaole SDK | AI 组件 | 一行 script 嵌入网站的 AI 助手「小了」 |
| Lelele Chess | 游戏 | 国际象棋，本地/人机/WebRTC 在线 |
| 了了了传输助手 | 工具 | 免账号 P2P 文件传输与聊天 |
| BibleTree | 知识工具 | 圣经人物关系图谱与时间线 |
| Photoedits | 开发者工具 | 浏览器端图像处理 JS API |
| 了了了数独 Lelele Sudoku | 游戏 | 经典 + 多种变体数独 |

### 1.4 历史入口

| 入口 | 状态 |
| --- | --- |
| 了了了AI（al.leleleling.site） | **已停止独立投入**。待小了完成后，`al.leleleling.site` 将重定向到 `xiaole.leleleling.site`。旧前端代码不再维护；对话与生图能力由小了承接。 |

AI 注意：不要再把了了了AI 当成需要维护的独立产品，也不要建议改 `al` 的前端。

### 1.5 生态关系

- **AI**：小了 SDK 是嵌入组件，负责把 AI 助手放进各产品页面；了了了AI 入口已归并到小了。
- **游戏**：了了了游是平台；Happy Farmer / Lelele Chess / Lelele Sudoku 是具体游戏，可通过游戏平台 SDK 上报成绩、读排行榜。
- **阅读与知识**：了了了读管阅读体验；BibleTree 管人物关系与经文探索。
- **图像技术**：LSFP 管自研格式与压缩；Photoedits 管多引擎统一 API，二者互补。
- **效率与协作**：TimePin 管任务与优先级；传输助手管设备间文件与消息。

---

## 二、产品档案

> 每个产品按四层写：**定位 / 用户场景 / 功能 / 技术与限制**。
> 面向普通用户的介绍只需前两层；协助开发时看后两层。

### 01. 了了了游（Lelele Game）

- 网址：https://game.leleleling.site ｜ 仓库：`LelelelingStudio/lelele-game`
- **定位**：HTML5 小游戏平台与分发入口，不是某一款游戏。
- **场景**：打开网页即玩；开发者投稿作品、看数据。
- **功能**：分类/标签筛选、搜索（支持拼音容错）、加权随机与 For You 推荐、继续游玩、收藏关注、排行榜（人工维护）、游戏详情（中英文介绍、截图、视频、作者、年龄评级、更新日志）、模拟浏览器播放器（开始/重载/全屏/关闭）、成绩分享链接（含昵称与分数）、PWA。
- **开发者**：登录开发者后台、管理作品与统计、提交游戏、接收审核与通知、Lv.1–6 认证与 Official/Studio Special 标识；提供游戏 SDK（排行榜、成绩、评分、昵称、分享、相似游戏、详情跳转）。
- **技术**：纯静态 HTML/CSS/JS，无构建、无平台后端，GitHub Pages 发布 + Cloudflare；设计变量统一主题；用户动态内容需转义。
- **限制**：投稿需人工审核；不支持嵌入的外部游戏以新标签页打开。

### 02. 了了了读（Lelele Read）

- 网址：https://read.leleleling.site ｜ 仓库：`LelelelingStudio/lelele-read`
- **定位**：纯净、轻量、可自定义的在线阅读平台。
- **场景**：读站内书籍；导入自己的 EPUB；做笔记、书签、批注。
- **功能**：书库按章节 JSON 存储按需加载；统一阅读器 `reader.html`（目录、章节切换、搜索、进度、断点续读、收藏、书签、高亮、批注、字号、字体、多主题、自定义背景、悬浮工具箱）；EPUB 2/3 导入（单文件约 20MB 上限，浏览器本地解析，不上传）；导出 EPUB / TXT / HTML / JSON。
- **技术**：原生 HTML/CSS/JS + JSON 数据 + JSZip + EPUB 双向转换 + PWA，无框架无构建。
- **限制**：阅读记录（进度/书签/高亮/批注/偏好）主要存本地，不做跨设备自动同步；不是文档编辑器，也不是网盘。

### 03. Happy Farmer（爱种地的农民）

- 网址：https://happyfarmer.game.leleleling.site ｜ 仓库：`LelelelingStudio/happyfarmer` ｜ 版本 1.1.0 ｜ 年龄 6+
- **定位**：慢节奏农场经营游戏，无强制签到、无体力、无内购。
- **场景**：碎片时间经营农场，逐步扩大生产链。
- **功能**：开垦（含小游戏）→ 种植 → 浇水 → 收获 → 加工 → 销售；约 1000 种作物、10 个作物家族；四季与天气影响生长；随机事件（宝藏/小偷/疾病/旅行商人）；9 级工坊、1893 种配方；5 位商人 + 寄售市场 + 拍卖；100 种分批解锁商店物品、50 款皮肤、150 项成就。
- **技术**：原生 HTML/CSS/JS，按 core/systems/ui/langdata/assets/tools 分层；无需构建、无需后端。
- **限制**：核心游戏离线可玩，本地存档支持导出导入；排行榜可选、需联网且有等级门槛。**它是具体游戏，不是游戏平台。**

### 04. TimePin（时光扣）

- 网址：https://timepin-tools.leleleling.site ｜ 仓库：`Leleleling/timepin`
- **定位**：本地优先的任务与时间管理工具，核心是"判断该先做什么"而非只记待办。
- **场景**：任务堆积时决定优先级；按四象限组织项目；按日历安排时间。
- **功能**：今日页（增删改、完成、延后、置顶、批量、子任务、标签/重要度/截止筛选、搜索、排序、已完成折叠）；四象限看板（可拖拽、触屏长按）；日历；标签；任务详情；周期任务（日/周/月，完成后生成下一次）；设置（主题、强调色、密度、字号、优先级颜色、通知、PWA）。
- **紧急度算法**：重要度低/中/高；紧急度分 1.0–5.0，由截止时间与用户"时间感知问卷"（逾期/3 小时/今天/1 天/3 天/1 周/2 周/1 月/3 月/无截止）推算；可调重要性权重、紧急度权重与阈值。
- **技术**：React + TypeScript + Vite + Zustand + date-fns + Recharts + Dexie(IndexedDB) + vite-plugin-pwa；`/new` 等快捷路由可预填标题与截止时间。
- **限制**：本地优先，**不默认具备云端账号与跨设备自动同步**。仓库在 `Leleleling` 组织、域名是 `timepin-tools.leleleling.site`，属同一产品。

### 05. LSFP 图片格式与转换工具

- 网址：https://lsfp.leleleling.site ｜ 仓库：`LelelelingStudio/lsfp` ｜ Apache-2.0
- **定位**：自研图片格式（LelelelingStudio's Format Picture），针对纯色面积大、UI 截图、图标、颜色有限的图像。
- **场景**：把截图/图标压得更小；开发者嵌入解码库。
- **格式**：颜色量化（调色板最多 256 色）+ RLE + Gzip；文件含魔数、版本、标志位、宽高、调色板、数据块。
- **工具**：纯前端 PWA 转换器，与 PNG/JPG/WebP/BMP/GIF/SVG/ICO/AVIF/TIFF 互转，支持多文件拖放、批量、后台队列、离线、中英文。
- **库**：`lsfp.js`（浏览器解码，可喂给 Canvas）；`pip install lsfp`（Python 编解码）。
- **限制**：README 提到极限场景可缩到约 90%，**不是所有图片的保证**；Web Workers / NPM / CLI / 原生查看器仍在路线图。

### 06. 了了了搜（Lelele Search）

- 网址：https://search.leleleling.site ｜ 仓库：`LelelelingStudio/lelele-search`
- **定位**：一次查询聚合多个搜索来源，并用 AI 摘要与本地词条提速。
- **场景**：不想开多个搜索引擎标签页；想快速拿到关键结论再回原文核对。
- **功能**：聚合搜索（Cloudflare Worker 抓取，去重 + 相关度排序）、结果页 AI 摘要、内置 38+ 精选词条（精确/包含/模糊匹配、独立详情页）、约 983 条每日语录、浅/深色主题记忆、响应式。
- **技术**：原生 HTML/CSS/ES6+，静态 JSON 数据，Worker 做聚合，GitHub Pages + Cloudflare；页面 `index.html` / `search.html` / `leleart.html`。
- **限制**：不固定承诺具体搜索引擎名单；AI 摘要是对结果的整理，需回原文核实；前端出现的 Key 不算秘密，防护要做在 Worker（Origin 白名单、Referer、限流、轮换）。

### 07. 小了 SDK（Xiaole SDK）★ 重点产品

- 网址：https://xiaole.leleleling.site ｜ 仓库：`LelelelingStudio/xiaole` ｜ 后端：`https://back-xiaole.leleleling.site`
- **定位**：可嵌入的 AI 助手组件。宿主只需一行 script，就能在页面右下/左下得到 AI 角色「小了」，带流式对话、生图、角色动画、页面指引。
- **场景**：给工作室各产品加"会聊、会看页面、会指位置"的助手；对外统一形象与提示词体系。

#### 7.1 接入方式

```html
<script src="https://xiaole.leleleling.site/sdk/xiaole.js" data-preset="read"></script>
```

宿主属性：`data-preset`（default/read/game/studio）、`data-zindex`、`data-size`、`data-anchor="left|right"`、`data-char`（frames/rig/layers）、`data-xiaole-perceive="summary|text|off"`、`data-allow-all="true"`（仅本地调试，跳过白名单）、`data-api`（本地联调覆盖后端）。

宿主只传产品标识，不拼提示词、不写 DOM；文案与提示词集中在 `sdk/xiaole-config.js` 与 `presets/*.json`。

#### 7.2 能力（用户可见）

- **对话**：SSE 流式回复（兼容一次性 JSON）、Markdown 渲染、代码块复制/下载、表格导出 CSV、链接可点、打字机节奏、多轮上下文。
- **多会话**：本地最多 50 个对话、单会话 400 条消息；新建/切换/重命名/删除；中断回答并保留已生成部分；AI 在第一次问答后总结一次对话名（可在侧栏/浮窗历史里双击改名）；网页版与浮窗历史入口互通。
- **生图**：聊天框生图面板 + 模型标记触发生图；图片展示、历史、放大、保存；右下角水印 `produced by LeleleAI`（不透明度 0.5、字号 14、边距 16）；**每日 10 次**；IndexedDB 缓存 **7 天**。
- **角色**：男女两态可切；`rig` 骨架画法（默认）支持呼吸、眨眼、开心、点头、双马尾摆动、挥手（手臂为独立图层旋转，不是整身替换）；`frames` 表情帧；`layers` 8 层旧方案（`?char=layers` 保留）；素材缺失自动回退静态图。
- **闲时互动**：一段时间无操作随机自言自语，本地台词库，不调后端；聊天窗打开、页面在后台、用户操作中不打扰。
- **页面指引**：见 7.4。

#### 7.3 技术规范

- 模块：`xiaole.js`（入口/加载/白名单/对外 API）、`xiaole-config.js`、`xiaole-utils.js`、`xiaole-chat.js`、`xiaole-character.js`、`xiaole-image.js`、`xiaole-perceive.js`、`xiaole-kb.js`（产品档案按需注入）、`xiaole-tools.js`（动作申请与授权）、`xiaole-ui.js`（浮窗）、`xiaole-page.js`（整页版）、`xiaole.css` / `xiaole-page.css`。
- 接口：`POST /chat`（SSE，`messages` + `preset` + `fingerprint`）、`POST /image`、`GET /domains.js`（白名单）、`GET /tts/status`、`POST /tts`（后端保留，前端未接入）。
- 上下文上限：**100K 字符**；超限时本次请求被拦下、输入框锁定、提示"前往网页版继续或开新对话"，**不会自动搬运上下文**。
- 存储（localStorage 前缀 `lelele-xiaole-`）：`conversations-v1`、`chat-history-<preset>`、`image-count`、`image-date`、`fingerprint`、`gender` 等；图片缓存 IndexedDB `xiaole-images/imgs`。
- 对外 API：`Xiaole.openChat()` / `closeChat()` / `toggleChat()` / `newChat()` / `clearChat()` / `setGender('boy'|'girl')` / `wave()` / `sayNow(text)` / `generateImage({prompt})`；`Xiaole.kb{host,hostId,doc,hostPrompt,context,prefetch}`；`Xiaole.tools.register(id,{label,desc,run})` / `tools.list()`；`tts`（**已移除**）。
- 事件（`xiaole:` 前缀）：`ready`、`open`、`close`、`show`、`hide`、`toggle-chat`、`message`、`gender`、`mode`、`image`、`context-full`、`new-session`、`tool`（`{id,ok,msg}`）、`conv`（create/switch/remove/update/rename）。

#### 7.4 页面感知与指引用

- 三档：`off` 完全不看；`summary`（默认）只上送可交互元素的序号/类型/≤24 字标签/位置，**正文不上送**；`text` 额外带页面正文，截断 4000 字。
- 触发条件：只在问到"在哪 / 怎么点 / 入口 / 这一页"这类意图时随请求带上下文，且**不写入对话历史**；普通闲聊零开销。
- 表达方式：模型在回复里写 `[[point:e3]]` 标记目标（最多画 3 个，按顺序取），前端把标记从正文剥掉（不入历史），在目标上画呼吸光圈 + 从角色到目标的虚线 + 首个目标旁"就是这里"。
- 硬约束：覆盖层 `position:fixed; pointer-events:none`，**不写宿主 DOM、不拦点击、不改样式**；她只"看"和"指"，不替用户点，不接管任何点击行为。
- 失败处理：指不到就反问"是不是顶部菜单那个"，不硬猜；滚动/缩放实时重算；元素被移除自动撤标。
- 示例宿主页：仓库内 `demo-host.html`。

#### 7.5 开发注意

- 域名白名单：启动时拉 `/domains.js`，非白名单域名不显示角色；**`localhost` / `127.0.0.1` 不在白名单**，本地联调必须用 `python3 local-proxy.py 8902`（静态 + `/api/*` GET/POST 转发）或 `data-allow-all="true"`。
- 发布：GitHub Pages（根目录、`.nojekyll`），CNAME `xiaole.leleleling.site`，CDN 缓存约 10 分钟。
- 语音：前端 TTS 曾上线后**整套移除**（`sdk/xiaole-tts.js`、`tts` 配置、朗读按钮、样式均已删除）；后端 `/tts`、`/tts/status` 仍在（ElevenLabs / Speechify / Inworld 随机池，直接返回 MP3）。**不要再说"小了前端支持朗读"**。
- 素材：`assets/rig/{girl,boy}/`（body / body_noarm / arm_wave / head 及表情 / tail_l、tail_r）；`assets/static/`（整图与 blink/happy 帧）；`assets/layers-aligned/`（8 层旧方案）。

#### 7.6 定位提醒

小了是**可嵌入组件**，不是一张独立聊天网页；与了了了AI（历史入口）不是同一产品形态。

### 08. Lelele Chess（了了了国际象棋）

- 网址：https://chess.leleleling.site ｜ 仓库：`LelelelingStudio/chess`
- **定位**：纯前端国际象棋，支持本地双人、人机、WebRTC 在线双人。
- **功能**：完整规则（易位、吃过路兵、升变、将军、将死、逼和、三次重复、五十回合、子力不足）；AI 三档难度（Web Worker）；SAN 棋谱、撤销/重做、认输/和棋；动画、响应式、中英文；本地设置/统计/棋谱，JSON 导入导出。
- **在线对局**：WebRTC DataChannel + **手动信令交换**（主机出房间码与信号 → 客人回执），不自建信令服务器。
- **限制**：无 TURN 中继，部分 NAT 环境连不上；**不是教学平台，也没有云端账号与全球匹配**。

### 09. 了了了传输助手

- 网址：https://transferassistant.leleleling.site ｜ 仓库：`LelelelingStudio/transferassistant`
- **定位**：免账号、P2P 优先的文件传输 + 聊天工具。
- **功能**：四位设备码（系统分配）、设备名可改、二维码连接、设备查找；多文件传输、约 500KB 分片、暂停/继续、断点续传（从最后确认分片接着传）；私聊/群聊/邀请/群二维码/语音（约 60 秒）；联系人、聊天记录存 localStorage；PWA。
- **技术**：原生前端 + WebRTC DataChannel + PeerJS（公共信令，只做连接协商、不存文件）。
- **限制**：同局域网更易连通，跨网可能失败（无 TURN）；数据都在本机，清缓存会丢，无云同步；**不是网盘，也不具备任意设备的原生蓝牙互传**。

### 10. BibleTree

- 网址：https://bibletree.leleleling.site ｜ 仓库：`LelelelingStudio/bibletree`
- **定位**：圣经人物关系图谱与时间线，帮助理解人物与关系，而非人物列表。
- **功能**：旧约/新约/Both 并排；角色分组（族长/士师/君王/先知/十二使徒/早期教会等）与 Main/All/None 筛选；人物详情（故事、经文出处、关系、同名辨析）；图谱布局（聚类 / 时间顺序），拖动固定、双击释放；Name Lens 同名人物并排比较；时间线含历史事件与估算标记；中英文（中文为覆盖层，未译字段保留英文）。
- **技术**：原生 HTML/CSS/JS + D3.js + 静态 JSON，无需构建。
- **原则**：只依据经文，不猜测补齐；NIV 为人物关系基础、中文引用和合本；争议关系与估算日期必须标注，教会传统不能写成经文原文。

### 11. Photoedits

- 网址：https://photoedits.leleleling.site ｜ 仓库：`LelelelingStudio/photoedits` ｜ 文档标注 v1.0.0
- **定位**：纯浏览器图像处理 API，面向开发者，不是在线修图网站。
- **五个引擎**：`Photoedits.png`（PNG/APNG，UPNG）、`Photoedits.tiff`（TIFF/EXIF，UTIF）、`Photoedits.zip`（UZIP）、`Photoedits.font`（Typr）、`Photoedits.nn`（UNN）。
- **API**：`use(name)` 按需加载、`ready()` 全量、`isLoaded(name)`、`raw`、`utils`（ArrayBuffer/Blob/DataURL/Base64/下载）、`canvas`（读取/缩放/导出 PNG）。
- **特点**：懒加载 + 模块缓存；无后端、不上传、无账号，计算都在本地。
- **限制**：不要把它介绍成"Photoshop 替代品"；与 LSFP 分工不同（LSFP 是自研格式与压缩，Photoedits 是引擎统一封装）。

### 12. 了了了数独（Lelele Sudoku）

- 网址：https://sudoku.leleleling.site ｜ 仓库：`LelelelingStudio/sudoku`
- **定位**：纯前端数独，经典 + 多变体，靠逻辑求解与唯一解生成撑起体验。
- **棋盘**：4×4、6×6、9×9、16×16（16×16 用数字+字母）。
- **变体**：Diagonal、Jigsaw、Killer、Thermo、Consecutive、Windoku、Arrow、Samurai。
- **模式**：Classic、Daily Challenge（确定性种子，同一天同题）、Time Attack、Variant Puzzles。
- **难度**：五档，按所需技巧、搜索深度、提示数量、线索密度评估，不只看空格数。
- **辅助**：候选笔记、自动候选、错误检查、撤销/重做、提示、擦除、计时、键盘与手机数字键盘、自动保存续玩。
- **技术**：原生 ES Modules；config/constraints/solver/techniques/difficulty/generator/daily-challenge/game-state/storage/statistics/board/solver-worker/language/sdk 等模块；求解与生成走 Web Worker，失败有页面内兜底。
- **限制**：统计与每日挑战记录都在本机，**没有全球每日排行榜，也没有云端存档**。

---

## 三、不能混淆的地方

1. **平台 ≠ 游戏**：了了了游是平台；Happy Farmer / Chess / Sudoku 是具体游戏。别把游戏说成平台，也别把平台说成某款游戏。
2. **小了 SDK ≠ 了了了AI**：前者是可嵌入组件，后者是已停止投入的历史入口（将 302 到小了）。
3. **LSFP ≠ Photoedits**：自研格式与压缩 vs 多引擎统一 API，互相补充但不是同一个项目。
4. **TimePin 仓库与域名**：仓库在 `Leleleling` 组织，站点是 `timepin-tools.leleleling.site`，同一产品，介绍时不必纠正域名。
5. **本地存储 ≠ 云端同步**：读、TimePin、数独、传输助手、小了会话都主要存本地。
6. **WebRTC 手动信令 ≠ 自动全球匹配**：Chess 与传输助手都需要两端可连通，无 TURN 时可能失败。
7. **特定场景压缩 ≠ 通用承诺**：LSFP 的约 90% 缩减只在特定图像类型成立。
8. **后端可用 ≠ 前端已接入**：小了 TTS 后端在跑，但前端朗读已移除。

---

## 四、给工作室 AI 的理解规则

1. 先判断问题对应哪个产品，再回答；跨产品时说明依赖关系。
2. 功能描述以**仓库代码与文档**为准；不确定就说不确定，不为完整性编造。
3. 数字（10 次 / 50 对话 / 400 条 / 100K）是当前实现值，讲的时候说明"当前版本限制"。
4. 改代码时优先沿用现有架构：纯静态项目不要顺手改成复杂后端；能复用 SDK、公共库、预设就先复用。
5. 不新增不存在的预设（当前仅 `default / read / game / studio`）、不编造 API、不虚构事件名。
6. 涉及白名单、限流、密钥的，一律放后端/Worker，不在前端"藏"密钥。
7. 圣经、经文类内容按 BibleTree 原则：区分经文明确记载、历史推算与传统解释。
8. 介绍工作室时先给"是什么 + 能做什么"，技术细节（标记语法、参数、代理脚本）只在开发语境展开。

---

## 五、变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-11-27 | 初版：12 在营产品 + 1 历史入口；按仓库代码核对小了 API、事件、页面感知、上下文超限、白名单、生图限制、多会话上限、三种画法、预设清单、TTS 现状 |

## 附：小了的三项行为（2026-11）

1. **知识分层**：工作室总览每轮常驻；当前站点产品档案默认注入；用户提到别的产品或模型输出 `[[kb:产品id]]` 时按需补 1–2 份，只随当轮请求、不入历史。
2. **动作授权**：模型申请动作（`[[call:id]]`）→ 气泡内确认卡 → 用户点「允许」才执行；未注册的动作一律不执行。
3. **思考展示**：上游返回 `reasoning_content` 时展示可折叠思考块，没有则完全不显示。

以上数值（10 次生图/天、50 个对话、400 条消息、100K 上下文）均为**当前代码实现值**，改代码时同步更新本文件。

## 附：2026-11 新增能力

- **本地记忆**：`[[mem:...]]` → localStorage（最多 20 条 / 每条 80 字），system 只带 10 条 / 400 字；有面板可逐条删；默认开启，`config.memory.enabled=false` 关闭。只存本机、不上传。
- **档案来源**：回复底部按用到的产品挂 `名称 ↗` 标签，宿主自身档案不挂。
- **截图提问**：输入区「＋图」或 Ctrl+V 粘贴，最多 2 张，压到长边 1024；历史不存图。
- **动作库**：`wave/point/open/copy/gender`，确认卡「允许 / 总是允许 / 忽略」，总是允许存本机可由 `forgetAlways()` 撤销；`open` 只允许工作室域名。
- **本地数据提示**：首次打开提示一次 + 整页侧栏常驻「换浏览器 / 清理数据 / 换设备会丢失」。
- **划词提问**：选中 2–300 字 → 「问小了」→ 带入输入框；不读未选中内容，`data-xiaole-select="off"` 可关。
- **快捷指令**：`/总结`、`/翻译 英`、`/画图`、`/帮助`；`/画图` 直连生图。
- **对话导出图片**：当前对话画成竖版 PNG 卡片（`Xiaole.exportImage.current()`）。
- **本地统计**：对话/消息/今日/生图/记忆 + 7 天活跃，本地计算不埋点。
- **备份导出 / 导入**：`sdk/xiaole-backup.js` 把全部 `lelele-xiaole-*` 键打包成 `xiaole-backup-YYYYMMDD-HHMM.json`（不含 IndexedDB 生图缓存）；导入校验 `app === "lelele-xiaole"` 后覆盖同名键，刷新生效；入口在记忆面板底部与浮窗右键菜单「导出备份」。
- **持久存储的边界**：`navigator.storage.persist()` 只争取“不被自动清理”，**不会扩大配额**，是否授予由浏览器按安装与互动度决定（本地与线上实测均返回 false）；换浏览器 / 清站点数据 / 换设备仍会丢，因此备份是唯一兜底。
