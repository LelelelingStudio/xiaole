/*!
 * 小了 SDK - UI 层
 * 云朵聊天框 / 消息渲染 / 打字机 / 右键菜单 / 隐藏后复位小圆点
 */
(function () {
  'use strict';

  var NS = (window.Xiaole = window.Xiaole || {});
  var C = NS.config;
  var U = NS.utils;
  var Chat = NS.chat;

  var UI = (NS.ui = {});

  var bubble = null;      // 云朵聊天框
  var listEl = null;      // 消息列表
  var inputEl = null;
  var sendBtn = null;
  var newChatBtn = null;
  var menuEl = null;
  var dotEl = null;
  var tipEl = null;
  var imagePanel = null;
  var imagePromptEl = null;
  var imageGenBtn = null;
  var imageCountEl = null;
  var suggestEl = null;
  var sayEl = null;
  var sayTimer = null;
  var sayNextTimer = null;
  var lastInteract = 0;
  var sayQueue = [];
  var open = false;

  // 打字机状态
  var typing = null; // { el, queue, timer, cursor }

  /* ================= 初始化 ================= */

  UI.init = function () {
    buildBubble();
    buildMenu();
    buildResetDot();
    bindGlobal();
    bindListClick();
    U.convs.migrate('chat-history-' + (C.state.preset || 'default'), '历史对话');
    U.imgStore.gc();
    UI.restoreConv();
    syncImageCount();
    UI.startIdleTalk();
    return Promise.resolve();
  };

  /* ================= 云朵聊天框 ================= */

  function buildBubble() {
    bubble = U.el('div', 'xl-cloud');
    bubble.id = 'xl-cloud';

    var header = U.el('div', 'xl-cloud-header');
    header.innerHTML =
      '<div class="xl-cloud-title"><span class="xl-dot-live"></span>' + C.name + '</div>' +
      '<div class="xl-cloud-actions">' +
      '<button class="xl-icon-btn" id="xl-new-chat" title="' + C.text.newChat + '">＋</button>' +
      '<button class="xl-icon-btn" id="xl-close" title="收起">×</button>' +
      '</div>';

    listEl = U.el('div', 'xl-cloud-messages');
    listEl.id = 'xl-messages';

    var footer = U.el('div', 'xl-cloud-footer');
    footer.innerHTML =
      '<button class="xl-icon-btn xl-image-toggle" id="xl-image-toggle" title="生成图片">画</button>' +
      '<input class="xl-input" id="xl-input" type="text" autocomplete="off" placeholder="' +
      C.text.placeholder + '" />' +
      '<button class="xl-send" id="xl-send">' + C.text.send + '</button>';

    // 生图面板（默认收起）
    imagePanel = U.el('div', 'xl-image-panel');
    imagePanel.id = 'xl-image-panel';
    imagePanel.innerHTML =
      '<div class="xl-image-head"><span>画一张图</span>' +
      '<span class="xl-image-count" id="xl-image-count"></span></div>' +
      '<textarea class="xl-image-input" id="xl-image-prompt" rows="2" placeholder="描述你想要的画面，例如：一只在窗台上的橘猫"></textarea>' +
      '<div class="xl-image-actions">' +
      '<button class="xl-image-cancel" id="xl-image-cancel">取消</button>' +
      '<button class="xl-image-gen" id="xl-image-gen">生成</button>' +
      '</div>';

    tipEl = U.el('div', 'xl-tip');
    tipEl.id = 'xl-tip';

    suggestEl = U.el('div', 'xl-suggest');
    suggestEl.id = 'xl-suggest';
    buildSuggestions();

    bubble.appendChild(header);
    bubble.appendChild(listEl);
    bubble.appendChild(tipEl);
    bubble.appendChild(suggestEl);
    bubble.appendChild(imagePanel);
    bubble.appendChild(footer);
    document.body.appendChild(bubble);

    inputEl = bubble.querySelector('#xl-input');
    sendBtn = bubble.querySelector('#xl-send');
    newChatBtn = bubble.querySelector('#xl-new-chat');
    imagePanel = bubble.querySelector('#xl-image-panel');
    imagePromptEl = bubble.querySelector('#xl-image-prompt');
    imageGenBtn = bubble.querySelector('#xl-image-gen');
    imageCountEl = bubble.querySelector('#xl-image-count');

    bubble.querySelector('#xl-image-toggle').addEventListener('click', function () {
      UI.toggleImagePanel();
    });
    bubble.querySelector('#xl-image-cancel').addEventListener('click', function () {
      UI.toggleImagePanel(false);
    });
    imageGenBtn.addEventListener('click', function () { submitImage(); });
    imagePromptEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submitImage();
      }
    });

    sendBtn.addEventListener('click', submit);
    newChatBtn.addEventListener('click', function () {
      UI.newChat();
    });
    inputEl.addEventListener('input', function () { UI.touch(); });
    suggestEl.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.xl-suggest-item') : null;
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var text = btn.getAttribute('data-text') || btn.textContent;
      inputEl.value = text;
      UI.touch();
      submit();
    });

    bubble.querySelector('#xl-close').addEventListener('click', function () {
      UI.close();
    });

    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        submit();
      }
    });

    // 点聊天框内部不触发外部关闭
    bubble.addEventListener('click', function (e) {
      e.stopPropagation();
    });
    bubble.addEventListener('contextmenu', function (e) {
      e.stopPropagation();
    });
  }

  /* ================= 右键菜单 ================= */

  function buildMenu() {
    menuEl = U.el('div', 'xl-menu');
    menuEl.id = 'xl-menu';
    menuEl.innerHTML =
      '<div class="xl-menu-item" data-action="gender">' + C.text.menuGender + '</div>' +
      '<div class="xl-menu-item" data-action="new-chat">' + C.text.menuNewChat + '</div>' +
      '<div class="xl-menu-item" data-action="history">' + C.text.menuHistory + '</div>' +
      '<div class="xl-menu-item" data-action="sound">' + C.text.menuSound +
      '<span class="xl-menu-state" id="xl-sound-state"></span></div>' +
      '<div class="xl-menu-item" data-action="hide">' + C.text.menuHide + '</div>';

    document.body.appendChild(menuEl);

    menuEl.addEventListener('click', function (e) {
      e.stopPropagation(); // 别让 document 的“点空白关闭”把刚打开的面板关掉
      var item = e.target.closest('.xl-menu-item');
      if (!item) return;
      var action = item.getAttribute('data-action');
      UI.closeMenu();

      if (action === 'gender') {
        NS.character.toggleGender();
      } else if (action === 'hide') {
        UI.close();
        NS.character.hide();
      } else if (action === 'new-chat') {
        UI.newChat();
      } else if (action === 'history') {
        UI.openHistory();
      } else if (action === 'sound') {
        var on = U.sound.toggle();
        UI.syncSoundState();
        if (on) U.sound.play('open');
      }
    });

    UI.syncSoundState();
  }

  UI.syncSoundState = function () {
    var el = document.getElementById('xl-sound-state');
    if (el) el.textContent = U.sound.enabled() ? '开' : '关';
  };

  UI.openMenu = function (x, y) {
    if (!menuEl) return;
    menuEl.classList.add('xl-show');
    var rect = menuEl.getBoundingClientRect();
    var left = Math.min(x, window.innerWidth - rect.width - 8);
    var top = Math.min(y, window.innerHeight - rect.height - 8);
    menuEl.style.left = Math.max(8, left) + 'px';
    menuEl.style.top = Math.max(8, top) + 'px';
    UI.closeMenu._opened = true;
  };

  UI.closeMenu = function () {
    if (menuEl) menuEl.classList.remove('xl-show');
  };

  /* ================= 复位小圆点 ================= */

  function buildResetDot() {
    dotEl = U.el('div', 'xl-reset-dot');
    dotEl.id = 'xl-reset-dot';
    dotEl.title = C.text.showAgain;
    document.body.appendChild(dotEl);

    dotEl.addEventListener('click', function (e) {
      e.stopPropagation();
      NS.character.show();
      U.sound.play('open');
    });
  }

  /* ================= 全局事件 ================= */

  function bindGlobal() {
    // 任何一次用户操作都算「不闲」，闲时气泡会等一会儿再说
    ['mousemove', 'keydown', 'pointerdown', 'wheel'].forEach(function (ev) {
      document.addEventListener(ev, function () { UI.touch(); }, { passive: true });
    });

    // 窗口变化时重新贴一次直线
    window.addEventListener('resize', function () { if (open) positionBubble(); });

    // 角色点击 → 开合聊天框
    window.addEventListener('xiaole:toggle-chat', function () {
      UI.toggle();
    });

    // 点页面其他地方收起菜单 / 历史面板
    document.addEventListener('click', function (e) {
      if (UI.closeMenu._opened) {
        UI.closeMenu();
        UI.closeMenu._opened = false;
      }
      var panel = document.getElementById('xl-history');
      if (panel && !panel.contains(e.target)) {
        panel.parentNode.removeChild(panel);
      }
    });

    // 上下文超限：提示 + 带上下文去网页版继续
    window.addEventListener('xiaole:context-full', function (ev) {
      UI.showHandoff(ev && ev.detail);
    });

    // 新对话
    window.addEventListener('xiaole:new-session', function () {
      UI.clearMessages();
      renderWelcome();
      UI.setLocked(false);
    });
  }

  /* ================= 上下文超限：带去网页版 ================= */

  function encodeHandoff(messages) {
    var trimmed = (messages || [])
      .filter(function (m) { return m && (m.role === 'user' || m.role === 'assistant'); })
      .slice(-24)
      .map(function (m) {
        return { role: m.role, content: String(m.content || '').slice(0, 4000) };
      });
    var json = JSON.stringify(trimmed);
    if (json.length > 60000) json = JSON.stringify(trimmed.slice(-8));
    try {
      return btoa(unescape(encodeURIComponent(json)));
    } catch (e) {
      return '';
    }
  }

  UI.showHandoff = function (detail) {
    UI.showTip(C.text.limitTip, true);
    var tipEl = document.getElementById('xl-tip');
    if (!tipEl) return;

    var payload = encodeHandoff(detail && detail.messages);
    var url = 'https://xiaole.leleleling.site/index.html' + (payload ? '#h=' + payload : '');

    var link = document.createElement('a');
    link.className = 'xl-handoff';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = C.text.gotoPage;
    tipEl.appendChild(link);
  };

  // 聊天框贴着角色头顶上方，避免压住她的脸（宿主 size 不同也能自适应）
  function positionBubble() {
    if (!bubble) return;
    var chEl = NS.character && NS.character.el && NS.character.el();
    if (!chEl) return;
    var r = chEl.getBoundingClientRect();
    if (!r.height) return;
    var b = Math.round(window.innerHeight - r.top + 8);
    bubble.style.bottom = b + 'px';
    bubble.style.maxHeight = Math.max(240, window.innerHeight - b - 14) + 'px';
  }

  /* ================= 预设问题（纯前端） ================= */

  function convIsEmpty() {
    var conv = U.convs.current && U.convs.current();
    if (!conv) return true;
    return !(conv.messages && conv.messages.length);
  }

  function buildSuggestions() {
    var cfg = C.suggestions || {};
    if (!suggestEl) return;
    var items = cfg.items || [];
    if (!cfg.enabled || !items.length) {
      suggestEl.innerHTML = '';
      suggestEl.style.display = 'none';
      return;
    }
    var html = '<div class="xl-suggest-title">' + (cfg.title || '') + '</div><div class="xl-suggest-list">';
    items.forEach(function (t) {
      html += '<button class="xl-suggest-item" type="button" data-text="' +
        String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '">' + t + '</button>';
    });
    html += '</div>';
    suggestEl.innerHTML = html;
  }

  UI.refreshSuggest = function () {
    if (!suggestEl) return;
    var cfg = C.suggestions || {};
    var show = !!cfg.enabled && !!(cfg.items || []).length;
    if (show && cfg.onlyEmptyConv !== false && !convIsEmpty()) show = false;
    suggestEl.classList.toggle('is-on', show);
    suggestEl.style.display = show ? '' : 'none';
  };

  /* ================= 闲时自言自语：30–90 秒随机一句小云朵 ================= */

  function buildSayBubble() {
    sayEl = U.el('div', 'xl-say');
    sayEl.id = 'xl-say';
    sayEl.innerHTML = '<span class="xl-say-text"></span>';
    sayEl.addEventListener('click', function (e) {
      e.stopPropagation();
      hideSay();
      UI.open();
    });
    document.body.appendChild(sayEl);
  }

  UI.touch = function () {
    lastInteract = Date.now();
  };

  function pickLine() {
    var cfg = C.idleTalk || {};
    var lines = cfg.lines || [];
    if (!lines.length) return '';
    if (!sayQueue.length) {
      sayQueue = lines.slice();
      for (var i = sayQueue.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = sayQueue[i]; sayQueue[i] = sayQueue[j]; sayQueue[j] = t;
      }
    }
    return sayQueue.pop();
  }

  function positionSay() {
    if (!sayEl) return;
    var chEl = NS.character && NS.character.el && NS.character.el();
    if (!chEl) return;
    var r = chEl.getBoundingClientRect();
    if (!r.width) return;
    var isLeft = (C.character && C.character.anchor) === 'left';
    sayEl.style.top = Math.max(8, r.top - sayEl.offsetHeight - 10) + 'px';
    if (isLeft) {
      sayEl.style.left = Math.max(8, r.left + r.width * 0.5) + 'px';
      sayEl.style.right = 'auto';
    } else {
      sayEl.style.right = Math.max(8, window.innerWidth - (r.left + r.width * 0.9)) + 'px';
      sayEl.style.left = 'auto';
    }
  }

  function hideSay() {
    if (sayTimer) { clearTimeout(sayTimer); sayTimer = null; }
    if (sayEl) {
      sayEl.classList.remove('is-on');
      if (NS.character && NS.character.isHidden && NS.character.isHidden()) return;
    }
  }

  function showSay() {
    var cfg = C.idleTalk || {};
    if (!cfg.enabled || !sayEl) return;
    if (open || document.hidden) return;
    if (NS.character && NS.character.isHidden && NS.character.isHidden()) return;
    var gap = (cfg.minIdle === 0) ? 0 : (cfg.minIdle || 12000);
    if (Date.now() - (lastInteract || 0) < gap) return;
    var text = pickLine();
    if (!text) return;
    sayEl.querySelector('.xl-say-text').textContent = text;
    sayEl.style.display = 'block';
    positionSay();
    // 强制一次回流，让过渡生效
    void sayEl.offsetWidth;
    sayEl.classList.add('is-on');
    if (NS.character && NS.character.react) NS.character.react('happy');
    if (sayTimer) clearTimeout(sayTimer);
    sayTimer = setTimeout(hideSay, cfg.duration || 6500);
  }

  function scheduleSay() {
    var cfg = C.idleTalk || {};
    if (!cfg.enabled) return;
    if (sayNextTimer) clearTimeout(sayNextTimer);
    var min = cfg.minGap || 30000;
    var max = cfg.maxGap || 90000;
    var wait = min + Math.random() * Math.max(0, max - min);
    sayNextTimer = setTimeout(function () {
      showSay();
      scheduleSay();
    }, wait);
  }

  UI.sayNow = function (text) {
    if (!sayEl) buildSayBubble();
    var cfg = C.idleTalk || {};
    if (text) {
      sayEl.querySelector('.xl-say-text').textContent = text;
    } else if (!sayEl.querySelector('.xl-say-text').textContent) {
      sayEl.querySelector('.xl-say-text').textContent = pickLine();
    }
    sayEl.style.display = 'block';
    positionSay();
    void sayEl.offsetWidth;
    sayEl.classList.add('is-on');
    if (sayTimer) clearTimeout(sayTimer);
    sayTimer = setTimeout(hideSay, cfg.duration || 6500);
    return true;
  };

  UI.startIdleTalk = function () {
    var cfg = C.idleTalk || {};
    if (!cfg.enabled) return;
    buildSayBubble();
    lastInteract = Date.now();
    scheduleSay();
    if (window.Xiaole && window.Xiaole.config && window.Xiaole.config.debugSay) {
      setTimeout(function () { showSay(); }, 800);
    }
  };

  UI.hideSay = hideSay;

  /* ================= 开合 ================= */

  UI.open = function () {
    if (NS.character && NS.character.react) NS.character.react('happy');
    if (UI.hideSay) UI.hideSay();
    if (UI.touch) UI.touch();
    if (UI.refreshSuggest) UI.refreshSuggest();
    positionBubble();
    if (open) return;
    // 第一次打开聊天时顺手挥个手（有挥手素材时才会生效）
    if (NS.character && NS.character.wave && Math.random() < 0.7) {
      setTimeout(function () { NS.character.wave(); }, 280);
    }
    open = true;
    bubble.classList.add('xl-open');
    U.sound.play('open');
    setTimeout(function () {
      if (inputEl) inputEl.focus();
      scrollToBottom();
    }, 180);
    U.emit('open');
  };

  UI.close = function () {
    if (!open) return;
    open = false;
    bubble.classList.remove('xl-open');
    U.sound.play('close');
    U.emit('close');
  };

  UI.toggle = function () {
    if (open) UI.close();
    else UI.open();
    return open;
  };

  UI.isOpen = function () {
    return open;
  };

  /* ================= 消息渲染 ================= */

  function scrollToBottom() {
    if (!listEl) return;
    listEl.scrollTop = listEl.scrollHeight;
  }

  UI.clearMessages = function () {
    if (typing && typing.timer) clearInterval(typing.timer);
    typing = null;
    if (listEl) listEl.innerHTML = '';
  };

  // 本地欢迎语（不进入上下文，不请求后端）
  function renderWelcome() {
    var text = C.welcome[Math.floor(Math.random() * C.welcome.length)];
    addMessage('assistant', text, { local: true, instant: true });
  }

  // 藏掉模型发来的生图指令，别让它露在气泡里
  function uiText(str) {
    return String(str || '')
      .replace(/\[\[draw[:：]([^\]]*)\]\]/gi, '')
      .replace(/\[\[draw[:：]?[^\]]*$/i, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function addMessage(role, text, opts) {
    opts = opts || {};
    var wrap = U.el('div', 'xl-msg xl-msg-' + role);
    var avatar = U.el('div', 'xl-avatar', role === 'user' ? '你' : '<span>小</span>');
    var body = U.el('div', 'xl-msg-body');
    var content = U.el('div', 'xl-msg-text');

    if (opts.instant) {
      content.innerHTML = U.toHtml(uiText(text));
    }

    body.appendChild(content);
    wrap.appendChild(avatar);
    wrap.appendChild(body);
    listEl.appendChild(wrap);
    scrollToBottom();

    if (opts.instant) {
      return { wrap: wrap, content: content, finish: function () {} };
    }

    // 打字机：先建一个空节点，流式追加
    var queue = '';
    var printed = '';
    var finished = false;
    var cursor = U.el('span', 'xl-cursor');
    content.appendChild(cursor);

    var speed = Math.max(1, C.chat.typeSpeed || 3);
    var interval = Math.round(1000 / speed);

    typing = {
      el: content,
      cursor: cursor,
      timer: setInterval(function () {
        if (queue.length > 0) {
          var take = 1;
          printed += queue.slice(0, take);
          queue = queue.slice(take);
          content.innerHTML = U.toHtml(uiText(printed)) + '<span class="xl-cursor"></span>';
          scrollToBottom();
        } else if (finished) {
          clearInterval(typing.timer);
          typing = null;
          content.innerHTML = U.toHtml(uiText(printed));
          scrollToBottom();
        }
      }, interval)
    };

    return {
      wrap: wrap,
      content: content,
      push: function (piece) {
        queue += piece;
      },
      finish: function () {
        finished = true;
      },
      isDone: function () {
        return finished && !queue.length;
      }
    };
  }

  function showLoading() {
    var wrap = U.el('div', 'xl-msg xl-msg-assistant xl-loading');
    wrap.innerHTML =
      '<div class="xl-avatar"><span>小</span></div>' +
      '<div class="xl-msg-body"><div class="xl-msg-text">' +
      '<span class="xl-spinner"><i></i></span>' +
      '</div></div>';
    listEl.appendChild(wrap);
    scrollToBottom();
    return wrap;
  }

  /* ================= 提示条 ================= */

  UI.showTip = function (text, sticky) {
    if (!tipEl) return;
    tipEl.textContent = text;
    tipEl.classList.add('xl-show');
    if (!sticky) {
      setTimeout(function () {
        tipEl.classList.remove('xl-show');
      }, 3000);
    }
  };

  UI.hideTip = function () {
    if (tipEl) tipEl.classList.remove('xl-show');
  };

  /* ================= 锁定输入（上下文满）================= */

  UI.setLocked = function (locked) {
    if (!inputEl) return;
    inputEl.disabled = locked;
    sendBtn.disabled = locked;
    if (locked) {
      inputEl.classList.add('xl-locked');
      UI.showTip(C.text.limitTip, true);
    } else {
      inputEl.classList.remove('xl-locked');
      UI.hideTip();
    }
  };

  /* ================= 生图面板 ================= */

  function syncImageCount() {
    if (!imageCountEl || !NS.image) return;
    var n = NS.image.remaining();
    imageCountEl.textContent = n > 0 ? '今日剩余 ' + n + ' 次' : '今日次数已用完';
    if (imageGenBtn) imageGenBtn.disabled = n <= 0;
  }

  UI.toggleImagePanel = function (force) {
    if (!imagePanel) return;
    var show =
      force === undefined ? !imagePanel.classList.contains('xl-show') : !!force;
    if (show) imagePanel.classList.add('xl-show');
    else imagePanel.classList.remove('xl-show');
    if (show) {
      syncImageCount();
      setTimeout(function () {
        if (imagePromptEl) imagePromptEl.focus();
      }, 200);
    }
  };

  /* ---- 大图弹窗（与网页版同款）---- */
  var lb = null;

  function showLightbox(src, dl) {
    if (!lb) {
      lb = U.el('div', 'xlp-lightbox');
      lb.innerHTML =
        '<div class="xlp-lightbox-mask"></div>' +
        '<div class="xlp-lightbox-body"><img alt="查看图片" />' +
        '<div class="xlp-lightbox-bar">' +
        '<a class="xlp-lightbox-dl" download="xiaole.png">保存图片</a>' +
        '<button class="xlp-lightbox-close">关闭</button></div></div>';
      document.body.appendChild(lb);
      lb.querySelector('.xlp-lightbox-mask').addEventListener('click', function () {
        lb.classList.remove('on');
      });
      lb.querySelector('.xlp-lightbox-close').addEventListener('click', function () {
        lb.classList.remove('on');
      });
    }
    lb.querySelector('img').src = src;
    lb.querySelector('.xlp-lightbox-dl').href = dl || src;
    lb.classList.add('on');
  }

  function bindListClick() {
    listEl.addEventListener('click', function (e) {
      var img = e.target.closest ? e.target.closest('.xl-msg-image img') : null;
      if (img) {
        var body = img.closest('.xl-msg-image');
        var dl = body && body.querySelector('.xl-img-download');
        showLightbox(img.src, dl ? dl.href : img.src);
        return;
      }
      var fileLink = e.target.closest ? e.target.closest('a.xl-file') : null;
      if (fileLink) {
        e.preventDefault();
        U.downloadUrl(fileLink.getAttribute('href'), fileLink.textContent.replace('下载', '').trim());
        return;
      }

      var copyBtn = e.target.closest ? e.target.closest('.xl-copy') : null;
      if (copyBtn) {
        var block = copyBtn.closest('.xl-code-block');
        var codeEl = block && block.querySelector('.xl-code');
        if (codeEl) {
          try {
            navigator.clipboard.writeText(codeEl.textContent || '');
            copyBtn.textContent = '已复制';
            setTimeout(function () { copyBtn.textContent = '复制'; }, 1200);
          } catch (err) {}
        }
      }
    });
  }

  function addImageMessage(res) {
    var display = res.display || res.url || '';
    var save = res.save || res.url || display;
    var overlay = res.mode === 'overlay';
    var wrap = U.el('div', 'xl-msg xl-msg-assistant');
    wrap.innerHTML =
      '<div class="xl-avatar"><span>小</span></div>' +
      '<div class="xl-msg-body xl-msg-image">' +
      '<span class="xl-img-wrap">' +
      '<img src="' + display + '" alt="生成图片" />' +
      (overlay ? '<span class="xl-img-wm">' + C.image.watermark.text + '</span>' : '') +
      '</span>' +
      '<a class="xl-img-download" href="' + save + '" download="xiaole.png">保存图片</a>' +
      '</div>';
    listEl.appendChild(wrap);
    scrollToBottom();

    // 水印版稍后替换
    if (res && res.ready) {
      res.ready.then(function (r) {
        if (!r || !r.display) return;
        var img = wrap.querySelector('.xl-msg-image img');
        if (img) img.src = r.display;
        var dl = wrap.querySelector('.xl-img-download');
        if (dl) dl.href = r.save || r.display;
        var wm = wrap.querySelector('.xl-img-wm');
        if (wm) wm.parentNode.removeChild(wm);
      });
    }
  }

  function submitImage(promptArg, opts) {
    if (!NS.image) return;
    opts = opts || {};
    var prompt = String(promptArg || (imagePromptEl.value || '')).trim();
    if (!prompt) {
      UI.showTip('先写一句画面描述吧');
      return;
    }
    if (!NS.image.canGenerate()) {
      UI.showTip(C.text.imageLimitTip, true);
      syncImageCount();
      return;
    }

    imageGenBtn.disabled = true;
    imageGenBtn.textContent = '生成中…';
    if (!opts.quiet) addMessage('user', '画一张图：' + prompt, { instant: true });

    // 记住发起的会话，生成回来时别串到别的对话
    var convId = U.convs.currentId();
    function stillHere() { return U.convs.currentId() === convId; }
    var loading = showLoading();

    NS.image
      .generate({ prompt: prompt })
      .then(function (res) {
        if (loading && loading.parentNode) loading.parentNode.removeChild(loading);
        if (stillHere()) addImageMessage(res);
        U.convs.append({
          role: 'assistant',
          type: 'image',
          imgId: res.id,
          url: res.url,
          prompt: prompt,
          content: '（生成了图片：' + prompt + '）'
        }, convId);
        imageGenBtn.disabled = false;
        imageGenBtn.textContent = '生成';
        imagePromptEl.value = '';
        syncImageCount();
        UI.hideTip();
      })
      .catch(function (err) {
        if (loading && loading.parentNode) loading.parentNode.removeChild(loading);
        if (stillHere()) addMessage('assistant', (err && err.message) || C.text.errorMsg, { instant: true });
        imageGenBtn.disabled = false;
        imageGenBtn.textContent = '生成';
        syncImageCount();
      });
  }

  /* ================= 发送 ================= */

  function submit() {
    if (Chat.session.busy) return;
    var text = (inputEl.value || '').trim();
    if (!text) return;

    inputEl.value = '';
    if (NS.character && NS.character.react) NS.character.react('happy');
    addMessage('user', text, { instant: true });
    var sendConvId = U.convs.currentId();
    U.convs.append({ role: 'user', content: text, type: 'text' }, sendConvId);

    if (UI.refreshSuggest) UI.refreshSuggest();

    var loading = showLoading();
    var assistant = null;

    Chat.send(text, {
      onDelta: function (piece, done) {
        if (loading && loading.parentNode) loading.parentNode.removeChild(loading);
        loading = null;

        if (!assistant) assistant = addMessage('assistant', '', {});
        if (piece) assistant.push(piece);
        if (done) assistant.finish();
      },
      onLimit: function (msg) {
        if (loading && loading.parentNode) loading.parentNode.removeChild(loading);
        loading = null;
        UI.setLocked(true);
        UI.showTip(msg, true);
      },
      onDone: function (full) {
        if (loading && loading.parentNode) loading.parentNode.removeChild(loading);
        loading = null;
        if (assistant) assistant.finish();
        var draw = U.extractDraw(full || '');
        if (draw.text) U.convs.append({ role: 'assistant', content: draw.text, type: 'text' }, sendConvId);
        if (NS.character && NS.character.react) NS.character.react('happy');
        if (draw.prompts.length) submitImage(draw.prompts[0], { quiet: true });
        UI.hideTip();
      },
      onError: function () {
        if (loading && loading.parentNode) loading.parentNode.removeChild(loading);
        loading = null;
        addMessage('assistant', C.text.errorMsg, { instant: true });
      }
    });
  }

  /* ================= 新对话 ================= */

  UI.newChat = function () {
    Chat.newSession();
    U.convs.create('新对话', true);
    UI.clearMessages();
    renderWelcome();
    UI.setLocked(false);
    UI.hideTip();
    U.sound.play('open');
    UI.open();
    if (UI.refreshSuggest) UI.refreshSuggest();
  };

  /* ================= 多对话（与网页版共享同一份本地记录） ================= */

  function chatContextFromConv(conv) {
    Chat.newSession();
    (conv && conv.messages || []).forEach(function (m) {
      if (m.role === 'system' || !m.content) return;
      Chat.session.messages.push({ role: m.role, content: m.content });
    });
  }

  UI.restoreConv = function () {
    // 切会话时如果还在回答，先中断，避免串到新会话
    if (NS.chat && NS.chat.session && NS.chat.session.busy) {
      var prevId = U.convs.currentId();
      NS.chat.abort({
        onStop: function (partial) {
          var text = U.extractDraw(partial).text;
          if (text) U.convs.append({ role: 'assistant', content: text + '\n\n（已中断）', type: 'text' }, prevId);
        }
      });
    }
    var conv = U.convs.current();
    if (!conv) conv = U.convs.create('新对话', true);
    chatContextFromConv(conv);
    UI.clearMessages();

    if (UI.refreshSuggest) UI.refreshSuggest();
    var msgs = (conv.messages || []).slice();
    if (!msgs.length) {
      renderWelcome();
      return;
    }

    // 顺序渲染：图片要等 IDB 取回来，避免图片插到文字后面
    var i = 0;
    (function next() {
      if (i >= msgs.length) return;
      var m = msgs[i++];

      if (m.type === 'image' && m.url) {
        var fallback = { id: m.imgId, url: m.url, display: m.url, save: m.url, mode: 'overlay' };
        if (NS.image && NS.image.restore && m.imgId) {
          NS.image
            .restore(m.imgId, m.url)
            .then(function (res) { addImageMessage(res && res.display ? res : fallback); next(); })
            .catch(function () { addImageMessage(fallback); next(); });
        } else {
          addImageMessage(fallback);
          next();
        }
      } else if (m.role && m.content) {
        addMessage(m.role, m.content, { instant: true });
        next();
      } else {
        next();
      }
    })();
  };

  UI.openHistory = function () {
    var panel = document.getElementById('xl-history');
    if (panel) { panel.parentNode.removeChild(panel); return; }

    // 面板独立浮层：聊天框收起时也能看到，位置跟着角色/聊天框走
    panel = U.el('div', 'xl-history');
    panel.id = 'xl-history';
    var convs = U.convs.all();
    var cur = U.convs.currentId();

    if (!convs.length) {
      panel.innerHTML = '<div class="xl-history-empty">' + C.text.convEmpty + '</div>';
    } else {
      panel.innerHTML = convs.map(function (c) {
        return '<div class="xl-history-item' + (c.id === cur ? ' on' : '') + '" data-id="' + c.id + '">' +
          '<span class="xl-history-title">' + U.escape(c.title || '新对话') + '</span>' +
          '<span class="xl-history-meta">' + U.timeText(c.updatedAt) + '</span>' +
          '</div>';
      }).join('');
    }

    document.body.appendChild(panel);

    var isLeft = C.character.anchor === 'left';
    var size = Math.min(C.character.size || 160, 210);
    panel.style.width = '232px';
    if (isLeft) {
      panel.style.left = ((C.character.left || 24) + 8) + 'px';
    } else {
      panel.style.right = ((C.character.right || 24) + 8) + 'px';
    }
    panel.style.bottom = ((C.character.bottom || 24) + size - 40) + 'px';

    panel.addEventListener('click', function (e) {
      var item = e.target.closest('.xl-history-item');
      if (!item) return;
      var conv = U.convs.switchTo(item.getAttribute('data-id'));
      if (!conv) return;
      chatContextFromConv(conv);
      UI.clearMessages();
      UI.restoreConv();
      if (panel.parentNode) panel.parentNode.removeChild(panel);
      UI.open(); // 保证点完就能看到内容
    });
  };

  /* ================= 历史恢复 ================= */

  UI.restoreHistory = function () {
    // 历史统一由 UI.restoreConv（多对话存储）渲染，这里只同步上下文上限状态
    if (Chat.measure() >= C.chat.maxContextChars) {
      UI.setLocked(true);
    }
  };
})();
