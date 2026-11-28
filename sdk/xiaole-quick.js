/*!
 * 小了 SDK - 划词提问 & 快捷指令
 *
 * 1) 划词提问：宿主页面选中一段文字 → 旁边出现「问小了」小按钮 →
 *    点开聊天并把这句带进去（只读页面文字，不改宿主内容）。
 * 2) 快捷指令：输入框里以 / 开头的一行命令，发送前转成正常请求：
 *    /总结 内容    整理要点
 *    /翻译 英 内容  翻译成英文（也可 /翻译 中 …）
 *    /画图 提示词   直接触发生图
 *    /帮助          列出这些
 */
(function () {
  'use strict';

  var NS = window.Xiaole;
  if (!NS) return;

  var C = NS.config;

  function cfg() { return C.quick || {}; }

  /* ================= 快捷指令 ================= */

  var Commands = NS.commands = {};

  Commands.list = [
    { cmd: '/总结', desc: '把随后的内容整理成要点' },
    { cmd: '/翻译', desc: '翻译成英文（/翻译 中 … 译成中文）' },
    { cmd: '/画图', desc: '按提示词直接生成一张图' },
    { cmd: '/帮助', desc: '看这些指令' }
  ];

  // 自定义指令：存在本地，/命令 名 → 一段提示词
  var CUSTOM_KEY = 'custom-commands';
  Commands.custom = function () {
    var list = (NS.utils && NS.utils.store ? NS.utils.store.get(CUSTOM_KEY, []) : []);
    return Array.isArray(list) ? list : [];
  };
  Commands.setCustom = function (list) {
    var clean = (list || []).filter(function (x) { return x && x.name && x.prompt; }).slice(0, 30);
    if (NS.utils && NS.utils.store) NS.utils.store.set(CUSTOM_KEY, clean);
    return clean;
  };

  Commands.help = function () {
    var lines = Commands.list.map(function (c) { return c.cmd + '　' + c.desc; });
    var mine = Commands.custom();
    if (mine.length) {
      lines.push('');
      lines.push('你自定义的：');
      mine.forEach(function (c) { lines.push('/' + c.name + '　' + c.prompt); });
    }
    return '可以这样用：\n' + lines.join('\n');
  };

  /** 返回 { kind:'text'|'image'|'help', text }；不是命令就原样返回 text */
  Commands.parse = function (raw) {
    // 兼容全角斜杠、全角空格、行首空白
    var text = String(raw || '')
      .replace(/^[\s\u3000]+/, '')
      .replace(/^／/, '/')
      .replace(/\u3000/g, ' ')
      .trim();
    if (text.charAt(0) !== '/') return { kind: 'text', text: text };

    var m = text.match(/^\/([^\s/]+)\s*([\s\S]*)$/);
    if (!m) return { kind: 'text', text: text };
    var name = m[1].toLowerCase();
    var body = (m[2] || '').trim();

    if (name === '帮助' || name === 'help') return { kind: 'help' };

    if (name === '画图' || name === 'img' || name === 'image') {
      if (!body) return { kind: 'help' };
      return { kind: 'image', prompt: body };
    }

    if (name === '总结' || name === 'summary' || name === 'sum') {
      if (!body) return { kind: 'help' };
      return {
        kind: 'text',
        text: '把下面这段内容整理成要点：先一句话结论，再用短条目列出关键信息，不要编造，不要重复原文。\n\n' + body
      };
    }

    if (name === '翻译' || name === 'trans') {
      var lang = '英文';
      var lm = body.match(/^(英|英文|英语|中|中文)\s*[:：]?\s*/);
      if (lm) {
        lang = (lm[1] === '中' || lm[1] === '中文') ? '中文' : '英文';
        body = body.slice(lm[0].length).trim();
      }
      if (!body) return { kind: 'help' };
      return { kind: 'text', text: '翻译成' + lang + '。只给译文，术语和专有名词不要改写：\n\n' + body };
    }

    // 自定义指令：/名字 内容 → 提示词模板，{内容} 或直接拼在末尾
    var mine = Commands.custom();
    for (var i = 0; i < mine.length; i++) {
      if (mine[i].name.toLowerCase() === name) {
        var tpl = mine[i].prompt;
        if (tpl.indexOf('{内容}') > -1) return { kind: 'text', text: tpl.replace(/\{内容\}/g, body) };
        return { kind: 'text', text: tpl + (body ? '\n\n' + body : '') };
      }
    }

    return { kind: 'text', text: text };
  };

  /* ================= 划词提问 ================= */

  var pill = null;
  var lastText = '';

  function inXiaole(node) {
    while (node) {
      if (node.classList && (node.classList.contains('xl-root') || node.classList.contains('xlp-root') ||
        node.classList.contains('xl-mem-mask') || node.classList.contains('xl-sel-pill'))) return true;
      if (node.id && (node.id === 'xl-mem-panel' || node.id === 'xl-sel-pill')) return true;
      node = node.parentNode;
    }
    return false;
  }

  function selectedInfo(win, offsetX, offsetY) {
    win = win || window;
    var sel = win.getSelection && win.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    var text = String(sel.toString() || '').replace(/\s+/g, ' ').trim();
    var max = cfg().maxChars || 300;
    if (text.length < 2 || text.length > max) return null;
    if (inXiaole(sel.anchorNode)) return null;
    var range = sel.getRangeAt(0);
    var rect = range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return null;
    return {
      text: text,
      rect: {
        left: rect.left + (offsetX || 0),
        top: rect.top + (offsetY || 0),
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom + (offsetY || 0)
      }
    };
  }

  function hidePill() {
    if (pill && pill.parentNode) pill.parentNode.removeChild(pill);
    pill = null;
  }

  function showPill(info) {
    hidePill();
    lastText = info.text;

    pill = document.createElement('button');
    pill.id = 'xl-sel-pill';
    pill.className = 'xl-sel-pill';
    pill.type = 'button';
    pill.innerHTML = '<span class="xl-sel-dot"></span>问小了';
    document.body.appendChild(pill);

    var w = 96, h = 34;
    var left = Math.min(window.innerWidth - w - 8, Math.max(8, info.rect.left + info.rect.width / 2 - w / 2));
    var top = info.rect.top - h - 10;
    if (top < 8) top = info.rect.bottom + 10;
    pill.style.left = Math.round(left) + 'px';
    pill.style.top = Math.round(top) + 'px';

    pill.addEventListener('mousedown', function (e) { e.preventDefault(); });
    pill.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var t = lastText;
      hidePill();
      if (NS.askWith) NS.askWith(t);
      else if (NS.page && NS.page.prefill) NS.page.prefill(t);
      else if (NS.ui && NS.ui.prefill) NS.ui.prefill(t);
    });
  }

  function onMouseUp() {
    if (cfg().enabled === false) return;
    // 等浏览器把选区定下来
    setTimeout(function () {
      var info = selectedInfo();
      if (info) showPill(info);
      else hidePill();
    }, 0);
  }

  function onTouchEnd() {
    if (cfg().enabled === false) return;
    // 触屏长按选中：touchend 之后选区才稳定，稍等再取
    setTimeout(function () {
      var info = selectedInfo();
      if (info) showPill(info);
    }, 260);
  }

  // 同源 iframe：把监听挂进去，选区坐标加上 iframe 在页面里的偏移
  function bindFrame(frame) {
    try {
      var doc = frame.contentDocument;
      if (!doc || frame.dataset.xlSelBound) return;
      frame.dataset.xlSelBound = '1';
      function offset() {
        var r = frame.getBoundingClientRect();
        return { x: r.left, y: r.top };
      }
      function take() {
        var o = offset();
        var info = selectedInfo(frame.contentWindow, o.x, o.y);
        if (info) showPill(info);
        else hidePill();
      }
      doc.addEventListener('mouseup', function () { setTimeout(take, 0); }, true);
      doc.addEventListener('touchend', function () { setTimeout(take, 260); }, true);
      doc.addEventListener('scroll', hidePill, true);
    } catch (e) {
      // 跨域 iframe 拿不到，正常现象
    }
  }

  function scanFrames() {
    var frames = document.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) bindFrame(frames[i]);
    frames = document.querySelectorAll('iframe');
    for (var j = 0; j < frames.length; j++) {
      try {
        if (frames[j].contentDocument) {
          frames[j].contentDocument.addEventListener('mouseup', function (ev) {
            var f = ev.currentTarget.defaultView && ev.currentTarget.defaultView.frameElement;
            if (f) bindFrame(f);
          }, true);
        }
      } catch (e) {}
    }
  }

  function bind() {
    document.addEventListener('mouseup', onMouseUp, true);
    document.addEventListener('touchend', onTouchEnd, true);
    scanFrames();
    var tries = 0;
    var timer = setInterval(function () {
      scanFrames();
      if (++tries > 10) clearInterval(timer);
    }, 1500);
    document.addEventListener('keyup', function (e) {
      if (e.key === 'Escape') hidePill();
    }, true);
    document.addEventListener('scroll', hidePill, true);
    window.addEventListener('resize', hidePill);
  }

  var Quick = NS.quick = {
    commands: Commands,
    hide: hidePill,
    enabled: function () { return cfg().enabled !== false; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
