# 小了 SDK（xiaole-sdk）

了了了岭工作室的右下角 AI 助手「小了」。宿主网站只接入一行 script，之后 SDK 的所有升级（静态角色 → 分层动画、文案调整、功能新增）都不需要改宿主代码。

- 前端站点：`https://xiaole.leleleling.site`
- 后端接口：`https://back-xiaole.leleleling.site`
- 域名白名单：`https://back-xiaole.leleleling.site/domains.js`

---

## 1. 接入方式

在目标站点 `<body>` 末尾插入：

```html
<script src="https://xiaole.leleleling.site/sdk/xiaole.js" data-preset="read"></script>
```

| 参数 | 必填 | 说明 |
|---|---|---|
| `data-preset` | 否 | 产品标识，对应 `presets/<name>.json` 里的专属提示词。不填 = `default` |
| `data-zindex` | 否 | 自定义层级，默认 9999 |
| `data-size` | 否 | 角色尺寸 px，默认 160，范围 80–400 |
| `data-anchor` | 否 | 站位：`right`（默认，右下角）或 `left`（左下角）；聊天框、右键菜单、历史面板、复位圆点会一起镜像 |
| `data-allow-all` | 否 | `true` 时跳过域名白名单校验（仅本地调试） |
| `data-api` | 否 | 覆盖后端地址（仅本地联调，例如本地代理） |

宿主不需要引入 css、不需要拼提示词、不需要操作角色 DOM。

站位示例：

```html
<!-- 右下角（默认） -->
<script src="https://xiaole.leleleling.site/sdk/xiaole.js" data-preset="read"></script>
<!-- 左下角 -->
<script src="https://xiaole.leleleling.site/sdk/xiaole.js" data-preset="read" data-anchor="left"></script>
```

---

## 2. 提示词拼装规则

```
system = 基础提示词（config.basePrompt）
       + 当前产品专属提示词（presets/<preset>.json → prompt）
```

- 两份提示词只在**开启新对话那一刻**拼一次，不会每次发消息重复叠加。
- 页面加载时不发请求、不输出内容；用户输入后才发起 `/chat`。
- 新增产品 = 新增一个 `presets/xxx.json`，宿主 `<script>` 里写 `data-preset="xxx"` 即可。

---

## 3. 接口

### POST `/chat`（流式 SSE）

请求：

```json
{
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "stream": true,
  "preset": "read",
  "fingerprint": "fp_xxx"
}
```

返回：`text/event-stream`，每行 `data: {OpenAI 格式 chunk}`，`choices[0].delta.content` 为增量文本。
SDK 同时兼容一次性 JSON 返回（自动识别 `content` / `reply` / `choices[0].message.content`）。

### POST `/image`

请求 `{ prompt, size, model, fingerprint, preset }`，返回：

```json
{ "ok": true, "image_url": "https://...png" }
```

前端拿到图后走 canvas 水印；水印失败（图片源未开 CORS）自动回落展示原图。

> 想让水印真正生效：`platform-outputs.agnes-ai.space` 需要返回 `Access-Control-Allow-Origin`，
> 或由后端把图片转存 / 以 base64 返回。当前是回落策略，图能正常显示但不带水印。

---

## 4. 目录结构

```
xiaole/
├── sdk/
│   ├── xiaole.js            入口：读参数、注入样式、加载模块、域名校验、启动
│   ├── xiaole-config.js     配置中心：提示词、文案、10 条欢迎语、限额、动画参数
│   ├── xiaole-utils.js      localStorage / 指纹 / 文本体积 / 音效 / 资源探测
│   ├── xiaole-chat.js       会话、提示词拼装、100K 上限、SSE 流式请求
│   ├── xiaole-character.js  角色：static（整体图）/ layered（分层图）自动切换
│   ├── xiaole-image.js      生图 + 每日 10 次限额 + 水印
│   ├── xiaole-ui.js         云朵聊天框、消息渲染、打字机、右键菜单、复位圆点
│   └── xiaole.css           全部样式（xl- 前缀，不污染宿主）
├── presets/                 产品专属提示词（read / game / default）
├── assets/
│   ├── static/              girl-static.png / boy-static.png（整体图兜底）
│   ├── rig/                 骨架素材：body + head(+blink/happy)，360×520（默认画法）
│   ├── layers/              原始 8 层（512×512，取景不一致）
│   └── layers-aligned/      已烘焙对齐的 8 层（400×760，分层画法用这份）
├── index.html               独立主页（整页对话，无悬浮角色）
├── sdk/xiaole-page.js       主页对话逻辑（复用 chat / image / utils）
├── sdk/xiaole-page.css      主页样式
├── demo.html                悬浮角色测试页
└── local-proxy.py           本地联调代理（静态 + /api 转发，附合法 Origin）
```

---

## 5. 本地调试

后端只放行白名单域名，localhost 会被 CORS 拦。用代理跑：

```bash
python3 local-proxy.py 8899
# 浏览器打开 http://127.0.0.1:8899/demo.html
```

`demo.html` 已带 `data-allow-all="true"` 和 `data-api="http://127.0.0.1:8899/api"`。

---

## 6. 角色素材规则

**骨架素材（默认，推荐）**：`assets/rig/girl|boy/`，四张图，统一 360×520 画布、透明 PNG、底边对齐：

```
body.png        身体（脖子以下，头部区域全透明）
body_noarm.png  挥手时用的身体（去掉那只手臂，衣侧补平）
arm_wave.png    抬起来的那只手臂（独立图层，挥手时绕肩旋转）
head.png        头部（含头发，闭眼/开心两版同画布同位置）
head_blink.png  闭眼
head_happy.png  开心
```

头部层可以从整图抠：`head = 原图 alpha − 身体 alpha`（身体层用 `image_edit` 把原画头部去掉、补全衣领就行），这样头身严格同比例，不会出现「头是特写、身是全身」的两套取景问题。

**分层素材**（第三方给的 8 层，需先烘焙对齐）：放入 `assets/layers/girl/`、`assets/layers/boy/`，命名固定：

```
01_back_hair.png  02_body.png  03_face_base.png  04_iris.png
05_blush.png     06_front_hair.png  07_accessory.png  08_happy.png
```

- 统一 512×512（或更高同比例）、透明 PNG、所有图层同一姿势同一中心点。
- 如果你的层也是「头肩特写」，先烘焙对齐再放进 `assets/layers-aligned/`：头部层等比缩放到 `k≈0.44`、以脸部包围盒中心横向对齐、以脸层下巴对齐衣领（压进去 20px 左右）即可自然衔接。
- 检测到 ≥5 层即进入 `layered` 模式：呼吸、眼珠跟随鼠标、性别切换淡入淡出。
- 缺失则自动降级 `static` 模式（`assets/static/girl-static.png`），仍可正常使用。

**静态整体图**：`assets/static/girl-static.png`、`boy-static.png`，透明 PNG，完整人物居中。
两者都没有时，前端显示圆形占位「小」，不会留白。

---

## 7. 独立主页

`index.html` 是 `xiaole.leleleling.site` 的整页对话界面：头部品牌、消息流、底部输入、内置生图面板，**不挂载右下角悬浮角色**。

本地调试可加 `?api=` 指向代理：

```
http://127.0.0.1:8899/index.html?api=http://127.0.0.1:8899/api
```

## 8. 能力清单（当前版本）

- 流式对话 + 打字机（默认 45 字/秒，`config.chat.typeSpeed`）
- 10 条本地随机欢迎语（不请求后端）
- **预设问题**：新对话时输入框上方出现一排胶囊按钮（「介绍一下你自己」等，`config.suggestions.items` 可改），点一下直接问；一旦有消息就自动收起。悬浮框与网页版都有
- **闲时自言自语**：角色空闲 30–90 秒随机说一句（`config.idleTalk`，纯前端台词库，不请求后端），以角色头顶的小云朵气泡展示，点一下就打开聊天；聊天框开着、页面切到后台、角色被隐藏、或你 12 秒内有操作时都不会出声，同一句不会连着出现
- **Markdown 渲染**：标题 / 列表 / 引用 / 分隔线 / 加粗斜体 / 行内代码 / 代码块（带语言、复制与下载按钮）/ 表格（可一键存为 CSV）
- **可点击链接**：`[文字](https://...)` 与简写 `[[文字|链接]]`；常见文件类型链接自动带 `download` 并显示「下载」标签
- **文件下载**：文件类链接点一下即下载（pdf/zip/doc/xlsx/图片/音视频等）；代码块「下载」直接存成对应后缀文件，表格「存为 CSV」导出带 BOM 的 CSV
- **先出图后烤水印**：`/image` 一返回就先显示原图（DOM 水印），带水印 PNG 烤好后原地替换，肉眼等待少一半
- **图片点击放大**：任何 AI 生图/历史图片点击后弹出大图，可另存
- **模型自助生图**：模型在回复中输出 `[[draw:画面描述]]`，前端自动生成图片并扣当日额度（每天 10 次）
- **多对话**：左侧会话列表，最多 50 个；悬浮框与网页版共用同一份 `conversations-v1`，在哪边接着聊都行
- **图片 7 天本地缓存**：IndexedDB 存带水印 PNG，刷新/换页后历史图片仍可看可下
- 100K 字符上下文上限：超出锁定输入框，并给出「去网页版继续（带上上下文）」按钮（上下文 base64 带进 `#h=`，网页版自动新建对话接上）
- 隐藏后右下角 14px 复位圆点，点击召回
- 点击角色开合云朵聊天框，附轻量音效（WebAudio 合成，静音可关）
- 生图 `/image` + 每日 10 次限额（指纹 + localStorage）+ 右下水印（自动明暗自适应）
- 非白名单域名 ⇒ 只显示「这个域名不属于了了了岭工作室的官方域名」，不渲染角色
- 域名通过后额外做一次 `/chat` OPTIONS 预检，跨域被拦时控制台告警，不会等用户发消息才失败
- 聊天框内置生图面板（`画` 按钮）：次数提示、生成中状态、结果图 + 保存链接
- 站位可配置：`data-anchor="left"` 左下角 / 默认右下角，聊天框与右键菜单一起镜像
- **角色多部件合成（默认 rig 画法）**：身体层 `body.png` + 头部层 `head.png`（另带 `head_blink` / `head_happy` 两版），加柔光、地面阴影、整体呼吸、头部轻微点头；平时随机眨眼，发消息或收到回复时开心一下，全部由 `config.character.rig` 驱动。头和身体是从同一张原画拆出来的，所以比例天然一致：先用 `image_edit` 把原图头部去掉补全衣领得到身体层，再用「原图 alpha 减去身体 alpha」抠出含双马尾的头部层，两张等比同画布（360×520）叠上去即可
- **长发单独成层**：双马尾从头部层再拆出 `tail_l` / `tail_r`，跟在头部容器里一起点头，同时各自左右轻摆（5.2s / 6.1s 不同周期，不会同步得像机器人）
- **挥手**：`Xiaole.wave()`（也对外暴露成 `Ch.wave`）。手臂是**独立图层** `arm_wave.png`，挥手时身体切到 `body_noarm.png`，手臂绕肩部（`origin`，画布百分比）从 95° 旋转到 0° 抬起，再左右摆两下（CSS `xl-arm-wave`，1.6s），结束后手臂淡出、身体切回。男女都支持，因为不再整身替换，不会出现「手一挥人就变小」的问题。打开聊天时有 70% 概率自动挥一下。
- 老画法仍可选：`?char=frames` 单图+表情帧、`?char=layers` 8 层合成
- **8 层合成画法（可选）**：`00` 那 8 张原始层是「头肩特写 + 全身无头」两套取景，直接叠会变成大头。已按相对坐标离线烘焙成 `assets/layers-aligned/{girl,boy}/`（统一 400×760 画布）：头部 7 层缩放 `k=0.44` 并平移到同一中心，身体 `02_body` 放大 `S=1.12`（女）/ `1.10`（男）后下移对齐，下巴压进衣领 `24px/22px`。切 `style:'layers'` 或宿主加 `data-char="layers"`、预览 `?char=layers` 即用；分层模式下眨眼=眼珠层压扁淡出，开心=整只上弹 + 腮红提饱和
- 切会话/删会话时若正在回答：自动中断，并把已输出的半截回答带「（已中断）」留在原会话，不会串到新会话
- 站点自带 `404.html`（云朵 + 「小」形象 + 回首页/演示页/产品入口）

---

## 9. 对外 API（宿主可选调用）

```js
Xiaole.openChat();  Xiaole.closeChat();  Xiaole.toggleChat();
Xiaole.newChat();   Xiaole.clearChat();
Xiaole.setGender('girl');  // 'girl' | 'boy'
Xiaole.wave();             // 挥一下手（没有挥手素材时返回 false）
Xiaole.sayNow();           // 立刻说一句闲话（台词也可传入：sayNow('在吗')）
Xiaole.generateImage({ prompt: '一只猫' });
```

事件：`window.addEventListener('xiaole:ready', ...)`，另有 `open / close / message / gender / mode / image / context-full`。

---

## 10. 部署（GitHub Pages）

仓库 `LelelelingStudio/xiaole`，分支 `main`，Pages 从根目录发布，站点 `https://xiaole.leleleling.site`。

注意两点：
- 仓库根目录放了 `.nojekyll`，避免 GitHub Pages 走 Jekyll 处理带下划线/静态资源路径。
- 所有资源使用相对路径（`./sdk/xx.js`、`./assets/layers/...`），因此 Pages 子路径部署也不会 404。
- 根目录 `404.html` 即自定义 404 页，Pages 会自动用于所有不存在的路径（含子路径）。

跑一次完整回归：

```
python3 local-proxy.py 8899
# 主页：http://127.0.0.1:8899/index.html?api=http://127.0.0.1:8899/api
# 悬浮：http://127.0.0.1:8899/demo.html?xl_api=http://127.0.0.1:8899/api
```

线上地址联调（不需要代理，域名已在白名单）：

```
https://xiaole.leleleling.site/index.html
https://xiaole.leleleling.site/demo.html
```

## 11. 语音朗读（已下线）

后端 `back-xiaole.leleleling.site` 仍保留 `GET /tts/status` 与 `POST /tts`（三供应商随机池，直接返回 MP3），接口未改动，随时可重新接入。
前端已整块移除：`sdk/xiaole-tts.js` 删除、`tts` 配置块删除、`index.html` 与 `MODULES` 不再加载该脚本、气泡上不再有「读」按钮、相关样式一并删除。后端保留不动，互不影响。

## 12. 页面感知与指引用

她只能"看"和"指"，不替用户点：所有标记画在一层 `pointer-events:none` 的覆盖层上，不写宿主 DOM、不拦点击。

- 宿主开关：`<script ... data-xiaole-perceive="summary|text|off">`，默认 `summary`。
- `summary`：只上送可识别元素（序号｜类型｜≤24 字标签｜位置），正文不上送；`text`：额外带页面正文（≤4000 字）；`off`：完全不看页面。
- 只在问到"在哪 / 怎么点 / 入口 / 这一页"时随请求带上下文，普通闲聊零开销；上下文不写进对话历史。
- 模型用 `[[point:e3]]` 标记目标（可多个，前端最多画 3 个），标记从正文里剥掉、不入历史。
- 视觉：目标外呼吸光圈 + 从角色到目标的虚线 + 首个目标旁「就是这里」；滚动/缩放实时重算，元素消失自动撤掉。
- 指不到时模型按要求改用反问，不画任何高亮。示例宿主页：`demo-host.html`。

## 13. 工作室知识库

- `docs/LelelelingStudio-Knowledge-Base.md`：完整知识库（12 个在营产品 + 1 个历史入口；每个产品按「定位 / 场景 / 功能 / 技术与限制」分层；小了单列技术规范与开发注意）。所有数字标注为当前实现值。
- `kb/*.json`：按产品拆分的档案（`index.json` + 12 份），供 SDK 按需调取。
- `presets/studio.json`：625 字的工作室背景预设，宿主机用 `<script ... data-preset="studio">` 即可使用。

注入策略（两层 + 按需）：
1. **工作室总览永远在**：写死在 `config.basePrompt` 里，每轮都有，与站点无关。
2. **产品详情默认只给当前站点那一份**：宿主用 `data-product="timepin"` 指定（不写则用 preset 同名兜底），启动时取 `kb/<id>.json` 拼进系统提示词；换预设/改档案后，旧对话也会按 `Chat.rebuildSystem()` 重拼一次。
3. **AI 可自主要更多**：用户提问里提到别的产品名（别名/站点）→ 自动取对应档案，只随本轮请求发送、不入历史；模型也可以输出 `[[kb:timepin]]` 主动申请，SDK 取回后下一轮注入，标记对用户不可见。
- 预设目录跟随脚本站点，本地联调会读本仓库 `presets/`，线上读 `https://xiaole.leleleling.site/presets/`。

## 14. 版本策略

宿主只接一次。后续迭代改动范围：文案与提示词改 `config` / `presets`；素材升级直接替换 `assets`；样式与逻辑更新随 `xiaole.js` 自动生效；后端接口变更在 SDK 内部做兼容，不改变对外调用方式。

## 动作调用（需要用户点头）

模型可以在回复里申请执行一个动作，**SDK 不会自己跑**，先在气泡里弹一张确认卡，用户点「允许」才执行，点「忽略」就当没发生过。

- 模型输出格式：`[[call:动作id]]`，可带参数 `[[call:point {"element":"e5"}]]`；标记对用户不可见，也不写进历史。
- 宿主开放能力：`Xiaole.tools.register('id', { label: '标题', desc: '说明', run: fn })`，`run` 可返回字符串作为结果提示。
- 内置两个：`wave`（挥手）、`point`（在页面上圈出元素，只画不点）。
- 没注册的 id 会显示"这个动作没有开放"，不会执行；`config.tools.enabled=false` 时全部标记直接剥掉。
- 事件：`xiaole:tool` → `{ id, ok, msg }`。

## 域名自动认领产品档案

宿主可以不写 `data-product`：`kb/index.json` 里有一张 `domains` 表（域名 → 产品 id），SDK 启动时按 `location.hostname` 自动认领当前站点档案。显式 `data-product` 优先，认不出来就只用工作室总览。

## 思考过程展示

后端返回 `reasoning_content` 时，气泡上方会出现一个可折叠的「思考过程」块，流式期间展开、输出结束自动收起（点标题可再展开）。没有 thinking 内容就完全不显示，不会留空块。

## 本地记忆（默认开启）

模型用 `[[mem:一句话]]` 申请记住长期偏好，前端存进 `localStorage`（键 `lelele-xiaole-memory`，最多 20 条、每条 80 字），并给一条轻提示。system 提示词里会拼上最多 10 条、共 400 字的「你记住的事」。

- 查看/删除：浮窗菜单「记忆」、整页头部「记忆」按钮打开面板，可逐条删或全部清空。
- 开关：`config.memory.enabled=false` 可整体关闭（不记、不读、标记直接剥掉）。
- 注意：只存本机，**不上传**；换浏览器、清理站点数据、换设备会一起丢失。
- 面板里还能：查看并「撤销」之前点过「总是允许」的动作；查看已用/可用空间；点「申请持久存储」（`navigator.storage.persist()`，需 HTTPS 页面，浏览器可能不授予）。持久存储只降低被自动清理的概率，手动清站点数据照样会丢。

## 回复下的档案来源

用到别的产品档案时（自动匹配或 `[[kb:id]]`），回复底部会挂 `产品名 ↗` 小标签，点了直接去对应站点。宿主自己那份档案不挂标签。

## 发截图提问

输入区「＋图」或直接 Ctrl+V 粘贴截图，最多两张，前端压到长边 1024 / JPEG 82% 再随请求发。后端把多段内容透传给支持视觉的模型（实测 deepseek-flash 能答「蓝色」）。历史里只存文字，不存图片。

## 动作库

内置：`wave` 挥手、`point` 圈位置、`open` 打开工作室页面（仅 `*.leleleling.site`）、`copy` 复制文本、`gender` 切换形象。

确认卡三档：**允许**（这次）/ **总是允许**（写进 `lelele-xiaole-tool-allow`，之后不再问）/ **忽略**。宿主用 `Xiaole.tools.register()` 扩展自己的动作；`Xiaole.tools.forgetAlways(id)` 可撤销授权。

## 数据只在本地

首次打开会提示一次：对话、记忆、生图记录都只存在这台浏览器的本地存储，不上传；换浏览器 / 清理站点数据 / 换设备会丢失。整页侧栏底部常驻同一句说明。

## 备份：导出 / 导入

「记忆」面板底部「备份」一节：

- **导出备份**：把 `lelele-xiaole-*` 全部键打成一个 `xiaole-backup-YYYYMMDD-HHMM.json` 下载。含全部对话、记忆、允许记录、性别、生图计数等文本数据；**不含 IndexedDB 里的生图缓存**（图片可重新生成，且体积大）。
- **导入备份**：选同一个 JSON，覆盖同名键，提示“刷新页面后生效”。校验 `app === 'lelele-xiaole'`，不是本应用导出的文件会拒绝。
- 浮窗右键菜单里也有「导出备份」，不用进面板，点一下直接下载。
- API：`Xiaole.backup.summary()` / `export()` / `import(file)` / `clearAll()`；事件 `xiaole:backup` → `{action:'export'|'import'|'clear', count}`。

这是换浏览器、换设备时唯一能保住数据的办法，比持久存储可靠。

## 划词提问 / 快捷指令 / 对话导出 / 本地统计

- **划词提问**：宿主页面选中一段文字（2–300 字），旁边出现「问小了」，点开聊天并把这段带进输入框。不读没选中的内容、不改宿主 DOM；`data-xiaole-select="off"` 可关。
- **快捷指令**：`/总结 内容`、`/翻译 英 内容`（或 `/翻译 中 …`）、`/画图 提示词`、`/帮助`。`/画图` 直接走生图，其余转成正常提问。
- **导出对话图片**：整段对话导出在浮窗右键菜单「导出对话图片」/整页头部「导出图片」；**每条回答下面也有「导出这张图」**，只导这一问一答。纯本地 canvas，不上传。API：`Xiaole.exportImage.current()` / `pair(q,a)`。
- **本地使用统计**：记忆面板里显示对话数/消息数/今日消息/生图次数/记忆条数 + 最近 7 天活跃点，全从本地存储算，不埋点。API：`Xiaole.stats.summary()` / `Xiaole.stats.html()`。
- **单条导出现在在右键菜单里**：直接右键某条回答就是「导出这张图」，不再在每条回答下面挂按钮。
- **`/帮助` 会留成一条正式回答**，关掉提示也还在。

## 搜索 / 图片比例 / 模板 / 自定义指令 / 导出 / 主题 / 动作 / 快照

- **会话搜索**：顶栏「搜索」→ 跨全部对话搜标题和正文，点结果直接跳过去。API：`Xiaole.extras.search()`。
- **图片比例与模板**：生图面板可选 1:1 / 9:16 / 16:9 / 4:3，内置头像/海报/表情包/产品图四套模板；选择会记住（`lelele-xiaole-img-size`）。
- **自定义指令**：顶栏「自定义指令」，一行一条 `名字=提示词`，`{内容}` 会被替换；之后 `/名字 内容` 即可。API：`Xiaole.commands.setCustom([{name,prompt}])`。
- **导出 Markdown / PDF**：顶栏两个按钮；PDF 走浏览器打印，可另存。长图导出单条上限已提到 4000 字、最多 80 条消息。
- **主题**：浅色 / 深色 / 跟随系统三态循环（`lelele-xiaole-theme`）。
- **角色动作**：`Xiaole.character.act('nod'|'jump'|'think'|'happy'|'wave')`；挥手优先用整帧举手美术，女生不再出现三只手/无袖。
- **本地快照**：每 7 天自动把「对话 + 记忆 + 工具授权」打成快照存本地（`lelele-xiaole-snapshot`），顶栏「本地快照」可手动刷新并下载 JSON。只在本机，不上传。

