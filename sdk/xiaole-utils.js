/*!
 * 小了 SDK - 工具层
 * localStorage 封装 / 浏览器指纹 / 时间判断 / DOM 帮助 / 文字量统计
 */
(function () {
  'use strict';

  var NS = (window.Xiaole = window.Xiaole || {});

  var U = (NS.utils = {});

  /* ---------------- storage ---------------- */

  function key(name) {
    return (NS.config.storagePrefix || 'xiaole-') + name;
  }

  U.store = {
    get: function (name, fallback) {
      try {
        var raw = localStorage.getItem(key(name));
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set: function (name, value) {
      try {
        localStorage.setItem(key(name), JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove: function (name) {
      try {
        localStorage.removeItem(key(name));
      } catch (e) {}
    }
  };

  /* ---------------- 浏览器指纹 ---------------- */

  U.fingerprint = function () {
    var cached = U.store.get('fingerprint', null);
    if (cached) return cached;

    var parts = [
      navigator.userAgent || '',
      navigator.language || '',
      (screen.width || 0) + 'x' + (screen.height || 0),
      screen.colorDepth || '',
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || ''
    ].join('|');

    // 简易 32 位 hash
    var hash = 0x811c9dc5;
    for (var i = 0; i < parts.length; i++) {
      hash ^= parts.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    var fp = 'fp_' + hash.toString(36) + '_' + parts.length;

    U.store.set('fingerprint', fp);
    return fp;
  };

  /* ---------------- 日期 ---------------- */

  U.today = function () {
    var d = new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  };

  /* ---------------- 文本与上下文体积 ---------------- */

  // 统计消息数组的字符体积（用于 100K 上限判断）
  U.measure = function (messages) {
    try {
      return JSON.stringify(messages || []).length;
    } catch (e) {
      return 0;
    }
  };

  U.nowId = function () {
    return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  };

  /* ---------------- HTML ---------------- */

  U.escape = function (str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // 极简 markdown：加粗 / 行内代码 / 换行
  U.toHtml = function (text) {
    var html = U.escape(text);
    html = html.replace(/```([\s\S]*?)```/g, function (_, code) {
      return '<pre class="xl-code">' + code.replace(/\n/g, '<br>') + '</pre>';
    });
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`([^`]+)`/g, '<code class="xl-inline-code">$1</code>');
    html = html.replace(/\n/g, '<br>');
    return html;
  };

  /* ---------------- DOM ---------------- */

  U.el = function (tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  };

  U.ready = function (fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  };

  /* ---------------- 资源探测 ---------------- */

  U.probeImage = function (url) {
    return new Promise(function (resolve) {
      var img = new Image();
      var done = false;
      var timer = setTimeout(function () {
        if (!done) { done = true; resolve(false); }
      }, 12000);
      img.onload = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(img.naturalWidth > 0);
      };
      img.onerror = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(false);
      };
      // 加一次性参数，避免命中旧缓存导致素材已删除却仍判定存在
      img.src = url + (url.indexOf('?') > -1 ? '&' : '?') + '_probe=' + Date.now();
    });
  };

  /* ---------------- 音效（无外部音频文件时用 WebAudio 合成）---------------- */

  U.sound = {
    enabled: function () {
      var v = U.store.get('sound-enable', null);
      return v === null ? true : !!v;
    },
    toggle: function () {
      var next = !U.sound.enabled();
      U.store.set('sound-enable', next);
      return next;
    },
    play: function (type) {
      if (!U.sound.enabled()) return;
      try {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        if (!U.sound._ctx) U.sound._ctx = new Ctx();
        var ctx = U.sound._ctx;
        if (ctx.state === 'suspended') ctx.resume();

        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        var open = type === 'open';
        osc.type = 'sine';
        osc.frequency.setValueAtTime(open ? 660 : 520, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(open ? 880 : 380, ctx.currentTime + 0.18);

        var vol = 0.06;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);

        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } catch (e) {}
    }
  };

  /* ---------------- 事件 ---------------- */

  U.emit = function (name, detail) {
    try {
      window.dispatchEvent(new CustomEvent('xiaole:' + name, { detail: detail }));
    } catch (e) {}
  };
})();
