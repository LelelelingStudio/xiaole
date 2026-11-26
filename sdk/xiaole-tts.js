/*!
 * 小了 SDK - 语音朗读（TTS）
 * 只调用统一后端 /tts，不接触任何供应商 Key；支持生成中/播放/暂停/继续/停止，
 * 切换消息时自动停掉上一条，同一条消息复用已生成的音频。
 */
(function () {
  'use strict';

  var NS = (window.Xiaole = window.Xiaole || {});
  var C = NS.config;
  var U = NS.utils;

  var TTS = (NS.tts = {});

  var cfg = function () { return C.tts || {}; };

  TTS.available = null;        // null=未检测，true/false
  TTS.providers = [];
  var cache = [];              // [{key, url}] 最近生成的音频，最多 N 条
  var active = null;           // 当前播放上下文

  function api(path) {
    return (C.apiBase || '') + path;
  }

  /* ================= 状态检测 ================= */

  TTS.init = function () {
    if (TTS._p) return TTS._p;
    TTS._p = fetch(api(cfg().statusEndpoint || '/tts/status'), { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (d) {
        TTS.available = !!(d && d.available);
        TTS.providers = (d && d.providers) || [];
        U.emit('tts-status', { available: TTS.available, providers: TTS.providers });
        return TTS.available;
      })
      .catch(function () {
        TTS.available = false;
        return false;
      });
    return TTS._p;
  };

  TTS.enabled = function () {
    return cfg().enabled !== false && TTS.available !== false;
  };

  /* ================= 文本处理 ================= */

  // Markdown → 适合朗读的纯文本：代码块直接跳过，链接只读文字
  TTS.plain = function (src) {
    var t = String(src || '');
    t = t.replace(/```[\s\S]*?```/g, ' ');
    t = t.replace(/`([^`]*)`/g, '$1');
    t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
    t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    t = t.replace(/<[^>]+>/g, ' ');
    t = t.replace(/^\s{0,3}#{1,6}\s*/gm, '');
    t = t.replace(/^\s*[-*+]\s+/gm, '');
    t = t.replace(/^\s*\d+[.)]\s+/gm, '');
    t = t.replace(/^\s*\|?[\s:|-]{6,}\|?\s*$/gm, ' ');
    t = t.replace(/[*_~>#]/g, ' ');
    t = t.replace(/[ \t]+/g, ' ');
    t = t.replace(/\n{3,}/g, '\n\n');
    return t.trim();
  };

  // 按句子切块，避免单次请求过长
  function chunks(text, size) {
    size = size || (cfg().chunkSize || 300);
    var out = [];
    var rest = String(text || '').replace(/\s+/g, ' ').trim();
    while (rest.length) {
      if (rest.length <= size) { out.push(rest); break; }
      var cut = -1;
      var marks = ['。', '！', '？', '；', '.', '!', '?', ';', '\n'];
      for (var i = Math.min(size, rest.length) - 1; i > size * 0.4; i--) {
        if (marks.indexOf(rest.charAt(i)) !== -1) { cut = i + 1; break; }
      }
      if (cut < 0) cut = size;
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    return out.filter(Boolean);
  }
  TTS.chunks = chunks;

  /* ================= 音频缓存 ================= */

  function cacheKey(text) {
    return (text || '').slice(0, 60) + '|' + (text || '').length;
  }

  function cacheGet(key) {
    for (var i = 0; i < cache.length; i++) {
      if (cache[i].key === key) return cache[i].url;
    }
    return '';
  }

  function cachePut(key, url) {
    var max = cfg().maxCache || 4;
    cache.push({ key: key, url: url });
    while (cache.length > max) {
      var old = cache.shift();
      if (active && active.urls.indexOf(old.url) !== -1) { cache.push(old); break; }
      try { URL.revokeObjectURL(old.url); } catch (e) {}
    }
  }

  function fetchAudio(text) {
    var key = cacheKey(text);
    var hit = cacheGet(key);
    if (hit) return Promise.resolve(hit);
    return fetch(api(cfg().endpoint || '/tts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var ct = (res.headers.get('content-type') || '').toLowerCase();
        if (ct.indexOf('audio') === -1) throw new Error('not-audio');
        return res.blob();
      })
      .then(function (blob) {
        var url = URL.createObjectURL(blob);
        cachePut(key, url);
        return url;
      });
  }

  /* ================= 播放控制 ================= */

  function clearActive(keepAudio) {
    if (!active) return;
    var a = active;
    active = null;
    if (a.audio) {
      try { a.audio.pause(); } catch (e) {}
      a.audio.onended = null;
      a.audio.onerror = null;
      a.audio.removeAttribute('src');
      try { a.audio.load(); } catch (e) {}
    }
    a.btn && a.btn.setState('idle');
    a.btn && a.btn.clearHint();
  }

  function playFrom(ctx, index) {
    if (active !== ctx) return;
    if (index >= ctx.chunks.length) {
      clearActive();
      return;
    }
    var url = ctx.urls[index];
    if (!url) {
      // 还没生成这一块
      ctx.btn.setState('loading');
      fetchAudio(ctx.chunks[index])
        .then(function (u) {
          if (active !== ctx) { return; }
          ctx.urls[index] = u;
          playFrom(ctx, index);
        })
        .catch(function () {
          if (active !== ctx) return;
          ctx.btn.setState('error');
          ctx.btn.hint('语音暂时不可用');
          // 单块失败不影响后面的块
          setTimeout(function () {
            if (active === ctx) { ctx.btn.setState('paused'); }
          }, 1600);
          playFrom(ctx, index + 1);
        });
      return;
    }
    var audio = new Audio(url);
    audio.preload = 'auto';
    ctx.audio = audio;
    ctx.index = index;
    audio.onended = function () { playFrom(ctx, index + 1); };
    audio.onerror = function () {
      if (active !== ctx) return;
      ctx.urls[index] = '';
      playFrom(ctx, index + 1);
    };
    ctx.btn.setState('playing');
    ctx.btn.clearHint();
    var p = audio.play();
    if (p && p.catch) p.catch(function () {
      if (active !== ctx) return;
      ctx.btn.setState('paused');
    });
  }

  /**
   * 开始朗读一段文本
   * @param {string} text
   * @param {Object} btn  由 TTS.mount 构造的按钮控制器
   */
  TTS.speak = function (text, btn) {
    var plain = TTS.plain(text);
    if (!plain) return;
    if (!TTS.enabled()) { btn && btn.setState('idle'); return; }
    clearActive();
    var parts = chunks(plain);
    var ctx = {
      btn: btn,
      chunks: parts,
      urls: new Array(parts.length),
      index: 0,
      audio: null
    };
    active = ctx;
    // 先把第一块生成出来，界面停在 loading
    btn && btn.setState('loading');
    fetchAudio(parts[0])
      .then(function (u) {
        if (active !== ctx) return;
        ctx.urls[0] = u;
        playFrom(ctx, 0);
      })
      .catch(function () {
        if (active !== ctx) return;
        btn && btn.setState('error');
        btn && btn.hint('语音暂时不可用');
        setTimeout(function () {
          if (active === ctx) clearActive();
        }, 1800);
      });
    return ctx;
  };

  TTS.pause = function () {
    if (!active || !active.audio) return;
    active.audio.pause();
    active.btn && active.btn.setState('paused');
  };

  TTS.resume = function () {
    if (!active || !active.audio) return;
    var p = active.audio.play();
    active.btn && active.btn.setState('playing');
    if (p && p.catch) p.catch(function () {
      active.btn && active.btn.setState('error');
      active.btn && active.btn.hint('无法继续播放');
    });
  };

  TTS.stop = function () {
    clearActive();
  };

  TTS.isActive = function () {
    return !!active;
  };

  /* ================= 给消息挂朗读按钮 ================= */

  function makeBtn(host, getText) {
    var ctl = {};
    var box = document.createElement('div');
    box.className = 'xl-tts';
    var play = document.createElement('button');
    play.type = 'button';
    play.className = 'xl-tts-play';
    play.title = '朗读这条回复';
    play.textContent = cfg().label || '读';
    var stopBtn = document.createElement('button');
    stopBtn.type = 'button';
    stopBtn.className = 'xl-tts-stop';
    stopBtn.title = '停止朗读';
    stopBtn.textContent = '■';
    var hint = document.createElement('span');
    hint.className = 'xl-tts-hint';

    box.appendChild(play);
    box.appendChild(stopBtn);
    box.appendChild(hint);
    host.appendChild(box);

    function setState(state) {
      box.className = 'xl-tts is-' + state;
      play.textContent =
        state === 'loading' ? '…' :
        state === 'playing' ? '暂停' :
        state === 'paused' ? '继续' :
        state === 'error' ? '重试' : (cfg().label || '读');
      stopBtn.style.display = (state === 'loading' || state === 'playing' || state === 'paused') ? '' : 'none';
    }
    ctl.setState = setState;
    ctl.hint = function (msg) {
      hint.textContent = msg || '';
      if (hint._t) clearTimeout(hint._t);
      if (msg) hint._t = setTimeout(function () { hint.textContent = ''; }, 2600);
    };
    ctl.clearHint = function () { hint.textContent = ''; };
    ctl.box = box;

    play.addEventListener('click', function (e) {
      e.stopPropagation();
      if (box.classList.contains('is-loading')) return; // 避免重复提交
      if (active && active.btn === ctl) {
        if (box.classList.contains('is-playing')) TTS.pause();
        else TTS.resume();
        return;
      }
      TTS.speak(getText(), ctl);
    });

    stopBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (active && active.btn === ctl) TTS.stop();
    });

    setState('idle');
    return ctl;
  }

  /**
   * 在消息节点上挂朗读按钮（不可用时静默跳过）
   * @param {Element} host  挂载容器
   * @param {Function|string} text  文本或取文本的函数
   */
  TTS.mount = function (host, text) {
    if (!host) return null;
    if (TTS.available === null) {
      // 状态还没回来：先探测，可用再挂（不可用就永远不出现按钮）
      TTS.init().then(function (ok) {
        if (ok && host.parentNode) TTS.mount(host, text);
      });
      return null;
    }
    if (!TTS.available) return null;
    var get = typeof text === 'function' ? text : function () { return text; };
    if (!TTS.plain(get())) return null;
    return makeBtn(host, get);
  };
})();
