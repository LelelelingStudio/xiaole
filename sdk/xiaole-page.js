/*!
 * 小了 - 独立主页（xiaole.leleleling.site）
 * 多对话 + 本地历史 + 流式对话 + 内置生图（真水印 / 7 天缓存）
 */
(function () {
  'use strict';

  var NS = (window.Xiaole = window.Xiaole || {});
  var C = NS.config;
  var U = NS.utils;
  var Chat = NS.chat;

  var Page = (NS.page = {});

  var app, listEl, inputEl, sendBtn, imgPanel, imgInput, imgBtn, imgCount;
  var convListEl, overlayEl, titleEl;
  var revealedTimer = null;
  var drawingTips = [
    '小了正在打草稿…',
    '正在挑选颜色…',
    '在画布上铺底色…',
    '慢慢补细节…',
    '快好了，再等一下下…'
  ];

  /* ================= 界面 ================= */

  function build() {
    app = document.getElementById('xl-page');
    if (!app) {
      app = U.el('div', 'xlp');
      app.id = 'xl-page';
      document.body.appendChild(app);
    }

    app.innerHTML =
      '<div class="xlp-overlay" id="xlp-overlay"></div>' +
      '<aside class="xlp-side" id="xlp-side">' +
      '<div class="xlp-side-head">' +
      '<span class="xlp-side-brand">小了</span>' +
      '<button class="xlp-side-new" id="xlp-new">+ 新建</button>' +
      '</div>' +
      '<div class="xlp-conv-list" id="xlp-conv-list"></div>' +
      '<div class="xlp-side-foot">🔒 对话只存在本地浏览器<br>最多保留 50 个对话</div>' +
      '</aside>' +

      '<div class="xlp-main">' +
      '<header class="xlp-header">' +
      '<button class="xlp-menu" id="xlp-menu" title="对话列表">☰</button>' +
      '<div class="xlp-brand">' +
      '<div class="xlp-avatar">小</div>' +
      '<div class="xlp-title-wrap">' +
      '<h1 class="xlp-title" id="xlp-conv-title">小了</h1>' +
      '<p class="xlp-sub">了了了岭工作室 · AI 助手</p>' +
      '</div>' +
      '</div>' +
      '<div class="xlp-actions">' +
      '<button class="xlp-btn" id="xlp-new-top">开启新对话</button>' +
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
      '<div class="xlp-suggest" id="xlp-suggest"></div>' +
      '<div class="xlp-input-row">' +
      '<button class="xlp-icon" id="xlp-img-toggle" title="生成图片">画</button>' +
      '<textarea class="xlp-input" id="xlp-input" rows="1" placeholder="' + C.text.placeholder + '"></textarea>' +
      '<button class="xlp-send" id="xlp-send">' + C.text.send + '</button>' +
      '</div>' +
      '<div class="xlp-tip" id="xlp-tip"></div>' +
      '</footer>' +
      '</div>';

    listEl = document.getElementById('xlp-messages');
    inputEl = document.getElementById('xlp-input');
    sendBtn = document.getElementById('xlp-send');
    imgPanel = document.getElementById('xlp-img-panel');
    imgInput = document.getElementById('xlp-img-input');
    imgBtn = document.getElementById('xlp-img-gen');
    imgCount = document.getElementById('xlp-img-count');
    convListEl = document.getElementById('xlp-conv-list');
    overlayEl = document.getElementById('xlp-overlay');
    titleEl = document.getElementById('xlp-conv-title');
  }

  function renderSuggest() {
    var el = document.getElementById('xlp-suggest');
    var cfg = C.suggestions || {};
    if (!el) return;
    if (!cfg.enabled || !(cfg.items || []).length) { el.style.display = 'none'; return; }
    var html = '<div class="xlp-suggest-title">' + (cfg.title || '') + '</div><div class="xlp-suggest-list">';
    cfg.items.forEach(function (t) {
      html += '<button class="xlp-suggest-item" type="button" data-text="' +
        String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '">' + t + '</button>';
    });
    html += '</div>';
    el.innerHTML = html;
    el.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.xlp-suggest-item') : null;
      if (!btn) return;
      e.preventDefault();
      inputEl.value = btn.getAttribute('data-text') || btn.textContent;
      submit();
    });
    refreshSuggest();
  }

  function refreshSuggest() {
    var el = document.getElementById('xlp-suggest');
    var cfg = C.suggestions || {};
    if (!el) return;
    var conv = U.convs.current && U.convs.current();
    var empty = !(conv && conv.messages && conv.messages.length);
    var show = !!cfg.enabled && !!(cfg.items || []).length && (cfg.onlyEmptyConv === false || empty);
    el.classList.toggle('is-on', show);
    el.style.display = show ? 'block' : 'none';
  }

  function bind() {
    renderSuggest();
    if (titleEl) {
      titleEl.title = '双击可重命名';
      titleEl.style.cursor = 'text';
      titleEl.addEventListener('dblclick', function () {
        var conv = U.convs.current();
        if (conv) renameInline(titleEl, conv.id);
      });
    }
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

    document.getElementById('xlp-new').addEventListener('click', startNewConv);
    document.getElementById('xlp-new-top').addEventListener('click', startNewConv);
    document.getElementById('xlp-menu').addEventListener('click', function () {
      app.classList.toggle('side-open');
    });
    overlayEl.addEventListener('click', function () {
      app.classList.remove('side-open');
    });

    document.getElementById('xlp-img-toggle').addEventListener('click', function () {
      setImgPanel(!imgPanel.classList.contains('on'));
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

  /* ================= 会话列表 ================= */

  function refreshConvList() {
    if (!convListEl) return;
    var convs = U.convs.all();
    var cur = U.convs.currentId();

    if (!convs.length) {
      convListEl.innerHTML = '<div class="xlp-conv-empty">还没有对话，点「+ 新建」开始</div>';
      return;
    }

    convListEl.innerHTML = convs
      .map(function (c) {
        var active = c.id === cur ? ' active' : '';
        var count = (c.messages || []).length;
        return (
          '<div class="xlp-conv' + active + '" data-id="' + c.id + '">' +
          '<div class="xlp-conv-main">' +
          '<span class="xlp-conv-title">' + U.escape(c.title || '新对话') + '</span>' +
          '<span class="xlp-conv-meta">' + U.timeText(c.updatedAt) + ' · ' + count + ' 条</span>' +
          '</div>' +
          '<button class="xlp-conv-del" data-del="' + c.id + '" title="删除">✕</button>' +
          '</div>'
        );
      })
      .join('');

    Array.prototype.forEach.call(convListEl.querySelectorAll('.xlp-conv'), function (row) {
      row.addEventListener('click', function (e) {
        if (e.target && e.target.getAttribute && e.target.getAttribute('data-del')) return;
        if (e.target && e.target.classList && e.target.classList.contains('xlp-rename-input')) return;
        if (e.target && e.target.closest && e.target.closest('.xlp-rename-input')) return;
        openConv(row.getAttribute('data-id'));
      });
      var t = row.querySelector('.xlp-conv-title');
      if (t) {
        t.addEventListener('dblclick', function (e) {
          e.stopPropagation();
          renameInline(t, row.getAttribute('data-id'));
        });
      }
    });

    Array.prototype.forEach.call(convListEl.querySelectorAll('.xlp-conv-del'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-del');
        if (!id) return;
        var conv = U.convs.get(id);
        var hasMsg = conv && conv.messages && conv.messages.length;
        if (hasMsg && !window.confirm('删除「' + (conv.title || '新对话') + '」？本地记录不可恢复。')) return;
        var next = U.convs.remove(id);
        if (next) openConv(next);
        else startNewConv();
      });
    });
  }

  function syncTitle(conv) {
    if (titleEl) titleEl.textContent = conv && conv.title && conv.title !== '新对话' ? conv.title : '小了';
  }

  /* ================= 对话改名（AI 总结 + 双击手改） ================= */

  function autoTitle(convId, userText, replyText) {
    var conv = convId ? U.convs.get(convId) : U.convs.current();
    if (!conv || !conv.needTitle || conv.autoTitled) return;
    if (typeof Chat.title !== 'function') return;
    Chat.title(userText, replyText).then(function (t) {
      if (!t) return;
      var now = U.convs.get(convId || (conv && conv.id));
      if (!now || now.autoTitled) return; // 用户改过名就不再覆盖
      U.convs.rename(now.id, t);
      refreshConvList();
      if (now.id === U.convs.currentId()) syncTitle(now);
    });
  }

  // 双击标题就地改名，回车保存、Esc 取消
  function renameInline(el, convId, done) {
    if (!el || el.getAttribute('data-editing') === '1') return;
    var original = el.textContent;
    el.setAttribute('data-editing', '1');
    var input = document.createElement('input');
    input.className = 'xlp-rename-input';
    input.type = 'text';
    input.maxLength = 24;
    input.value = U.convs.get(convId) ? (U.convs.get(convId).title || '') : original;
    el.style.display = 'none';
    el.parentNode.insertBefore(input, el.nextSibling);
    input.focus();
    input.select();
    var finish = function (save) {
      if (!input.parentNode) return;
      var v = input.value;
      input.parentNode.removeChild(input);
      el.style.display = '';
      el.removeAttribute('data-editing');
      if (save && v && v.trim()) {
        U.convs.rename(convId, v);
        refreshConvList();
        var cur = U.convs.current();
        if (cur && cur.id === convId) syncTitle(cur);
        if (done) done(v.trim());
      }
    };
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', function () { finish(true); });
    input.addEventListener('click', function (e) { e.stopPropagation(); });
  }

  /* ================= 打开 / 新建会话 ================= */

  function openConv(id) {
    if (NS.perceive) NS.perceive.clear();
    // 正在回答时切会话：中断当前流，并把已说出的半截回答留在原会话里
    if (Chat.session.busy) {
      var prevId = U.convs.currentId();
      Chat.abort({
        onStop: function (partial) {
          var text = U.extractDraw(partial).text;
          if (text) {
            U.convs.append({ role: 'assistant', content: text + '\n\n（已中断）', type: 'text' }, prevId);
          }
        }
      });
    }
    var conv = U.convs.switchTo(id);
    if (!conv) return;
    setImgPanel(false);
    app.classList.remove('side-open');
    syncTitle(conv);
    renderConv(conv);
    refreshConvList();
    refreshSuggest();
  }

  function startNewConv() {
    setImgPanel(false);
    var conv = U.convs.create('新对话');
    app.classList.remove('side-open');
    syncTitle(conv);
    clearMessages();
    welcome();
    Chat.newSession();
    refreshConvList();
  }

  /* ================= 消息渲染 ================= */

  // 流式/静态渲染时先把 [[draw:...]] 藏起来，收尾再真正去生图
  function displayText(str) {
    return String(str || '')
      .replace(/\[\[draw[:：]([^\]]*)\]\]/gi, '')
      .replace(/\[\[draw[:：]?[^\]]*$/i, '')
      .replace(/\[\[point[:：]?[^\]]*\]\]/gi, '')
      .replace(/\[\[point[:：]?[^\]]*$/i, '')
      .replace(/\[\[kb[:：]?[^\]]*\]\]/gi, '')
      .replace(/\[\[call[:：]?[^\]]*$/i, '')
      .replace(/\[\[call[:：][^\]]*\]\]/gi, '')
      .replace(/\[\[kb[:：]?[^\]]*$/i, '');
  }

  function scrollBottom() {
    if (listEl) listEl.scrollTop = listEl.scrollHeight;
  }

  function clearMessages() {
    if (typeof refreshSuggest === 'function') refreshSuggest();
    if (revealedTimer) {
      clearInterval(revealedTimer);
      revealedTimer = null;
    }
    listEl.innerHTML = '';
  }

  function renderConv(conv) {
    clearMessages();

    // 让聊天核心的上下文跟着当前会话走
    Chat.newSession();
    var msgs = (conv && conv.messages) || [];
    var hasContent = false;

    msgs.forEach(function (m) {
      if (m.type === 'image') {
        hasContent = true;
        renderImageCard({ id: m.imgId, url: m.url, display: m.url, save: m.url, mode: 'overlay' }, m.imgId);
      } else if (m.content) {
        hasContent = true;
        addMessage(m.role, m.content, { instant: true });
        Chat.session.messages.push({ role: m.role, content: m.content });
      }
    });

    if (!hasContent) welcome();
    scrollBottom();
  }

  function welcome() {
    var t = C.welcome[Math.floor(Math.random() * C.welcome.length)];
    addMessage('assistant', t, { instant: true, local: true });
  }

  /**
   * 生成一条消息节点。流式内容按 ~60 字/秒铺出来，收完立刻全量落地，
   * 不再逐字干等（旧版 3 字/秒正是"输出超级慢"的主因）。
   */
  function addMessage(role, text, opts) {
    opts = opts || {};
    var wrap = U.el('div', 'xlp-msg xlp-msg-' + role);
    wrap.innerHTML =
      '<div class="xlp-msg-avatar">' + (role === 'user' ? '你' : '小') + '</div>' +
      '<div class="xlp-msg-body"><div class="xlp-msg-text"></div></div>';
    var content = wrap.querySelector('.xlp-msg-text');
    // 思考过程：后端给了 reasoning 才出现，没有就一直是隐藏的
    var think = U.el('details', 'xlp-think');
    think.innerHTML = '<summary>思考中…</summary><div class="xlp-think-body"></div>';
    think.style.display = 'none';
    content.parentNode.insertBefore(think, content);
    var thinkBody = think.querySelector('.xlp-think-body');
    var thinkText = '';

    function pushThink(piece) {
      if (!piece) return;
      thinkText += piece;
      thinkBody.textContent = thinkText;
      think.style.display = '';
      think.open = true;
      scrollBottom();
    }

    function sealThink() {
      if (!thinkText) return;
      think.open = false;
      think.querySelector('summary').textContent = '思考过程';
    }

    listEl.appendChild(wrap);
    scrollBottom();

    if (opts.instant) {
      content.innerHTML = U.toHtml(displayText(text));
      return { node: wrap, push: function () {}, pushThink: function () {}, finish: function () {} };
    }

    var shown = '';
    var pending = '';
    var done = false;
    content.innerHTML = '<span class="xlp-cursor"></span>';

    if (revealedTimer) {
      clearInterval(revealedTimer);
      revealedTimer = null;
    }

    var speed = Math.max(10, C.chat.typeSpeed || 45);
    var perTick = Math.max(1, Math.round(speed / 60));

    revealedTimer = setInterval(function () {
      if (pending.length) {
        shown += pending.slice(0, perTick);
        pending = pending.slice(perTick);
        content.innerHTML = U.toHtml(displayText(shown)) + '<span class="xlp-cursor"></span>';
        scrollBottom();
      } else if (done) {
        clearInterval(revealedTimer);
        revealedTimer = null;
        content.innerHTML = U.toHtml(displayText(shown || ''));
        scrollBottom();
      }
    }, 16);

    return {
      node: wrap,
      pushThink: pushThink,
      push: function (piece) {
        if (piece) pending += piece;
      },
      finish: function (finalText) {
        done = true;
        if (finalText && !shown && !pending) shown = finalText;
        // 收尾最多等 400ms，避免"字还在慢慢爬"
        setTimeout(function () {
          if (!shown && finalText) shown = finalText;
          if (pending) { shown += pending; pending = ''; }
          content.innerHTML = U.toHtml(displayText(shown));
          sealThink();
          if (revealedTimer) { clearInterval(revealedTimer); revealedTimer = null; }
          scrollBottom();
        }, 400);
      }
    };
  }

  function addLoading(kind) {
    var wrap = U.el('div', 'xlp-msg xlp-msg-assistant xlp-loading');
    if (kind === 'draw') {
      wrap.innerHTML =
        '<div class="xlp-msg-avatar">小</div>' +
        '<div class="xlp-msg-body">' +
        '<div class="xlp-drawing">' +
        '<div class="xlp-sketch"><span></span><span></span><span></span><span></span><span></span></div>' +
        '<div class="xlp-drawing-text">' + drawingTips[0] + '</div>' +
        '</div>' +
        '</div>';
      var i = 1;
      var t = setInterval(function () {
        var el = wrap.querySelector('.xlp-drawing-text');
        if (!el) { clearInterval(t); return; }
        el.textContent = drawingTips[i % drawingTips.length];
        i++;
      }, 1800);
      wrap._tipTimer = t;
    } else {
      wrap.innerHTML =
        '<div class="xlp-msg-avatar">小</div>' +
        '<div class="xlp-msg-body"><span class="xlp-spinner"></span></div>';
    }
    listEl.appendChild(wrap);
    scrollBottom();
    return wrap;
  }

  function removeNode(node) {
    if (node && node._tipTimer) clearInterval(node._tipTimer);
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  function renderImageCard(res, imgId) {
    var wrap = U.el('div', 'xlp-msg xlp-msg-assistant');
    wrap.innerHTML =
      '<div class="xlp-msg-avatar">小</div>' +
      '<div class="xlp-msg-body xlp-msg-image">' +
      '<span class="xlp-img-wrap"></span>' +
      '<a class="xlp-download" download="xiaole.png">保存图片</a>' +
      '</div>';

    var box = wrap.querySelector('.xlp-img-wrap');
    var linkEl = wrap.querySelector('.xlp-download');

    function paint(r) {
      var overlay = r.mode === 'overlay';
      box.innerHTML =
        '<img src="' + (r.display || r.url) + '" alt="生成图片" />' +
        (overlay ? '<span class="xlp-img-wm">' + C.image.watermark.text + '</span>' : '');
      linkEl.href = r.save || r.url;
      linkEl.setAttribute('download', 'xiaole-' + (r.id || 'img') + '.png');
    }

    if (imgId) {
      NS.image.restore(imgId, res.url).then(paint);
    } else {
      paint(res);
      // 水印版烤好后无缝替换（右键另存/下载都是带水印的真文件）
      if (res && res.ready) {
        res.ready.then(function (r) {
          if (r && r.display) paint(r);
        });
      }
    }

    listEl.appendChild(wrap);
    scrollBottom();
    return wrap;
  }

  /* ================= 提示 ================= */

  function tip(text, sticky) {
    var el = document.getElementById('xlp-tip');
    if (!el) return;
    el.textContent = text;
    el.classList.add('on');
    if (!sticky) {
      setTimeout(function () { el.classList.remove('on'); }, 3200);
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

  /* ================= 发送对话 ================= */

  function submit() {
    if (Chat.session.busy) return;
    var text = (inputEl.value || '').trim();
    if (!text) return;

    inputEl.value = '';
    inputEl.style.height = 'auto';
    addMessage('user', text, { instant: true });
    if (NS.character && NS.character.react) NS.character.react('happy');
    // 绑定发起会话，回答回来时不会串台
    var sendConvId = U.convs.currentId();
    U.convs.append({ role: 'user', content: text, type: 'text' }, sendConvId);
    refreshConvList();
    refreshSuggest();

    if (NS.perceive) NS.perceive.clear();

    var loading = addLoading('chat');
    var assistant = null;

    var ctxParts = [];
    var pctx = NS.perceive ? NS.perceive.context(text) : '';
    if (pctx) ctxParts.push(pctx);

    // 知识库补充上下文是异步的（要按需取档案），取完再发
    var go = function (kbCtx) {
    if (kbCtx) ctxParts.push(kbCtx);
    Chat.send(text, {
      context: ctxParts.join('\n\n'),
      onReasoning: function (piece) {
        if (U.convs.currentId() !== sendConvId) return;
        if (loading) { removeNode(loading); loading = null; }
        if (!assistant) assistant = addMessage('assistant', '');
        assistant.pushThink(piece);
      },

      onDelta: function (piece, isDone) {
        if (loading) { removeNode(loading); loading = null; }
        if (U.convs.currentId() !== sendConvId) return; // 已经切走了，不再往当前视图写
        if (!assistant) assistant = addMessage('assistant', '');
        if (piece) assistant.push(piece);
        if (isDone) assistant.finish();
      },
      onLimit: function (msg) {
        removeNode(loading);
        loading = null;
        setLocked(true);
        tip(msg, true);
      },
      onDone: function (full) {
        removeNode(loading);
        loading = null;
        if (assistant) assistant.finish(full);

        var draw = U.extractDraw(full || '');
        // 指引标记：只用来画高亮，不进正文、不存历史
        var point = U.extractPoint(draw.text || '');
        draw.text = point.text;
        // 模型申请的知识库档案：取回来给下一轮用（用户看不到标记）
        var kbs = U.extractKb(draw.text || '');
        draw.text = kbs.text;
        if (NS.kb) NS.kb.prefetch(kbs.ids);
        // 动作申请：剥掉标记，在气泡里挂"是否允许"的卡
        var calls = NS.tools ? NS.tools.parse(draw.text) : { text: draw.text, calls: [] };
        draw.text = calls.text;
        if (NS.perceive && U.convs.currentId() === sendConvId) NS.perceive.draw(point.ids);
        // 只存干净文本，别把 [[draw:...]] / [[point:...]] 指令写进历史；写回发起它的会话
        if (draw.text) U.convs.append({ role: 'assistant', content: draw.text, type: 'text' }, sendConvId);
        hideTip();
        refreshConvList();
        autoTitle(sendConvId, text, draw.text);

        // 模型自己发起的生图：扣额度、直接出图（仍记在发起的会话里）
        if (draw.prompts.length) {
          generateOnDemand(draw.prompts[0], true, sendConvId);
        }

        if (calls.calls.length && NS.tools && U.convs.currentId() === sendConvId) {
          if (!assistant) assistant = addMessage('assistant', '');
          var host = assistant.node.querySelector('.xlp-msg-body');
          calls.calls.forEach(function (c) { NS.tools.card(host, c); });
          scrollBottom();
        }
      },
      onError: function () {
        removeNode(loading);
        loading = null;
        if (U.convs.currentId() !== sendConvId) return;
        addMessage('assistant', C.text.errorMsg, { instant: true });
      }
    });
    };
    if (NS.kb) NS.kb.context(text).then(go, function () { go(''); });
    else go('');
  }

  /* ================= 生图 ================= */

  function setImgPanel(show) {
    imgPanel.classList.toggle('on', !!show);
    if (show) {
      syncImgCount();
      setTimeout(function () { imgInput.focus(); }, 160);
    }
  }

  function syncImgCount() {
    if (!NS.image) return;
    var n = NS.image.remaining();
    imgCount.textContent = n > 0 ? '今日剩余 ' + n + ' 次' : '今日次数已用完';
    imgBtn.disabled = n <= 0;
  }

  function generateOnDemand(prompt, fromModel, convIdIn) {
    if (!NS.image) return;
    if (!NS.image.canGenerate()) {
      UI_tipNoQuota();
      return;
    }
    if (!fromModel) addMessage('user', '画一张图：' + prompt, { instant: true });
    if (!fromModel) U.convs.append({ role: 'user', content: '画一张图：' + prompt, type: 'text' });
    refreshConvList();

    // 记住是在哪个会话发起的，回来时别把图塞进别人家的对话
    var convId = convIdIn || U.convs.currentId();
    var loading = addLoading('draw');

    function stillHere() {
      return U.convs.currentId() === convId;
    }

    NS.image
      .generate({ prompt: prompt })
      .then(function (res) {
        removeNode(loading);
        if (stillHere()) renderImageCard(res);
        U.convs.append({
          role: 'assistant',
          type: 'image',
          imgId: res.id,
          url: res.url,
          prompt: prompt,
          content: '（生成了图片：' + prompt + '）'
        }, convId);
        imgBtn.disabled = false;
        imgBtn.textContent = '生成图片';
        syncImgCount();
        refreshConvList();
      })
      .catch(function (err) {
        removeNode(loading);
        if (stillHere()) addMessage('assistant', (err && err.message) || C.text.errorMsg, { instant: true });
        imgBtn.disabled = false;
        imgBtn.textContent = '生成图片';
        syncImgCount();
      });
  }

  function UI_tipNoQuota() {
    tip(C.text.imageLimitTip, true);
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

    imgInput.value = '';
    imgBtn.disabled = true;
    imgBtn.textContent = '生成中…';
    setImgPanel(false);
    generateOnDemand(prompt, false);
  }

  /* ================= 图片大图弹窗 ================= */

  var lightbox = null;

  function buildLightbox() {
    lightbox = U.el('div', 'xlp-lightbox');
    lightbox.id = 'xlp-lightbox';
    lightbox.innerHTML =
      '<div class="xlp-lightbox-mask"></div>' +
      '<div class="xlp-lightbox-body">' +
      '<img alt="查看图片" />' +
      '<div class="xlp-lightbox-bar">' +
      '<a class="xlp-lightbox-dl" download="xiaole.png">保存图片</a>' +
      '<button class="xlp-lightbox-close">关闭</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(lightbox);

    lightbox.querySelector('.xlp-lightbox-mask').addEventListener('click', hideLightbox);
    lightbox.querySelector('.xlp-lightbox-close').addEventListener('click', hideLightbox);
  }

  function showLightbox(src, downloadHref) {
    if (!lightbox) buildLightbox();
    lightbox.querySelector('img').src = src;
    var dl = lightbox.querySelector('.xlp-lightbox-dl');
    dl.href = downloadHref || src;
    lightbox.classList.add('on');
  }

  function hideLightbox() {
    if (lightbox) lightbox.classList.remove('on');
  }

  // 点击消息里的图片 → 放大查看
  function bindListEvents() {
    listEl.addEventListener('click', function (e) {
      var img = e.target.closest ? e.target.closest('.xlp-msg-image img') : null;
      if (img) {
        var wrap = img.closest('.xlp-msg-image');
        var dl = wrap && wrap.querySelector('.xlp-download');
        showLightbox(img.src, dl ? dl.href : img.src);
        return;
      }

      // 文件链接：走 blob 下载，跨域也能真存下来
      var fileLink = e.target.closest ? e.target.closest('a.xl-file') : null;
      if (fileLink) {
        e.preventDefault();
        U.downloadUrl(fileLink.getAttribute('href'), fileLink.textContent.replace('下载', '').trim());
        return;
      }

      // 代码块下载
      var saveCode = e.target.closest ? e.target.closest('.xl-save-code') : null;
      if (saveCode) {
        var cb = saveCode.closest('.xl-code-block');
        var codeEl2 = cb && cb.querySelector('.xl-code');
        var langEl = cb && cb.querySelector('.xl-code-lang');
        if (codeEl2) {
          U.downloadText(codeEl2.textContent, U.codeFilename(langEl ? langEl.textContent : ''));
          saveCode.textContent = '已保存';
          setTimeout(function () { saveCode.textContent = '下载'; }, 1200);
        }
        return;
      }

      // 表格存 CSV
      var saveTable = e.target.closest ? e.target.closest('.xl-save-table') : null;
      if (saveTable) {
        var tb = saveTable.closest('.xl-table-wrap');
        var csv = U.tableToCsv(tb && tb.querySelector('table'));
        if (csv) {
          U.downloadText(csv, 'xiaole-table-' + new Date().toISOString().slice(0, 10) + '.csv', 'text/csv');
          saveTable.textContent = '已保存 CSV';
          setTimeout(function () { saveTable.textContent = '表格存为 CSV'; }, 1200);
        }
        return;
      }

      // 代码块复制
      var copyBtn = e.target.closest ? e.target.closest('.xl-copy') : null;
      if (copyBtn) {
        var block = copyBtn.closest('.xl-code-block');
        var codeEl = block && block.querySelector('.xl-code');
        if (codeEl) {
          var txt = codeEl.textContent || '';
          try {
            navigator.clipboard.writeText(txt);
            copyBtn.textContent = '已复制';
            setTimeout(function () { copyBtn.textContent = '复制'; }, 1200);
          } catch (err) {
            copyBtn.textContent = '复制失败';
          }
        }
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hideLightbox();
    });
  }

  /* ================= 初始化 ================= */

  function importFromHash() {
    var m = (location.hash || '').match(/#h=([A-Za-z0-9+/=_-]+)/);
    if (!m) return;

    var messages = null;
    try {
      var raw = m[1].replace(/-/g, '+').replace(/_/g, '/');
      var json = decodeURIComponent(escape(atob(raw)));
      messages = JSON.parse(json);
    } catch (e) {
      messages = null;
    }
    if (!messages || !messages.length) return;

    var conv = U.convs.create('从悬浮框继续', true);
    messages.forEach(function (msg) {
      if (!msg || !msg.content) return;
      U.convs.append({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: String(msg.content),
        type: 'text'
      });
    });
    conv.title = '从悬浮框继续';

    // 清掉 hash，避免刷新重复导入
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }

  Page.init = function () {
    build();
    bind();
    bindListEvents();

    // 旧版单会话记录迁移进多对话，避免升级后历史"消失"
    U.convs.migrate('chat-history-' + (C.state.preset || 'default'), '历史对话');
    U.imgStore.gc();

    // 从悬浮框带过来的上下文：xiaole.leleleling.site/index.html#h=<base64>
    importFromHash();

    var conv = U.convs.current();
    if (!conv) conv = U.convs.create('新对话', true);
    syncTitle(conv);
    renderConv(conv);
    refreshConvList();
    syncImgCount();
    scrollBottom();
  };
})();
