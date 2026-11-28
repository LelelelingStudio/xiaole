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

  /* ---------------- 图片（用于截图提问） ---------------- */

  /**
   * 把用户选的图片压成 dataURL：长边最多 maxSide，JPEG 82%
   * 微信/QQ 截图动辄 2MB，不压会撑爆请求
   */
  U.imageToDataUrl = function (file, maxSide) {
    maxSide = maxSide || 1024;
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type || '')) {
        reject(new Error('不是图片'));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('读取失败')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('解码失败')); };
        img.onload = function () {
          var w = img.width, h = img.height;
          var scale = Math.min(1, maxSide / Math.max(w, h));
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          try {
            resolve(canvas.toDataURL('image/jpeg', 0.82));
          } catch (e) { reject(e); }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  };

  // 输出侧兜底：把内部实现细节（模块名、配置键、脚本名）从回答里抹掉
  U.scrub = function (text) {
    return String(text || '')
      .replace(/xiaole[-a-z]*\.js/gi, '（内部实现）')
      .replace(/\bMODULES\b/g, '（内部实现）')
      .replace(/basePrompt/g, '（内部设定）')
      .replace(/localStorage\.(get|set)Item[^\n]*/gi, '（本地存储）')
      .replace(/data-xiaole[^\s>]*/gi, '（接入属性）');
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

  // ===== Markdown 渲染（标题/列表/代码块/引用/表格/链接/加粗斜体）=====

  function safeUrl(url) {
    var u = String(url || '').trim();
    if (!u) return '';
    if (/^(https?:)?\/\//i.test(u) || /^(mailto:|tel:)/i.test(u)) return u;
    if (/^\/[^/]/.test(u) || /^#/.test(u)) return u;
    if (/^(javascript|data|vbscript|file|blob):/i.test(u)) return '';
    return '';
  }

  var FILE_RE = /\.(pdf|zip|rar|7z|doc|docx|xls|xlsx|ppt|pptx|csv|txt|md|json|apk|dmg|exe|mp3|mp4|wav|png|jpg|jpeg|webp|gif|svg|otf|ttf|epub)\b/i;

  function linkHtml(text, url) {
    var u = safeUrl(url);
    if (!u) return U.escape(text);
    var isFile = FILE_RE.test(u);
    return '<a class="xl-link' + (isFile ? ' xl-file' : '') + '" href="' + U.escape(u) + '"' +
      (isFile ? ' download' : '') + ' target="_blank" rel="noopener noreferrer">' +
      U.escape(text) + (isFile ? '<span class="xl-file-tag">下载</span>' : '') + '</a>';
  }

  function inline(text) {
    var codes = [];
    var html = U.escape(text)
      .replace(/`([^`]+)`/g, function (_, code) {
        codes.push(code);
        return '\u0000C' + (codes.length - 1) + '\u0000';
      })
      // [[文字|链接]] 简写
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, function (_, t, u) { return linkHtml(t, u); })
      // [文字](链接)
      .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, function (_, t, u) { return linkHtml(t, u); });

    html = html
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      .replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>');

    html = html.replace(/\u0000C(\d+)\u0000/g, function (_, i) {
      return '<code class="xl-inline-code">' + codes[+i] + '</code>';
    });
    return html;
  }

  function splitRow(line) {
    var body = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    return body.split('|').map(function (c) { return c.trim(); });
  }

  function toHtml(text) {
    var src = String(text == null ? '' : text).replace(/\r\n/g, '\n');
    var out = [];
    var lines = src.split('\n');
    var i = 0;
    var listStack = [];

    function closeLists() {
      while (listStack.length) out.push('</' + listStack.pop() + '>');
    }

    while (i < lines.length) {
      var line = lines[i];

      // 代码块
      var fence = line.match(/^```(\w*)\s*$/);
      if (fence) {
        closeLists();
        var lang = fence[1] || 'code';
        i++;
        var buf = [];
        while (i < lines.length && !/^```\s*$/.test(lines[i])) {
          buf.push(lines[i]);
          i++;
        }
        i++;
        var code = U.escape(buf.join('\n'));
        out.push(
          '<div class="xl-code-block"><div class="xl-code-head"><span class="xl-code-lang">' + lang +
          '</span><span class="xl-code-acts"><button class="xl-copy" data-copy="1">复制</button>' +
          '<button class="xl-save-code" data-save="1">下载</button></span></div>' +
          '<pre class="xl-code"><code>' + code + '</code></pre></div>'
        );
        continue;
      }

      // 空行
      if (!line.trim()) {
        closeLists();
        i++;
        continue;
      }

      // 标题
      var h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        closeLists();
        var lv = h[1].length;
        out.push('<h' + (lv + 2) + ' class="xl-h">' + inline(h[2]) + '</h' + (lv + 2) + '>');
        i++;
        continue;
      }

      // 分隔线
      if (/^(---|\\*\\*\\*)\\s*$/.test(line)) {
        closeLists();
        out.push('<hr class="xl-hr" />');
        i++;
        continue;
      }

      // 引用
      if (/^>\s?/.test(line)) {
        closeLists();
        var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          q.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        out.push('<blockquote class="xl-quote">' + inline(q.join('\n')).replace(/\n/g, '<br>') + '</blockquote>');
        continue;
      }

      // 表格：| a | b |  +  | --- | --- |
      if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s\-:|]+\|\s*$/.test(lines[i + 1])) {
        closeLists();
        var head = splitRow(line);
        var rows = [];
        i += 2;
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
          rows.push(splitRow(lines[i]));
          i++;
        }
        var thead = '<tr>' + head.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr>';
        var tbody = rows.map(function (r) {
          return '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>';
        }).join('');
        out.push(
          '<div class="xl-table-wrap"><table class="xl-table"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>' +
          '<button class="xl-save-table" data-save="1">表格存为 CSV</button></div>'
        );
        continue;
      }

      // 无序列表
      var ul = line.match(/^[\-\*\+]\s+(.*)$/);
      if (ul) {
        if (listStack[listStack.length - 1] !== 'ul') {
          closeLists();
          out.push('<ul class="xl-ul">');
          listStack.push('ul');
        }
        out.push('<li>' + inline(ul[1]) + '</li>');
        i++;
        continue;
      }

      // 有序列表
      var ol = line.match(/^\d+\.\s+(.*)$/);
      if (ol) {
        if (listStack[listStack.length - 1] !== 'ol') {
          closeLists();
          out.push('<ol class="xl-ol">');
          listStack.push('ol');
        }
        out.push('<li>' + inline(ol[1]) + '</li>');
        i++;
        continue;
      }

      // 普通段落（连续行合并，行内换行保留）
      closeLists();
      var para = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^```/.test(lines[i]) &&
        !/^(#{1,4})\s+/.test(lines[i]) &&
        !/^[\-\*\+]\s+/.test(lines[i]) &&
        !/^\d+\.\s+/.test(lines[i]) &&
        !/^>\s?/.test(lines[i]) &&
        !/^\s*\|.*\|\s*$/.test(lines[i])
      ) {
        para.push(lines[i]);
        i++;
      }
      if (!para.length) { para.push(lines[i]); i++; } // 兜底：任何没被识别的行都要吃掉，避免死循环
      out.push('<p class="xl-p">' + inline(para.join('\n')).replace(/\n/g, '<br>') + '</p>');
    }

    closeLists();
    return out.join('');
  }

  U.toHtml = toHtml;

  /** 跨域链接直接下载：fetch → blob → a[download]，失败就新窗口打开 */
  var CODE_EXT = {
    python: 'py', py: 'py', javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts', tsx: 'tsx', jsx: 'jsx',
    json: 'json', html: 'html', css: 'css', scss: 'scss', sql: 'sql', bash: 'sh', sh: 'sh', shell: 'sh',
    java: 'java', c: 'c', cpp: 'cpp', 'c++': 'cpp', go: 'go', rust: 'rs', ruby: 'rb', php: 'php',
    swift: 'swift', kotlin: 'kt', yaml: 'yml', yml: 'yml', markdown: 'md', md: 'md', text: 'txt', txt: 'txt'
  };

  U.downloadText = function (text, filename, mime) {
    try {
      var blob = new Blob([String(text || '')], { type: (mime || 'text/plain') + ';charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename || 'xiaole.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
      return true;
    } catch (err) {
      return false;
    }
  };

  U.codeFilename = function (lang) {
    var ext = CODE_EXT[String(lang || '').toLowerCase()] || 'txt';
    return 'xiaole-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.' + ext;
  };

  U.tableToCsv = function (table) {
    if (!table) return '';
    function esc(v) {
      var t = (v || '').replace(/\s+/g, ' ').trim();
      return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    }
    var rows = [];
    Array.prototype.forEach.call(table.rows, function (row) {
      var cells = [];
      Array.prototype.forEach.call(row.cells, function (c) { cells.push(esc(c.textContent)); });
      rows.push(cells.join(','));
    });
    return '\ufeff' + rows.join('\n');
  };

  U.downloadUrl = function (url, filename) {
    var name = filename || (String(url).split('/').pop() || 'download').split('?')[0];
    function fallback() {
      try { window.open(url, '_blank', 'noopener'); } catch (e) {}
    }
    if (!/^https?:/i.test(url)) { fallback(); return; }
    fetch(url, { mode: 'cors' })
      .then(function (res) {
        if (!res.ok) throw new Error('http ' + res.status);
        return res.blob();
      })
      .then(function (blob) {
        var obj = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = obj;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          if (a.parentNode) a.parentNode.removeChild(a);
          URL.revokeObjectURL(obj);
        }, 4000);
      })
      .catch(fallback);
  };

  /** 取出正文里的 [[draw:描述]] 生图指令，并从展示文本中移除 */
  // 抽出[[kb:timepin]]知识库申请标记（用户看不见），返回干净文本 + 产品id列表
  U.extractKb = function (text) {
    var ids = [];
    var clean = String(text || '').replace(/\[\[kb[:：]\s*([a-z0-9_-]{2,20})\s*\]\]/gi, function (_, id) {
      var v = id.toLowerCase();
      if (ids.indexOf(v) < 0) ids.push(v);
      return '';
    }).replace(/\[\[kb[:：]?[^\]]*$/gi, '').replace(/\n{3,}/g, '\n\n').trim();
    return { text: clean, ids: ids };
  };

  // 抽出[[point:e3]]指引标记（用户看不见），返回干净文本 + 元素序号列表
  U.extractPoint = function (text) {
    var ids = [];
    var clean = String(text || '').replace(/\[\[point[:：]\s*([eE]\d{1,3})\s*\]\]/g, function (_, id) {
      var v = id.toLowerCase();
      if (ids.indexOf(v) < 0) ids.push(v);
      return '';
    }).replace(/\[\[point[:：]?[^\]]*$/gi, '').replace(/\n{3,}/g, '\n\n').trim();
    return { text: clean, ids: ids };
  };

  U.extractDraw = function (text) {
    var prompts = [];
    var clean = String(text || '').replace(/\[\[draw[:：]([^\]]{1,1200})\]\]/gi, function (_, p) {
      prompts.push(p.trim());
      return '';
    }).replace(/\n{3,}/g, '\n\n').trim();
    return { text: clean, prompts: prompts };
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

  /* ---------------- 基础工具 ---------------- */

  U.hash = function (str) {
    var h = 0x811c9dc5;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h.toString(36);
  };

  U.uid = function (prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  };

  U.timeText = function (ts) {
    var d = new Date(ts || Date.now());
    var now = new Date();
    var sameDay = d.toDateString() === now.toDateString();
    var hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    if (sameDay) return hm;
    if (d.getFullYear() === now.getFullYear()) return (d.getMonth() + 1) + '月' + d.getDate() + '日';
    return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
  };

  /* ---------------- 多对话存储（localStorage） ---------------- */

  var CONV_KEY = 'conversations-v1';

  U.convs = {
    _read: function () {
      var d = U.store.get(CONV_KEY, null);
      if (!d || !Array.isArray(d.list)) d = { currentId: null, list: [] };
      return d;
    },
    _write: function (d) {
      d.list = (d.list || []).slice(0, (NS.config.conv || {}).maxCount || 50);
      // 本地存储写满时逐条丢弃最旧的对话，至少保证当前这句话能存下去
      for (var tries = 0; tries < 12; tries++) {
        if (U.store.set(CONV_KEY, d)) return true;
        var cur = U.convs.currentId();
        if (d.list.length <= 1) break;
        var cut = -1;
        for (var i = d.list.length - 1; i >= 0; i--) {
          if (d.list[i].id !== cur) { cut = i; break; }
        }
        if (cut < 0) break;
        d.list.splice(cut, 1);
        if (!U.store.get('quota-notified', false)) {
          U.store.set('quota-notified', true);
          try { U.emit('quota', {}); } catch (e) {}
        }
      }
      return false;
    },
    all: function () {
      return U.convs._read().list;
    },
    currentId: function () {
      return U.convs._read().currentId;
    },
    current: function () {
      var d = U.convs._read();
      for (var i = 0; i < d.list.length; i++) {
        if (d.list[i].id === d.currentId) return d.list[i];
      }
      return d.list[0] || null;
    },
    get: function (id) {
      var list = U.convs.all();
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },
    create: function (title, silent) {
      var d = U.convs._read();
      var conv = {
        id: U.uid('conv'),
        title: title || '新对话',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      d.list.unshift(conv);
      if (d.list.length > ((NS.config.conv || {}).maxCount || 50)) {
        d.list = d.list.slice(0, (NS.config.conv || {}).maxCount || 50);
      }
      d.currentId = conv.id;
      U.convs._write(d);
      if (!silent) U.emit('conv', { action: 'create', id: conv.id });
      return conv;
    },
    switchTo: function (id) {
      var d = U.convs._read();
      for (var i = 0; i < d.list.length; i++) {
        if (d.list[i].id === id) {
          d.currentId = id;
          U.convs._write(d);
          U.emit('conv', { action: 'switch', id: id });
          return d.list[i];
        }
      }
      return null;
    },
    remove: function (id) {
      var d = U.convs._read();
      var idx = -1;
      for (var i = 0; i < d.list.length; i++) if (d.list[i].id === id) idx = i;
      if (idx === -1) return null;
      d.list.splice(idx, 1);
      if (d.currentId === id) d.currentId = d.list[0] ? d.list[0].id : null;
      U.convs._write(d);
      U.emit('conv', { action: 'remove', id: id });
      return d.currentId;
    },
    append: function (msg, convId) {
      var d = U.convs._read();
      var targetId = convId || d.currentId;
      var conv = null;
      for (var i = 0; i < d.list.length; i++) if (d.list[i].id === targetId) conv = d.list[i];
      if (!conv) {
        conv = { id: U.uid('conv'), title: '新对话', messages: [], createdAt: Date.now() };
        d.list.unshift(conv);
        if (!convId) d.currentId = conv.id;
      }
      conv.messages.push(msg);
      var max = (NS.config.conv || {}).maxMessages || 400;
      if (conv.messages.length > max) conv.messages = conv.messages.slice(-max);
      conv.updatedAt = Date.now();
      // 标题交给 AI 在第一次问答结束后总结（这里只打标记，不再截取用户首句）
      if (msg.role === 'user' && !conv.autoTitled) conv.needTitle = true;
      U.convs._write(d);
      U.emit('conv', { action: 'update', id: conv.id });
      return conv;
    },
    /** 重命名对话（AI 总结或用户手改都走这里） */
    rename: function (id, title) {
      var d = U.convs._read();
      title = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 24) || '新对话';
      for (var i = 0; i < d.list.length; i++) {
        if (d.list[i].id === id) {
          d.list[i].title = title;
          d.list[i].autoTitled = true;
          d.list[i].needTitle = false;
          d.list[i].updatedAt = Date.now();
          U.convs._write(d);
          U.emit('conv', { action: 'rename', id: id, title: title });
          return true;
        }
      }
      return false;
    },
    patchLast: function (msgIndex, patch) {
      var d = U.convs._read();
      for (var i = 0; i < d.list.length; i++) {
        if (d.list[i].id === d.currentId) {
          var msgs = d.list[i].messages;
          if (msgs[msgIndex]) {
            for (var k in patch) if (patch.hasOwnProperty(k)) msgs[msgIndex][k] = patch[k];
            d.list[i].updatedAt = Date.now();
            U.convs._write(d);
          }
          return;
        }
      }
    },
    /** 旧版单会话历史迁移成多对话 */
    migrate: function (oldKey, title) {
      if (U.convs.all().length) return false;
      var saved = U.store.get(oldKey, null);
      if (!saved || !Array.isArray(saved.messages) || !saved.messages.length) return false;
      var conv = U.convs.create(title || '历史对话', true);
      saved.messages.forEach(function (m) {
        if (!m || !m.content || m.role === 'system') return;
        conv.messages.push({ role: m.role, content: m.content, type: 'text' });
      });
      var d = U.convs._read();
      for (var i = 0; i < d.list.length; i++) if (d.list[i].id === conv.id) d.list[i].messages = conv.messages;
      d.currentId = conv.id;
      U.convs._write(d);
      U.store.remove(oldKey);
      return true;
    }
  };

  /* ---------------- 图片缓存（IndexedDB，默认 7 天） ---------------- */

  var IDB_NAME = 'xiaole-images';
  var IDB_STORE = 'imgs';

  function withDB(fn) {
    return new Promise(function (resolve, reject) {
      if (typeof indexedDB === 'undefined') return reject(new Error('no indexeddb'));
      if (U.imgStore._db) return resolve(U.imgStore._db);
      var req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = function () {
        U.imgStore._db = req.result;
        resolve(req.result);
      };
      req.onerror = function () { reject(req.error || new Error('idb open failed')); };
    }).then(function (db) { return fn(db); });
  }

  U.imgStore = {
    _db: null,

    put: function (id, blob) {
      var days = (NS.config.image || {}).cacheDays || 7;
      var rec = { id: id, blob: blob, expire: Date.now() + days * 86400000, size: blob ? blob.size : 0 };
      return withDB(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).put(rec);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { reject(tx.error || new Error('idb put failed')); };
        });
      }).catch(function () { return false; });
    },

    get: function (id) {
      return withDB(function (db) {
        return new Promise(function (resolve) {
          var tx = db.transaction(IDB_STORE, 'readonly');
          var req = tx.objectStore(IDB_STORE).get(id);
          req.onsuccess = function () {
            var rec = req.result;
            if (!rec) return resolve(null);
            if (rec.expire && rec.expire < Date.now()) return resolve(null);
            resolve(rec.blob || null);
          };
          req.onerror = function () { resolve(null); };
        });
      }).catch(function () { return null; });
    },

    // 清掉过期记录，避免无上限占空间
    gc: function () {
      return withDB(function (db) {
        return new Promise(function (resolve) {
          var tx = db.transaction(IDB_STORE, 'readwrite');
          var store = tx.objectStore(IDB_STORE);
          var req = store.openCursor();
          var removed = 0;
          req.onsuccess = function () {
            var cursor = req.result;
            if (!cursor) return;
            var rec = cursor.value;
            if (!rec || (rec.expire && rec.expire < Date.now())) {
              cursor.delete();
              removed++;
            }
            cursor.continue();
          };
          tx.oncomplete = function () { resolve(removed); };
          tx.onerror = function () { resolve(0); };
        });
      }).catch(function () { return 0; });
    }
  };

  /* ---------------- 事件 ---------------- */

  U.emit = function (name, detail) {
    try {
      window.dispatchEvent(new CustomEvent('xiaole:' + name, { detail: detail }));
    } catch (e) {}
  };
})();
