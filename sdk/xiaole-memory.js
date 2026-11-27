/*!
 * 小了 SDK - 本地记忆
 *
 * 只存这台浏览器的 localStorage，不上传、不写 cookie。
 * 模型用 [[mem:内容]] 申请记住一件事 → 前端存下并给个轻提示。
 * 用户可以在「记忆」面板里逐条删除或全部清空。
 */
(function () {
  'use strict';

  var NS = window.Xiaole;
  if (!NS) return;

  var U = NS.utils;
  var C = NS.config;

  var KEY = 'lelele-xiaole-memory';
  var MAX = 20;
  var MAX_CHARS = 80;

  function cfg() { return (C && C.memory) || {}; }

  function enabled() { return cfg().enabled !== false; }

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (e) { return []; }
  }

  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch (e) {}
  }

  var Memory = NS.memory = {};

  Memory.enabled = enabled;

  Memory.list = function () { return load(); };

  Memory.add = function (text) {
    if (!enabled()) return false;
    text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
    if (!text) return false;
    var list = load();
    // 去重：包含关系视为同一条
    for (var i = 0; i < list.length; i++) {
      var old = String(list[i].text || '');
      if (old === text || old.indexOf(text) >= 0 || text.indexOf(old) >= 0) {
        list[i].text = text.length > old.length ? text : old;
        list[i].ts = Date.now();
        save(list);
        return 'same';
      }
    }
    list.unshift({ id: 'm' + Date.now().toString(36), text: text, ts: Date.now() });
    save(list);
    return 'new';
  };

  Memory.remove = function (id) {
    var list = load().filter(function (m) { return m.id !== id; });
    save(list);
    return list;
  };

  Memory.clear = function () {
    save([]);
    return [];
  };

  /** 拼进 system 的文本块，最多 10 条、总长 400 字 */
  Memory.prompt = function () {
    if (!enabled()) return '';
    var list = load().slice(0, 10);
    if (!list.length) return '';
    var lines = list.map(function (m) { return '· ' + m.text; });
    var body = lines.join('\n');
    if (body.length > 400) body = body.slice(0, 400) + '…';
    return '【你记住的事（本地，用户可查看和删除）】\n' + body +
      '\n这些是用户本人的偏好或事实，回答时自然用上，不要主动罗列，也不要编造新的一条。';
  };

  /** 从回复里剥出 [[mem:...]] 并写入 */
  Memory.parse = function (text) {
    var saved = [];
    var clean = String(text || '').replace(/\[\[mem[:：]\s*([^\]\n]{1,80})\s*\]\]/gi, function (_, m) {
      if (enabled() && Memory.add(m)) saved.push(m.trim());
      return '';
    }).replace(/\[\[mem[:：]?[^\]]*$/i, '').replace(/\n{3,}/g, '\n\n').trim();
    return { text: clean, saved: saved };
  };

  Memory.indexUsed = function () {};

  /* ================= 面板 ================= */

  Memory.panel = function () {
    var old = document.getElementById('xl-mem-panel');
    if (old) { old.parentNode.removeChild(old); return; }

    var mask = U.el('div', 'xl-mem-mask');
    mask.id = 'xl-mem-panel';
    var box = U.el('div', 'xl-mem-box');

    function render() {
      var list = load();
      box.innerHTML =
        '<div class="xl-mem-head">她记住的事<span class="xl-mem-close">×</span></div>' +
        '<div class="xl-mem-sub">全部只存这台浏览器的本地存储，不上传。更换浏览器、清理站点数据或换设备后，这些记忆会一起丢失。</div>' +
        '<div class="xl-mem-list">' + (list.length
          ? list.map(function (m) {
            return '<div class="xl-mem-item" data-id="' + m.id + '">' +
              '<span>' + U.escape(m.text) + '</span>' +
              '<b class="xl-mem-del" title="删除">×</b></div>';
          }).join('')
          : '<div class="xl-mem-empty">还没有记住什么。聊的时候可以让她记住你的习惯。</div>') +
        '</div>' +
        (list.length ? '<div class="xl-mem-foot"><button class="xl-mem-clear">全部清空</button></div>' : '');
    }

    render();
    mask.appendChild(box);
    document.body.appendChild(mask);

    mask.addEventListener('click', function (e) {
      if (e.target === mask || (e.target.className || '').indexOf('xl-mem-close') >= 0) {
        mask.parentNode.removeChild(mask);
        return;
      }
      var del = e.target.closest && e.target.closest('.xl-mem-del');
      if (del) {
        var item = del.closest('.xl-mem-item');
        Memory.remove(item.getAttribute('data-id'));
        render();
        return;
      }
      if (e.target.closest && e.target.closest('.xl-mem-clear')) {
        Memory.clear();
        render();
      }
    });

    return mask;
  };
})();
