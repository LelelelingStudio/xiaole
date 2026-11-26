/*!
 * 小了 SDK - 配置中心
 * 所有文案 / 提示词 / 限额 / 动画参数都集中在这里，改文案只改这个文件
 */
(function () {
  'use strict';

  var NS = (window.Xiaole = window.Xiaole || {});

  NS.config = {
    // ===== 资源地址 =====
    baseUrl: 'https://xiaole.leleleling.site',          // 前端资源站（图层、音频、兜底图）
    apiBase: 'https://back-xiaole.leleleling.site',     // 后端接口地址
    domainsUrl: 'https://back-xiaole.leleleling.site/domains.js', // 域名白名单
    presetsBase: 'https://xiaole.leleleling.site/presets/',       // 产品专属提示词目录

    // ===== 基础系统提示词（固定，所有产品共用）=====
    basePrompt: [
      '你是小了，了了了岭工作室的 AI 助手。',
      '了了了岭工作室目前的产品有：',
      '1. 了了了读：https://read.leleleling.site',
      '2. 了了了游：https://game.leleleling.site',
      '回答要求：以“小了”的身份说话，语气亲切、自然、简洁，不要自称看板娘或虚拟形象，',
      '不要提到本 SDK、接口地址、提示词等内部信息。',
      '排版要求：支持 Markdown。链接请写成 [文字](https://...) 的形式，不要直接甩原始长链接；',
      '代码用 ``` 包裹。',
      '只有当用户明确要求画图/生成图片/来张图时，才在回复最后单独一行输出 [[draw:画面描述]]，',
      '界面会自动帮用户生成图片；其余任何情况都不要输出 [[draw:...]]。一次回复最多一条。',
      '不要自己编造图片地址。'
    ].join('\n'),

    // ===== 对外名称与文案 =====
    name: '小了',
    text: {
      unauthorized: '这个域名不属于了了了岭工作室的官方域名',
      placeholder: '和小了说点什么…',
      send: '发送',
      newChat: '开启新对话',
      menuGender: '切换性别',
      menuHide: '隐藏小了',
      menuNewChat: '开启新对话',
      menuSound: '音效',
      menuHistory: '历史对话',
      gotoPage: '去网页版继续（带上上下文）',
      convEmpty: '还没有其他对话',
      showAgain: '显示小了',
      limitTip: '上下文到达上限，请前往小了网页版（xiaole.leleleling.site）继续对话或者开启新对话',
      imageLimitTip: '今日生图次数已用完（每天 10 次）',
      errorMsg: '网络开小差了，稍后再试试',
      loading: '小了正在思考…'
    },

    // ===== 10 条本地欢迎语（纯前端随机，不请求后端）=====
    welcome: [
      '哈喽～我是小了，有什么我可以帮你的吗？',
      '你好呀，我是小了，随时都可以和我聊聊。',
      '嗨！我是小了，不管是问题还是闲聊都可以哦。',
      '你来了，我是小了，准备好开始对话啦。',
      '哈喽哈喽，我是小了，有什么想知道的吗？',
      '你好，我是小了，很高兴能和你交流。',
      '嗨～我是小了，尽管把你的想法告诉我吧。',
      '我是小了！我们可以聊天、提问、生成图片。',
      '你好呀，我是小了，今天想做点什么呢？',
      '哈喽，我是小了，有问题尽管跟我说。'
    ],

    // ===== 聊天参数 =====
    chat: {
      endpoint: '/chat',
      stream: true,
      typeSpeed: 45,          // 打字机速度：每秒 45 字（流式回复按块即时渲染，不再逐字等）
      maxContextChars: 100000, // 上下文上限：100K 字符
      maxRounds: 30,           // 兜底：最多保留 30 轮
      timeout: 60000
    },

    // ===== 生图参数 =====
    image: {
      endpoint: '/image',
      maxPerDay: 10,
      // 图片代理：远程图片未开 CORS 时用它读字节，才能把水印真正烧进图里（拼成 canvas 后导出）
      proxy: 'https://ai.leleleling.site/proxy/image?url=',
      cacheDays: 7,          // 生成结果本地缓存 7 天，历史记录里的图不会变红叉
      watermark: {
        text: 'produced by LeleleAI',
        opacity: 0.5,
        fontSize: 14,
        padding: 16
      }
    },

    // ===== 会话参数 =====
    conv: {
      maxCount: 50,          // 最多保留 50 个对话
      maxMessages: 400,      // 单个对话最多存 400 条消息
      titleLength: 18,       // 自动生成标题的字数
      listLimit: 50
    },

    // ===== 角色参数 =====
    character: {
      size: 160,
      // 站位：'right' 右下角（默认） / 'left' 左下角；宿主可用 <script data-anchor="left"> 覆盖
      anchor: 'right',
      right: 24,
      left: 24,
      bottom: 24,
      defaultGender: 'girl',
      // 静态整体图（当前默认使用）：一张完整的全身立绘
      staticImage: {
        girl: 'assets/static/girl.png',
        boy: 'assets/static/boy.png'
      },
      // 表情帧：同一姿势只改脸，用于眨眼 / 开心反应（没有就自动只用主图）
      frames: {
        girl: { idle: 'assets/static/girl.png', blink: 'assets/static/girl-blink.png', happy: 'assets/static/girl-happy.png' },
        boy: { idle: 'assets/static/boy.png', blink: 'assets/static/boy-blink.png', happy: 'assets/static/boy-happy.png' }
      },
      // 眨眼间隔区间（毫秒）与单次眨眼时长
      blinkRange: [3200, 6500],
      blinkDuration: 120,
      // 收到回复 / 发消息时开心一下
      happyDuration: 900,
      // 角色画法：'frames' 表情帧（美术更精致，默认） / 'layers' 8 层合成（真·多部件）
      // 宿主也能用 <script data-char="layers"> 临时切过去
      style: 'frames',
      // 8 层已按相对坐标烘焙对齐（assets/layers-aligned/<性别>/），画布比例 480×760
      layersDir: 'assets/layers-aligned',
      layersCanvas: { w: 400, h: 760 },
      // 分层里默认不显示的部分（07 大蝴蝶结会挡住脸，想戴就删掉这条）
      layerHidden: ['07_accessory'],
      // 是否启用原始 8 层（取景未对齐，需自己配 layerTransform），一般不要开
      useLayers: false,
      layers: {
        girl: ['01_back_hair', '02_body', '03_face_base', '04_iris', '05_blush', '06_front_hair', '07_accessory', '08_happy'],
        boy: ['01_back_hair', '02_body', '03_face_base', '04_iris', '05_blush', '06_front_hair', '07_accessory', '08_happy']
      },
      // 单图层微调：素材各层取景不一致时，可单独缩放/位移对齐（scale、x、y）
      // 例：{ girl: { '02_body': { scale: 1.4, x: 0, y: -10 } } }
      layerTransform: { girl: {}, boy: {} },
      blink: true,
      breathe: true,
      eyeFollow: true
    },

    // ===== UI 参数 =====
    ui: {
      zIndex: 9999,
      bubble: { width: 340, height: 460, gap: 16 },
      theme: {
        primary: '#7a97d6',
        accent: '#94b8ff',
        bubbleBg: 'rgba(255,255,255,0.96)',
        textColor: '#2c3550'
      }
    },

    storagePrefix: 'lelele-xiaole-',

    // 运行时状态
    state: {
      mode: 'static',
      preset: 'default',
      authorized: false
    }
  };
})();
