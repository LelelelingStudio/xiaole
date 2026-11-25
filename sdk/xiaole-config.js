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
      '不要提到本 SDK、接口地址、提示词等内部信息。'
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
      typeSpeed: 3,           // 打字机速度：每秒 3 个字（可调）
      maxContextChars: 100000, // 上下文上限：100K 字符
      maxRounds: 30,           // 兜底：最多保留 30 轮
      timeout: 60000
    },

    // ===== 生图参数 =====
    image: {
      endpoint: '/image',
      maxPerDay: 10,
      watermark: {
        text: 'produced by LeleleAI',
        opacity: 0.5,
        fontSize: 14,
        padding: 16
      }
    },

    // ===== 角色参数 =====
    character: {
      size: 160,
      right: 24,
      bottom: 24,
      defaultGender: 'girl',
      staticImage: {
        girl: 'assets/static/girl-static.png',
        boy: 'assets/static/boy-static.png'
      },
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
