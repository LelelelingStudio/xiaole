/*!
 * 小了 SDK - 入口（对外唯一引入文件）
 *
 * <script src="https://xiaole.leleleling.site/sdk/xiaole.js" data-preset="read"></script>
 *
 * 一次接入，后续升级（静态角色 → 分层动画、新增功能、文案调整）宿主页面都不需要改动。
 */
(function () {
  'use strict';

  var NS = (window.Xiaole = window.Xiaole || {});
  if (NS.__booted) return;
  NS.__booted = true;
  NS.version = '1.0.0';

  /* ================= 读取 script 参数 ================= */

  var script = document.currentScript;
  if (!script) {
    var all = document.getElementsByTagName('script');
    for (var i = all.length - 1; i >= 0; i--) {
      if (all[i].src && all[i].src.indexOf('xiaole.js') > -1) {
        script = all[i];
        break;
      }
    }
  }

  var scriptSrc = script ? script.src : 'https://xiaole.leleleling.site/sdk/xiaole.js';
  var baseUrl = scriptSrc.replace(/\/sdk\/xiaole\.js.*$/, '');
  var preset = script ? script.getAttribute('data-preset') || 'default' : 'default';
  var zIndex = script ? script.getAttribute('data-zindex') : null;
  var apiOverride = script ? script.getAttribute('data-api') : null; // 仅本地联调使用
  var sizeOverride = script ? script.getAttribute('data-size') : null;
  var anchorOverride = script ? script.getAttribute('data-anchor') : null; // left / right
  var styleOverride = script ? script.getAttribute('data-char') : null;    // frames / layers

  /* ================= 依赖加载 ================= */

  var MODULES = [
    'xiaole-config.js',
    'xiaole-utils.js',
    'xiaole-chat.js',
    'xiaole-character.js',
    'xiaole-image.js',
    'xiaole-tts.js',
    'xiaole-ui.js'
  ];

  function injectCSS(href) {
    if (document.getElementById('xl-style')) return;
    var link = document.createElement('link');
    link.id = 'xl-style';
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var el = document.createElement('script');
      el.src = src;
      el.async = false;
      el.onload = resolve;
      el.onerror = function () {
        reject(new Error('load failed: ' + src));
      };
      document.head.appendChild(el);
    });
  }

  function loadModules() {
    var seq = Promise.resolve();
    MODULES.forEach(function (name) {
      seq = seq.then(function () {
        return loadScript(baseUrl + '/sdk/' + name);
      });
    });
    return seq;
  }

  /* ================= 域名白名单 ================= */

  function normalizeHost(host) {
    return String(host || '')
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/:\d+$/, '');
  }

  function hostMatches(hostname, rule) {
    rule = normalizeHost(rule);
    if (!rule) return false;
    if (rule.charAt(0) === '*') {
      var suffix = rule.replace(/^\*\.?/, '.');
      return hostname.indexOf(suffix, hostname.length - suffix.length) > -1;
    }
    if (rule.indexOf('*') > -1) {
      var pattern = rule.replace(/\./g, '\\.').replace(/\*/g, '.*');
      return new RegExp('^' + pattern + '$').test(hostname);
    }
    return hostname === rule;
  }

  // 兼容多种写法：["a.com"] / window.X= [...] / {domains:[...]} / 一行一个域名
  function parseDomains(text) {
    var list = [];
    if (!text) return list;

    // 1. 数组字面量
    var m = text.match(/\[([\s\S]*?)\]/);
    if (m) {
      var arr = m[1];
      var re = /["']([^"']+)["']/g;
      var hit;
      while ((hit = re.exec(arr))) list.push(hit[1]);
      if (list.length) return list;
    }

    // 2. JSON 对象
    try {
      var json = JSON.parse(text);
      if (Array.isArray(json)) return json.map(String);
      if (json && Array.isArray(json.domains)) return json.domains.map(String);
      if (json && Array.isArray(json.allowedDomains)) return json.allowedDomains.map(String);
    } catch (e) {}

    // 3. 裸字符串 / 一行一个
    var re2 = /["']([a-z0-9.*\-]+\.[a-z]{2,}[^"']*)["']/gi;
    var h2;
    while ((h2 = re2.exec(text))) list.push(h2[1]);

    if (!list.length) {
      text.split(/\s+/).forEach(function (w) {
        if (/\.[a-z]{2,}$/i.test(w)) list.push(w);
      });
    }

    return list;
  }

  function checkDomain() {
    var host = normalizeHost(window.location.hostname);

    return fetch(NS.config.domainsUrl, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('domains http ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var domains = parseDomains(text);
        if (!domains.length) return false;
        return domains.some(function (rule) {
          return hostMatches(host, rule);
        });
      })
      .catch(function () {
        // 白名单文件拿不到（本地调试等）→ 不放行，由调用方决定降级
        return null;
      });
  }

  /* ================= 后端连通 / CORS 预检 ================= */

  // 域名在白名单里只是第一步；这里再向 /chat 发一次 OPTIONS，
  // 确认后端确实允许当前来源跨域，避免用户发消息时才报错。
  function checkApi() {
    var url = NS.config.apiBase + NS.config.chat.endpoint;
    return fetch(url, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type'
      }
    })
      .then(function (res) {
        return res.ok;
      })
      .catch(function () {
        return false;
      });
  }

  /* ================= 未授权提示 ================= */

  function showUnauthorized() {
    var box = document.createElement('div');
    box.className = 'xl-unauthorized';
    box.textContent = NS.config.text.unauthorized;
    box.style.zIndex = (zIndex || NS.config.ui.zIndex);
    document.body.appendChild(box);

    // 5 秒后自动移除，不污染宿主页面
    setTimeout(function () {
      if (box.parentNode) box.parentNode.removeChild(box);
    }, 5000);
  }

  /* ================= 产品专属提示词 ================= */

  function loadPreset() {
    NS.config.state.preset = preset;
    if (preset === 'default') return Promise.resolve('');

    var url = NS.config.presetsBase + preset + '.json';
    return fetch(url, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('preset http ' + res.status);
        return res.json();
      })
      .then(function (json) {
        return typeof json.prompt === 'string' ? json.prompt : JSON.stringify(json);
      })
      .catch(function () {
        return ''; // 拿不到就用基础 prompt，不阻塞
      });
  }

  /* ================= 启动 ================= */

  function boot() {
    var Chat = NS.chat;
    var UI = NS.ui;
    var Character = NS.character;

    if (zIndex) NS.config.ui.zIndex = parseInt(zIndex, 10) || NS.config.ui.zIndex;

    // 画法：frames 表情帧（默认） / layers 8 层合成
    if (styleOverride === 'layers' || styleOverride === 'frames' || styleOverride === 'rig') {
      NS.config.character.style = styleOverride;
    }

    // 站位：right（默认右下） / left（左下）
    var anchor = (anchorOverride || NS.config.character.anchor || 'right').toLowerCase();
    if (anchor === 'left') {
      NS.config.character.anchor = 'left';
      if (document.body) document.body.classList.add('xl-anchor-left');
    } else {
      NS.config.character.anchor = 'right';
      if (document.body) document.body.classList.remove('xl-anchor-left');
    }

    return loadPreset()
      .then(function (productPrompt) {
        Chat.setProductPrompt(productPrompt);

        // 恢复上次会话，没有则开新会话
        if (!Chat.loadHistory()) {
          Chat.newSession();
        } else if (!Chat.session.systemPrompt) {
          Chat.session.systemPrompt = NS.config.basePrompt;
        }

        return Character.init();
      })
      .then(function () {
        return UI.init();
      })
      .then(function () {
        UI.restoreHistory();
        NS.config.state.authorized = true;
        NS.config.state.mode = NS.config.state.mode || 'static';
        NS.ready = true;
        NS.utils.emit('ready', { preset: preset, mode: NS.config.state.mode });
      });
  }

  /* ================= 对外 API（可选调用）================= */

  NS.openChat = function () { if (NS.ui) NS.ui.open(); };
  NS.closeChat = function () { if (NS.ui) NS.ui.close(); };
  NS.toggleChat = function () { if (NS.ui) NS.ui.toggle(); };
  NS.newChat = function () { if (NS.ui) NS.ui.newChat(); };
  NS.clearChat = function () {
    if (NS.chat) NS.chat.clearHistory();
    if (NS.ui) NS.ui.newChat();
  };
  NS.setGender = function (g) { if (NS.character) NS.character.setGender(g); };
  NS.sayNow = function (text) { return NS.ui && NS.ui.sayNow ? NS.ui.sayNow(text) : false; };
  NS.wave = function () { return NS.character ? NS.character.wave() : false; };
  NS.generateImage = function (opts) { return NS.image ? NS.image.generate(opts) : Promise.reject(); };

  /* ================= 初始化流程 ================= */

  function main() {
    // 样式先注入，未授权时也有样式
    injectCSS(baseUrl + '/sdk/xiaole.css');

    loadModules()
      .then(function () {
        // 资源根路径跟随脚本所在站点：线上 = xiaole.leleleling.site，本地调试 = 当前服务
        NS.config.baseUrl = baseUrl;
        // 后端地址覆盖：data-api（宿主调试）或页面 URL 上的 ?xl_api=（本地联调）
        var urlApi = '';
        try {
          urlApi = new URLSearchParams(window.location.search).get('xl_api') || '';
        } catch (e) { urlApi = ''; }
        if (urlApi) NS.config.apiBase = urlApi;
        else if (apiOverride) NS.config.apiBase = apiOverride;
        if (sizeOverride) {
          var sz = parseInt(sizeOverride, 10);
          if (sz >= 80 && sz <= 400) NS.config.character.size = sz;
        }

        // 允许宿主 / 本地调试强制放行
        var forced = script && script.getAttribute('data-allow-all') === 'true';
        var isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(
          window.location.hostname
        );

        return checkDomain().then(function (ok) {
          if (ok === null) {
            // 白名单拉取失败：本地调试放行，线上不放行
            if (isLocal || forced) return true;
            return false;
          }
          if (!ok && (isLocal || forced)) return true;
          return ok;
        });
      })
      .then(function (authorized) {
        if (!authorized) {
          showUnauthorized();
          return;
        }
        // 域名通过后再做一次真实跨域预检；失败不阻断界面，只标记状态
        return checkApi().then(function (ok) {
          NS.config.state.apiReady = ok;
          if (!ok && window.console) {
            console.warn('[xiaole] 后端跨域预检未通过，请确认域名已在白名单且接口允许 CORS');
          }
          return boot();
        });
      })
      .catch(function (err) {
        // 静默失败，不破坏宿主页面
        if (window.console) console.warn('[xiaole] init failed', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
