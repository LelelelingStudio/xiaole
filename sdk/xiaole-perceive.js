/*!
 * 小了 SDK - 页面感知与指引用
 *
 * 她只能"看"和"指"，绝不替用户点：所有标记都画在一层 pointer-events:none 的覆盖层上，
 * 不写宿主 DOM、不拦点击、不改样式。
 *
 * 隐私：默认 summary（只给后端元素序号/短标签/位置，正文不上送）；text 模式才带页面文字；
 * off 模式完全不感知。宿主可用 data-xiaole-perceive="summary|text|off" 覆盖。
 */
(function () {
  'use strict';

  var NS = window.Xiaole;
  if (!NS) return;

  var U = NS.utils;
  var C = NS.config;

  var layer = null;          // 覆盖层
  var lineBox = null;        // 虚线画布
  var targets = [];          // [{ id, el, ring, label }]
  var current = {};          // id -> element（当前这一轮索引）
  var rafPending = false;
  var bound = false;

  var EXCLUDE = '.xl-cloud, .xl-character, .xl-menu, .xl-say, .xl-history, .xl-point-layer, .xl-tip';

  function cfg() {
    return (C && C.perceive) || {};
  }

  function mode() {
    var m = cfg().mode || 'summary';
    return (m === 'text' || m === 'off') ? m : 'summary';
  }

  /* ================= 页面索引 ================= */

  function isHidden(el) {
    if (!el || !el.getBoundingClientRect) return true;
    var r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return true;
    var cs = window.getComputedStyle(el);
    return cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.05;
  }

  function labelOf(el) {
    var t = '';
    if (el.tagName === 'INPUT') {
      t = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.value || el.name || '';
      if (el.type === 'submit' || el.type === 'button') t = el.value || t;
    } else if (el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
      t = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || '';
    } else {
      t = el.innerText || el.textContent || '';
    }
    if (!t) t = el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('alt') || '';
    t = String(t).replace(/\s+/g, ' ').trim();
    var max = (cfg().labelChars || 24);
    return t.length > max ? t.slice(0, max) + '…' : t;
  }

  function typeOf(el) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'a') return 'link';
    if (tag === 'input') return 'input';
    if (tag === 'textarea') return 'textarea';
    if (tag === 'select') return 'select';
    if (tag === 'button' || el.getAttribute('role') === 'button') return 'button';
    return 'control';
  }

  function regionOf(r) {
    var vw = window.innerWidth, vh = window.innerHeight;
    var y = r.top + r.height / 2, x = r.left + r.width / 2;
    var v = y < 0 ? '需上滑' : (y > vh ? '需下滑' : '视口内');
    var row = y < vh * 0.34 ? '顶部' : (y < vh * 0.67 ? '中部' : '底部');
    var col = x < vw * 0.34 ? '左侧' : (x < vw * 0.67 ? '中间' : '右侧');
    return row + col + '·' + v;
  }

  /**
   * 采集当前页可交互元素。summary 只有序号/类型/短标签/位置；text 额外带页面文字。
   */
  function index() {
    if (mode() === 'off') return { items: [], text: '' };
    var max = cfg().maxElements || 60;
    var nodes = document.querySelectorAll('button, a, input, textarea, select, [role="button"], [tabindex]');
    var items = [];
    current = {};

    for (var i = 0; i < nodes.length && items.length < max; i++) {
      var el = nodes[i];
      if (el.closest(EXCLUDE)) continue;
      if (isHidden(el)) continue;
      var label = labelOf(el);
      if (!label && el.tagName !== 'INPUT') continue; // 没名字的链接/按钮没意义
      var id = 'e' + (items.length + 1);
      current[id] = el;
      items.push({
        id: id,
        type: typeOf(el),
        label: label || '（未命名输入框）',
        where: regionOf(el.getBoundingClientRect())
      });
    }

    return { items: items, text: mode() === 'text' ? pageText() : '' };
  }

  // 正文（text 模式）：跳过小了自己的界面
  function pageText() {
    var cap = cfg().maxChars || 4000;
    var out = [];
    var len = 0;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode;
        if (p && p.closest && p.closest(EXCLUDE)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = walker.nextNode())) {
      var t = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (!t) continue;
      out.push(t);
      len += t.length;
      if (len > cap) break;
    }
    return out.join(' ').slice(0, cap);
  }

  /* ================= 何时带上下文 ================= */

  var TRIGGER = /在哪|哪[里个儿边]|怎么(点|开|用|操作|进入|设置|下载|保存|找到|领|买)|按钮|入口|帮我(找|看|点)|这(一)?(页|屏)|页面(上|里|中)|如何(操作|使用|找到)|找不到|哪儿|怎么走|怎么填|点哪/;

  function shouldSend(question) {
    if (mode() === 'off') return false;
    return TRIGGER.test(String(question || ''));
  }

  /**
   * 生成给后端的上下文块（仅当本轮问题像是在问"页面上怎么弄"时）
   */
  NS.perceive = {
    mode: mode,
    index: index,

    context: function (question) {
      if (!shouldSend(question)) return '';
      var data = index();
      if (!data.items.length && !data.text) return '';

      var lines = [];
      lines.push('【当前页面】' + (document.title || '（无标题）') + ' ｜ ' + (location.pathname || '/'));
      lines.push('可交互元素（序号｜类型｜标签｜位置）：');
      for (var i = 0; i < data.items.length; i++) {
        var it = data.items[i];
        lines.push(it.id + '｜' + it.type + '｜' + it.label + '｜' + it.where);
      }
      if (data.text) lines.push('页面文字（截断）：' + data.text);
      lines.push('【指引用法】用户若在问"某个东西在哪、怎么操作、该点哪个"，请在回答开头用 [[point:e3]] 标出目标（可多个，最多 ' +
        (cfg().maxPoints || 3) + ' 个，按把握从大到小），标记本身用户看不见，不要解释它；只读看不懂就不要猜，改用一句反问确认是哪一个。');

      return lines.join('\n');
    },

    /**
     * 画高亮：ids 是后端回复里给出的元素序号
     */
    draw: function (ids) {
      this.clear();
      if (!cfg().pointer || cfg().pointer.enabled === false) return;
      if (!ids || !ids.length) return;

      var max = cfg().maxPoints || 3;
      for (var i = 0; i < ids.length && i < max; i++) {
        addTarget(ids[i]);
      }
      if (targets.length) {
        ensureBound();
        relayout();
      }
    },

    clear: function () {
      for (var i = 0; i < targets.length; i++) {
        if (targets[i].ring && targets[i].ring.parentNode) targets[i].ring.parentNode.removeChild(targets[i].ring);
        if (targets[i].label && targets[i].label.parentNode) targets[i].label.parentNode.removeChild(targets[i].label);
      }
      targets = [];
      if (lineBox && lineBox.parentNode) {
        while (lineBox.firstChild) lineBox.removeChild(lineBox.firstChild);
      }
    },

    /** 供调试/宿主用：当前索引里的元素数量 */
    count: function () {
      return Object.keys(current).length;
    }
  };

  /* ================= 覆盖层 ================= */

  function ensureLayer() {
    if (layer && layer.parentNode) return;
    layer = document.createElement('div');
    layer.className = 'xl-point-layer';
    layer.setAttribute('aria-hidden', 'true');
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'xl-point-lines');
    lineBox = svg;
    document.body.appendChild(layer);
    layer.appendChild(svg);
  }

  function charAnchor() {
    var ch = document.querySelector('.xl-character');
    var r = ch ? ch.getBoundingClientRect() : null;
    if (r && r.width > 0) {
      return { x: r.left + r.width / 2, y: r.top + r.height * 0.34 };
    }
    // 没角色（整页模式）时从小了的浮窗取
    var cloud = document.querySelector('.xl-cloud');
    var cr = cloud ? cloud.getBoundingClientRect() : null;
    if (cr && cr.width > 0) return { x: cr.left + cr.width / 2, y: cr.bottom };
    return { x: window.innerWidth / 2, y: window.innerHeight - 60 };
  }

  function addTarget(id) {
    var el = current[id];
    if (!el || !el.isConnected || isHidden(el)) return;

    // 目标没在视口里：温和地滚过去，而不是画个箭头让人自己找
    var r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) {
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { el.scrollIntoView(); }
    }

    ensureLayer();

    var ring = document.createElement('div');
    ring.className = 'xl-point-ring';
    layer.appendChild(ring);

    var label = document.createElement('div');
    label.className = 'xl-point-label';
    label.textContent = cfg().pointer.label || '就是这里';
    if (targets.length) label.style.display = 'none';
    layer.appendChild(label);

    targets.push({ id: id, el: el, ring: ring, label: label });

    // 点一下目标不会发生任何事，除非用户自己点：覆盖层不吃事件
    var once = function (e) {
      el.removeEventListener(e.type, once, true);
      relayout();
    };
    el.addEventListener('load', once, true);
  }

  function relayout() {
    if (!targets.length) return;
    var a = charAnchor();
    if (lineBox) {
      while (lineBox.firstChild) lineBox.removeChild(lineBox.firstChild);
    }

    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      if (!t.el.isConnected) {
        t.ring.style.display = 'none';
        t.label.style.display = 'none';
        continue;
      }
      var r = t.el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) {
        t.ring.style.display = 'none';
        t.label.style.display = 'none';
        continue;
      }
      var pad = 4;
      t.ring.style.display = '';
      t.ring.style.left = (r.left - pad) + 'px';
      t.ring.style.top = (r.top - pad) + 'px';
      t.ring.style.width = (r.width + pad * 2) + 'px';
      t.ring.style.height = (r.height + pad * 2) + 'px';

      var lx = Math.min(Math.max(r.left, 8), window.innerWidth - 90);
      var ly = r.bottom + 8;
      if (ly > window.innerHeight - 24) ly = Math.max(8, r.top - 26);
      // 只给第一个目标挂"就是这里"，多个目标时别的只画光圈，避免标签打架
      if (i === 0) {
        t.label.style.display = '';
        t.label.style.left = lx + 'px';
        t.label.style.top = ly + 'px';
      } else {
        t.label.style.display = 'none';
      }

      if (lineBox) drawLine(a, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }
  }

  function drawLine(from, to) {
    if (!lineBox) return;
    var dx = to.x - from.x, dy = to.y - from.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 40) return;
    // 从角色往目标走 72%，留一段空白，别糊在元素上
    var ex = from.x + dx * 0.72, ey = from.y + dy * 0.72;
    var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', from.x);
    line.setAttribute('y1', from.y);
    line.setAttribute('x2', ex);
    line.setAttribute('y2', ey);
    line.setAttribute('class', 'xl-point-line');
    lineBox.appendChild(line);
  }

  function schedule() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      rafPending = false;
      relayout();
    });
  }

  function ensureBound() {
    if (bound) return;
    bound = true;
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
  }
})();
