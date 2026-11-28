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

  function bytes(n) {
    if (!n && n !== 0) return '';
    var u = ['B', 'KB', 'MB', 'GB'];
    var i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (Math.round(n * 10) / 10) + ' ' + u[i];
  }

  function storageInfo() {
    var box = { support: false, persisted: false, quota: 0, usage: 0 };
    if (!navigator.storage) return Promise.resolve(box);
    box.support = true;
    var p1 = navigator.storage.persisted ? navigator.storage.persisted().then(function (v) { box.persisted = !!v; }) : Promise.resolve();
    var p2 = navigator.storage.estimate ? navigator.storage.estimate().then(function (e) {
      box.quota = (e && e.quota) || 0;
      box.usage = (e && e.usage) || 0;
    }) : Promise.resolve();
    return Promise.all([p1, p2]).then(function () { return box; });
  }

  Memory.requestPersist = function () {
    if (!navigator.storage || !navigator.storage.persist) return Promise.resolve(false);
    return navigator.storage.persist().then(function (ok) {
      U.emit('storage', { persisted: !!ok });
      return !!ok;
    });
  };

  Memory.panel = function () {
    var old = document.getElementById('xl-mem-panel');
    if (old) { old.parentNode.removeChild(old); return; }

    var mask = U.el('div', 'xl-mem-mask');
    mask.id = 'xl-mem-panel';
    var box = U.el('div', 'xl-mem-box');

    function render() {
      var list = load();
      var allowed = (NS.tools && NS.tools.alwaysAllowed) ? NS.tools.alwaysAllowed() : {};
      var ids = Object.keys(allowed);
      var labelOf = {};
      if (NS.tools && NS.tools.list) {
        NS.tools.list().forEach(function (t) { labelOf[t.id] = t.label; });
      }

      box.innerHTML =
        '<div class="xl-mem-head">她记住的事<span class="xl-mem-close">×</span></div>' +
        '<div class="xl-mem-sub">全部只存这台浏览器的本地存储，不上传。更换浏览器、清理站点数据或换设备后，这些内容会一起丢失。</div>' +
        '<div class="xl-mem-list">' + (list.length
          ? list.map(function (m) {
            return '<div class="xl-mem-item" data-id="' + m.id + '">' +
              '<span>' + U.escape(m.text) + '</span>' +
              '<b class="xl-mem-del" title="删除">×</b></div>';
          }).join('')
          : '<div class="xl-mem-empty">还没有记住什么。聊的时候可以让她记住你的习惯。</div>') +
        '</div>' +
        (list.length ? '<div class="xl-mem-foot"><button class="xl-mem-clear">清空记忆</button></div>' : '') +

        '<div class="xl-mem-sec">你允许过的动作</div>' +
        '<div class="xl-allow-list">' + (ids.length
          ? ids.map(function (id) {
            return '<div class="xl-allow-item" data-id="' + id + '">' +
              '<span>' + U.escape(labelOf[id] || id) + '</span>' +
              '<b class="xl-allow-undo">撤销</b></div>';
          }).join('')
          : '<div class="xl-mem-empty">还没有「总是允许」的动作。</div>') +
        '</div>' +

        (NS.stats ? NS.stats.html() : '') +

        '<div class="xl-mem-sec">存储空间</div>' +
        '<div class="xl-store">' +
        '<div class="xl-store-line" id="xl-store-info">正在读取…</div>' +
        '<button class="xl-store-btn" id="xl-store-persist">申请持久存储</button>' +
        '<div class="xl-store-hint">持久存储能让浏览器更不容易自动清理这些数据，但手动清站点数据、换浏览器或换设备仍然会丢失。</div>' +
        '</div>' +

        '<div class="xl-mem-sec">备份</div>' +
        '<div class="xl-store">' +
        '<div class="xl-store-line" id="xl-backup-info">正在统计…</div>' +
        '<div class="xl-backup-row">' +
        '<button class="xl-store-btn" id="xl-backup-export">导出备份</button>' +
        '<button class="xl-store-btn xl-store-ghost" id="xl-backup-import">导入备份</button>' +
        '<input type="file" accept="application/json,.json" id="xl-backup-file" style="display:none" />' +
        '</div>' +
        '<div class="xl-store-hint">导出的 JSON 含全部对话、记忆、允许记录和设置，不含生图缓存。换浏览器或换设备时导入它就能恢复。</div>' +
        '</div>';

      var bInfo = box.querySelector('#xl-backup-info');
      if (bInfo && NS.backup) {
        var sm = NS.backup.summary();
        bInfo.textContent = '共 ' + sm.count + ' 项，约 ' + Math.max(1, Math.round(sm.bytes / 1024)) + ' KB 文本。';
      }

      storageInfo().then(function (st) {
        var el = box.querySelector('#xl-store-info');
        if (!el) return;
        if (!st.support) {
          el.textContent = '当前浏览器不支持查询存储空间。';
          var b = box.querySelector('#xl-store-persist');
          if (b) b.style.display = 'none';
          return;
        }
        el.textContent = '已用 ' + bytes(st.usage) + (st.quota ? ' / 可用 ' + bytes(st.quota) : '') +
          '，' + (st.persisted ? '已开启持久存储。' : '未开启持久存储。');
        var btn = box.querySelector('#xl-store-persist');
        if (btn && st.persisted) {
          btn.disabled = true;
          btn.textContent = '已开启';
        }
      });
    }

    render();
    mask.appendChild(box);
    document.body.appendChild(mask);

    // 用事件委托：render() 会重建面板，直接绑在 input 上会失效
    mask.addEventListener('change', function (e) {
      if (!e.target || e.target.id !== 'xl-backup-file') return;
      var f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f || !NS.backup) return;
      NS.backup.import(f).then(function (n) {
        render();
        UI_tip('已导入 ' + n + ' 项，刷新页面后生效。');
      }).catch(function (err) {
        UI_tip((err && err.message) || '导入失败');
      });
    });

    mask.addEventListener('click', function (e) {
      if (e.target === mask || (e.target.className || '').indexOf('xl-mem-close') >= 0) {
        mask.parentNode.removeChild(mask);
        return;
      }

      var del = e.target.closest && e.target.closest('.xl-mem-del');
      if (del) {
        Memory.remove(del.closest('.xl-mem-item').getAttribute('data-id'));
        render();
        return;
      }

      var undo = e.target.closest && e.target.closest('.xl-allow-undo');
      if (undo) {
        var id = undo.closest('.xl-allow-item').getAttribute('data-id');
        if (NS.tools && NS.tools.forgetAlways) NS.tools.forgetAlways(id);
        render();
        return;
      }

      if (e.target.closest && e.target.closest('.xl-mem-clear')) {
        Memory.clear();
        render();
        return;
      }

      if (e.target.closest && e.target.closest('#xl-backup-export')) {
        if (NS.backup) {
          NS.backup.export();
          UI_tip('备份已开始下载。');
        }
        return;
      }

      if (e.target.closest && e.target.closest('#xl-backup-import')) {
        var fi = box.querySelector('#xl-backup-file');
        if (fi) fi.click();
        return;
      }

      if (e.target.closest && e.target.closest('#xl-store-persist')) {
        var b = e.target.closest('#xl-store-persist');
        b.disabled = true;
        b.textContent = '申请中…';
        Memory.requestPersist().then(function (ok) {
          render();
          var el = box.querySelector('#xl-store-info');
          if (el) UI_tip(ok ? '已获得持久存储。' : '浏览器没有授予持久存储，数据仍可能被自动清理。');
        });
      }
    });

    return mask;
  };

  function UI_tip(t) {
    if (NS.ui && NS.ui.showTip) NS.ui.showTip(t);
  }
})();
