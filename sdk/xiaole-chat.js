/*!
 * 小了 SDK - 聊天核心
 * 提示词组装 / 上下文管理 / 后端 SSE 流式请求 / 上限判断 / 本地持久化
 */
(function () {
  'use strict';

  var NS = (window.Xiaole = window.Xiaole || {});
  var C = NS.config;
  var U = NS.utils;

  var Chat = (NS.chat = {});

  /* ================= 会话状态 ================= */

  Chat.session = {
    messages: [],        // { role, content, local? }
    productPrompt: '',   // 宿主产品专属提示词（新对话时读取一次）
    busy: false,
    aborted: false,
    contextFull: false
  };

  /* ================= 提示词 ================= */

  // 由入口层注入：Xiaole.bootstrap 读取 preset json 后调用
  Chat.setProductPrompt = function (text) {
    Chat.session.productPrompt = (text || '').trim();
  };

  // 组装 system 消息：只在开启新对话那一刻拼一次，后续不会重复叠加
  function buildSystemPrompt() {
    var base = C.basePrompt || '';
    var product = Chat.session.productPrompt;
    if (product) return base + '\n\n【当前产品说明】\n' + product;
    return base;
  }

  /* ================= 本地存储 ================= */

  function historyKey() {
    return 'chat-history-' + (C.state.preset || 'default');
  }

  Chat.loadHistory = function () {
    var saved = U.store.get(historyKey(), null);
    if (!saved || !Array.isArray(saved.messages) || !saved.messages.length) return false;

    Chat.session.messages = saved.messages;
    Chat.session.productPrompt = saved.productPrompt || Chat.session.productPrompt;
    Chat.session.startedAt = saved.startedAt || Date.now();
    return true;
  };

  Chat.saveHistory = function () {
    U.store.set(historyKey(), {
      messages: Chat.session.messages,
      productPrompt: Chat.session.productPrompt,
      startedAt: Chat.session.startedAt || Date.now()
    });
  };

  Chat.clearHistory = function () {
    U.store.remove(historyKey());
  };

  /* ================= 新对话 ================= */

  var activeController = null;

  Chat.newSession = function () {
    Chat.abort();
    Chat.session.messages = [];
    Chat.session.busy = false;
    Chat.session.aborted = true;
    Chat.session.contextFull = false;
    Chat.session.startedAt = Date.now();
    // 新对话才重新拼一次 system 消息（含当前产品专属提示词）
    Chat.session.systemPrompt = buildSystemPrompt();
    Chat.session.messages.push({ role: 'system', content: Chat.session.systemPrompt });
    Chat.saveHistory();
    U.emit('new-session');
  };

  /* ================= 上下文体积 ================= */

  Chat.measure = function () {
    return U.measure(Chat.session.messages);
  };

  Chat.isContextFull = function (extra) {
    var list = Chat.session.messages.slice();
    if (extra) list.push({ role: 'user', content: extra });
    return U.measure(list) >= C.chat.maxContextChars;
  };

  // 超长时兜底裁剪：保留 system + 最近消息
  function trimMessages() {
    var msgs = Chat.session.messages;
    while (msgs.length > 3 && U.measure(msgs) > C.chat.maxContextChars * 0.8) {
      // 从第二条（system 之后最早的一条）开始丢
      msgs.splice(1, 1);
    }
  }

  /* ================= 响应文本抽取（兼容多种后端格式）================= */

  function extractText(payload) {
    if (payload == null) return '';
    if (typeof payload === 'string') return payload;
    if (typeof payload !== 'object') return '';

    if (typeof payload.delta === 'string') return payload.delta;

    var choice = payload.choices && payload.choices[0];
    if (choice) {
      if (choice.delta) {
        if (typeof choice.delta === 'string') return choice.delta;
        if (choice.delta.content) return choice.delta.content;
        if (choice.delta.reasoning_content) return ''; // 思考内容不直接展示
      }
      if (choice.message && choice.message.content) return choice.message.content;
      if (typeof choice.text === 'string') return choice.text;
    }

    if (typeof payload.content === 'string') return payload.content;
    if (typeof payload.text === 'string') return payload.text;
    if (typeof payload.reply === 'string') return payload.reply;
    if (typeof payload.answer === 'string') return payload.answer;
    if (typeof payload.message === 'string') return payload.message;
    if (payload.message && typeof payload.message.content === 'string') return payload.message.content;

    if (payload.data) {
      if (typeof payload.data === 'string') return payload.data;
      if (typeof payload.data.content === 'string') return payload.data.content;
      if (typeof payload.data.text === 'string') return payload.data.text;
    }

    return '';
  }

  /* ================= 请求后端 ================= */

  function buildRequestMessages() {
    // 只发 system + 真实对话（过滤本地欢迎语）
    return Chat.session.messages
      .filter(function (m) {
        return !m.local;
      })
      .map(function (m) {
        return { role: m.role, content: m.content };
      });
  }

  /**
   * 发送一条用户消息
   * @param {string} text
   * @param {{onDelta:Function,onDone:Function,onError:Function}} handlers
   */
  Chat.send = function (text, handlers) {
    handlers = handlers || {};
    text = String(text || '').trim();
    if (!text) return Promise.resolve('');
    if (Chat.session.busy) return Promise.resolve('');

    if (!Chat.session.systemPrompt) {
      Chat.session.systemPrompt = buildSystemPrompt();
      if (!Chat.session.messages.length) {
        Chat.session.messages.push({ role: 'system', content: Chat.session.systemPrompt });
      }
    }

    // 上下文上限：直接拦下，不请求
    if (Chat.isContextFull(text)) {
      Chat.session.contextFull = true;
      U.emit('context-full', { messages: buildRequestMessages() });
      if (handlers.onLimit) handlers.onLimit(C.text.limitTip);
      return Promise.resolve('');
    }

    Chat.session.messages.push({ role: 'user', content: text });
    trimMessages();
    Chat.saveHistory();

    Chat.session.busy = true;
    Chat.session.aborted = false;

    var url = C.apiBase + C.chat.endpoint;
    var body = JSON.stringify({
      messages: buildRequestMessages(),
      stream: !!C.chat.stream,
      preset: C.state.preset || 'default',
      fingerprint: U.fingerprint()
    });

    var controller = null;
    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      activeController = controller;
    }
    var timer = null;
    var full = '';

    function finish(err) {
      Chat.session.busy = false;
      if (timer) clearTimeout(timer);
      if (Chat.session.aborted && !err) {
        return; // 用户切走了，别把半截回答写进别的会话
      }
      if (err) {
        if (handlers.onError) handlers.onError(err);
      } else {
        Chat.session.messages.push({ role: 'assistant', content: full });
        trimMessages();
        Chat.saveHistory();
        if (handlers.onDone) handlers.onDone(full);
      }
      U.emit('message', { role: 'assistant', content: full, error: !!err });
    }

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        if (!res.ok) {
          throw new Error('HTTP ' + res.status);
        }

        var ct = (res.headers.get('content-type') || '').toLowerCase();

        // ---- 非流式：一次性 JSON ----
        if (ct.indexOf('text/event-stream') === -1 && ct.indexOf('stream') === -1) {
          return res.text().then(function (raw) {
            var data;
            try {
              data = JSON.parse(raw);
            } catch (e) {
              data = raw;
            }
            var t = extractText(data);
            full = t;
            if (handlers.onDelta) handlers.onDelta(t, true);
            Chat.session.busy = false;
            finish(null);
            return full;
          });
        }

        // ---- 流式：SSE ----
        var reader = res.body.getReader();
        var decoder = new TextDecoder('utf-8');
        var buffer = '';

        function pump() {
          return reader.read().then(function (result) {
            if (result.done) {
              Chat.session.busy = false;
              if (handlers.onDelta) handlers.onDelta('', true);
              finish(null);
              return full;
            }
            if (Chat.session.aborted) {
              try { reader.cancel(); } catch (e) {}
              Chat.session.busy = false;
              return full;
            }

            buffer += decoder.decode(result.value, { stream: true });

            // 按行解析 SSE
            var lines = buffer.split('\n');
            buffer = lines.pop() || '';

            lines.forEach(function (line) {
              line = line.replace(/\r$/, '');
              if (!line || line.charAt(0) === ':') return;
              if (line.indexOf('data:') !== 0) return;

              var payload = line.slice(5).trim();
              if (!payload || payload === '[DONE]') return;

              var parsed;
              try {
                parsed = JSON.parse(payload);
              } catch (e) {
                parsed = payload; // 纯文本流
              }

              var piece = extractText(parsed);
              if (!piece) return;

              full += piece;
              if (handlers.onDelta) handlers.onDelta(piece, false);
            });

            return pump();
          });
        }

        timer = setTimeout(function () {
          Chat.session.aborted = true;
          if (controller) controller.abort();
        }, C.chat.timeout || 60000);

        return pump();
      })
      .catch(function (err) {
        Chat.session.busy = false;
        if (timer) clearTimeout(timer);
        // 用户自己切会话/中断的，安静结束，不弹错误
        if (Chat.session.aborting) {
          Chat.session.aborting = false;
          return full;
        }
        if (Chat.session.aborted && !full) {
          if (handlers.onError) handlers.onError(err);
          return full;
        }
        // 出错时把用户消息也回滚掉，避免上下文脏
        var idx = Chat.session.messages.length - 1;
        if (idx >= 0 && Chat.session.messages[idx].role === 'user') {
          Chat.session.messages.splice(idx, 1);
          Chat.saveHistory();
        }
        if (handlers.onError) handlers.onError(err);
        return full;
      });
  };

  /* ================= 中断 ================= */

  Chat.abort = function () {
    Chat.session.aborted = true;
    Chat.session.aborting = true;
    Chat.session.busy = false;
    if (activeController) {
      try { activeController.abort(); } catch (e) {}
      activeController = null;
    }
  };
})();
