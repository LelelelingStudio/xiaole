/*!
 * 小了 - 独立主页整页对话（xiaole.leleleling.site）
 * 复用 SDK 的 chat / utils / image 核心，无悬浮角色
 */
(function () {
  'use strict';

  var NS = (window.Xiaole = window.Xiaole || {});
  var C = NS.config;
  var U = NS.utils;
  var Chat = NS.chat;

  var Page = (NS.page = {});

  var listEl = null;
  var inputEl = null;
  var sendBtn = null;
  var imgPanel = null;
  var imgInput = null;
  var imgBtn = null;
  var imgCount = null;
  var typingTimer = null;

  /* ================= 构建界面 ================= */

  function build() {
    var app = document.getElementById('xl-page');
    if (!app) {
      app = U.el('div', 'xlp');
      app.id = 'xl-page';
      document.body.appendChild(app);
    }
    app.innerHTML =
      '<header class="xlp-header">' +
      '<div class="xlp-brand">' +
      '<div class="xlp-avatar">小</div>' +
      '<div class="xlp-title-wrap">' +
      '<h1 class="xlp-title">小了</h1>' +
      '<p class="xlp-sub">了了了岭工作室 · AI 助手</p>' +
      '</div>' +
      '</div>' +
      '<div class="xlp-actions">' +
      '<button class="xlp-btn" id="xlp-new">开启新对话</button>' +
      '</div>' +
      '</header>' +
      '<main class="xlp-body"><div class="xlp-messages" id="xlp-messages"></div></main>' +
      '<footer class="xlp-footer">' +
      '<div class="xlp-img-panel" id="xlp-img-panel">' +
      '<textarea class="xlp-img-input" id="xlp-img-input" rows="2" placeholder="描述你想要的画面，例如：一只在窗台上的橘猫"></textarea>' +
      '<div class="xlp-img-row">' +
      '<span class="xlp-img-count" id="xlp-img-count"></span>' +
      '<button class="xlp-img-cancel" id="xlp-img-cancel">取消</button>' +
      '<button class="xlp-img-gen" id="xlp-img-gen">生成图片</button>' +
      '</div>' +
      '</div>' +
      '<div class="xlp-input-row">' +
      '<button class="xlp-icon" id="xlp-img-toggle" title="生成图片">画</button>' +
      '<textarea class="xlp-input" id="xlp-input" rows="1" placeholder="' +
      C.text.placeholder +
      '"></textarea>' +
      '<button class="xlp-send" id="xlp-send">' + C.text.send + '</button>' +
      '</div>' +
      '<div class="xlp-tip" id="xlp-tip"></div>' +
      '</footer>';

    listEl = app.querySelector('#xlp-messages');
    inputEl = app.querySelector('#xlp-input');
    sendBtn = app.querySelector('#xlp-send');
    imgPanel = app.querySelector('#xlp-img-panel');
    imgInput = app.querySelector('#xlp-img-input');
    imgBtn = app.querySelector('#xlp-img-gen');
    imgCount = app.querySelector('#xlp-img-count');
  }

  /* ================= 事件 ================= */

  function bind() {
    sendBtn.addEventListener('click', submit);

    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        submit();
      }
    });

    inputEl.addEventListener('input', function () {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
    });

    document.getElementById('xlp-new').addEventListener('click', function () {
      Chat.newSession();
      clearMessages();
      welcome();
      setLocked(false);
    });

    document.getElementById('xlp-img-toggle').addEventListener('click', function () {
      var show = !imgPanel.classList.contains('on');
      setImgPanel(show);
    });

    document.getElementById('xlp-img-cancel').addEventListener('click', function () {
      setImgPanel(false);
    });

    imgBtn.addEventListener('click', submitImage);

    imgInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submitImage();
      }
    });
  }

  /* ================= 消息渲染 ================= */

  function scrollBottom() {
    if (listEl) listEl.scrollTop = listEl.scrollHeight;
  }

  function clearMessages() {
    if (typingTimer) {
      clearInterval(typingTimer);
      typingTimer = null;
    }
    listEl.innerHTML = '';
  }

  function addMessage(role, text, opts) {
    opts = opts || {};
    var wrap = U.el('div', 'xlp-msg xlp-msg-' + role);
    var avatar = U.el('div', 'xlp-msg-avatar', role === 'user' ? '你' : '小');
    var body = U.el('div', 'xlp-msg-body');
    var content = U.el('div', 'xlp-msg-text');

    if (opts.instant) content.innerHTML = U.toHtml(text);
    body.appendChild(content);
    wrap.appendChild(avatar);
    wrap.appendChild(body);
    listEl.appendChild(wrap);
    scrollBottom();

    if (opts.instant) return { finish: function () {} };

    var queue = '';
    var printed = '';
    var done = false;
    var speed = Math.max(1, C.chat.typeSpeed || 3);

    content.innerHTML = '<span class="xlp-cursor"></span>';
    var timer = setInterval(function () {
      if (queue.length) {
        printed += queue.charAt(0);
        queue = queue.slice(1);
        content.innerHTML = U.toHtml(printed) + '<span class="xlp-cursor"></span>';
        scrollBottom();
      } else if (done) {
        clearInterval(timer);
        content.innerHTML = U.toHtml(printed);
        scrollBottom();
      }
    }, Math.round(1000 / speed));
    typingTimer = timer;

    return {
      push: function (piece) {
        queue += piece;
      },
      finish: function () {
        done = true;
      }
    };
  }

  function addLoading() {
    var wrap = U.el('div', 'xlp-msg xlp-msg-assistant xlp-loading');
    wrap.innerHTML =
      '<div class="xlp-msg-avatar">小</div>' +
      '<div class="xlp-msg-body"><span class="xlp-spinner"></span></div>';
    listEl.appendChild(wrap);
    scrollBottom();
    return wrap;
  }

  function removeNode(node) {
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  function welcome() {
    var t = C.welcome[Math.floor(Math.random() * C.welcome.length)];
    addMessage('assistant', t, { instant: true });
  }

  function addImage(res) {
    var display = res.display || res.url || '';
    var save = res.save || res.url || display;
    var overlay = res.mode === 'overlay';
    var wrap = U.el('div', 'xlp-msg xlp-msg-assistant');
    wrap.innerHTML =
      '<div class="xlp-msg-avatar">小</div>' +
      '<div class="xlp-msg-body xlp-msg-image">' +
      '<span class="xlp-img-wrap">' +
      '<img src="' + display + '" alt="生成图片" />' +
      (overlay ? '<span class="xlp-img-wm">' + NS.config.image.watermark.text + '</span>' : '') +
      '</span>' +
      '<a class="xlp-download" href="' + save + '" download="xiaole.png">保存图片</a>' +
      '</div>';
    listEl.appendChild(wrap);
    scrollBottom();
  }

  /* ================= 提示 ================= */

  function tip(text, sticky) {
    var el = document.getElementById('xlp-tip');
    if (!el) return;
    el.textContent = text;
    el.classList.add('on');
    if (!sticky) {
      setTimeout(function () {
        el.classList.remove('on');
      }, 3200);
    }
  }

  function hideTip() {
    var el = document.getElementById('xlp-tip');
    if (el) el.classList.remove('on');
  }

  function setLocked(locked) {
    inputEl.disabled = locked;
    sendBtn.disabled = locked;
    if (locked) tip(C.text.limitTip, true);
    else hideTip();
  }

  /* ================= 发送 ================= */

  function submit() {
    if (Chat.session.busy) return;
    var text = (inputEl.value || '').trim();
    if (!text) return;

    inputEl.value = '';
    inputEl.style.height = 'auto';
    addMessage('user', text, { instant: true });

    var loading = addLoading();
    var assistant = null;

    Chat.send(text, {
      onDelta: function (piece, isDone) {
        removeNode(loading);
        loading = null;
        if (!assistant) assistant = addMessage('assistant', '', {});
        if (piece) assistant.push(piece);
        if (isDone) assistant.finish();
      },
      onLimit: function (msg) {
        removeNode(loading);
        loading = null;
        setLocked(true);
        tip(msg, true);
      },
      onDone: function () {
        removeNode(loading);
        loading = null;
        if (assistant) assistant.finish();
        hideTip();
      },
      onError: function () {
        removeNode(loading);
        loading = null;
        addMessage('assistant', C.text.errorMsg, { instant: true });
      }
    });
  }

  /* ================= 生图 ================= */

  function setImgPanel(show) {
    imgPanel.classList.toggle('on', !!show);
    if (show) {
      syncImgCount();
      setTimeout(function () {
        imgInput.focus();
      }, 160);
    }
  }

  function syncImgCount() {
    if (!NS.image) return;
    var n = NS.image.remaining();
    imgCount.textContent = n > 0 ? '今日剩余 ' + n + ' 次' : '今日次数已用完';
    imgBtn.disabled = n <= 0;
  }

  function submitImage() {
    if (!NS.image) return;
    var prompt = (imgInput.value || '').trim();
    if (!prompt) {
      tip('先写一句画面描述吧');
      return;
    }
    if (!NS.image.canGenerate()) {
      tip(C.text.imageLimitTip, true);
      syncImgCount();
      return;
    }

    imgBtn.disabled = true;
    imgBtn.textContent = '生成中…';
    addMessage('user', '画一张图：' + prompt, { instant: true });
    var loading = addLoading();

    NS.image
      .generate({ prompt: prompt })
      .then(function (res) {
        removeNode(loading);
        addImage(res);
        setImgPanel(false);
        imgBtn.disabled = false;
        imgBtn.textContent = '生成图片';
        imgInput.value = '';
        syncImgCount();
        hideTip();
      })
      .catch(function (err) {
        removeNode(loading);
        addMessage('assistant', (err && err.message) || C.text.errorMsg, { instant: true });
        imgBtn.disabled = false;
        imgBtn.textContent = '生成图片';
        syncImgCount();
      });
  }

  /* ================= 启动 ================= */

  Page.init = function () {
   try {
    build();
    bind();

    if (!Chat.loadHistory()) {
      Chat.newSession();
      welcome();
    } else {
      if (!Chat.session.systemPrompt) Chat.session.systemPrompt = C.basePrompt;
      var shown = 0;
      (Chat.session.messages || []).forEach(function (m) {
        if (m.role === 'system' || m.local) return;
        addMessage(m.role, m.content, { instant: true });
        shown++;
      });
      if (!shown) welcome();
      if (Chat.measure() >= C.chat.maxContextChars) setLocked(true);
    }

    syncImgCount();
    return Promise.resolve();
   } catch (e) {
     if (window.console) console.error('[xiaole-page] init error', e && e.message, e && e.stack);
     return Promise.resolve();
   }
  };
})();
