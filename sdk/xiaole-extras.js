/*!
 * 小了 SDK - 附加功能（搜索 / 主题 / 导出 / 图片尺寸 / 指令 / 停止 / 快照）
 * 不依赖页面内部变量，全部通过 Xiaole 暴露的接口和 DOM 操作完成，
 * 所以浮窗版和整页版都能用。
 */
(function () {
  'use strict';

  var NS = window.Xiaole;
  if (!NS || !NS.utils) return;
  var U = NS.utils;
  var C = NS.config;

  var THEME_KEY = 'theme';
  var SNAP_KEY = 'snapshot-last';

  function $(sel) { return document.querySelector(sel); }
  function rootEl() { return document.getElementById('xl-page') || $('.xl-cloud') || $('.xl'); }
  function isPage() { return !!(document.getElementById('xlp-input')); }

  /* ================= 主题 ================= */

  function systemDark() {
    try { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; }
  }

  function applyTheme() {
    var mode = U.store.get(THEME_KEY, (C.ui && C.ui.preset) || 'auto');
    var dark = mode === 'dark' || (mode === 'auto' && systemDark());
    var page = document.getElementById('xl-page');
    var flo = $('.xl-cloud');
    if (page) page.classList.toggle('xlp-dark', dark);
    if (flo) flo.classList.toggle('xl-dark', dark);
    var btn = document.getElementById('xlp-theme-btn');
    if (btn) btn.textContent = '主题:' + (mode === 'dark' ? '深' : mode === 'light' ? '浅' : '自动');
  }

  function cycleTheme() {
    var cur = U.store.get(THEME_KEY, (C.ui && C.ui.preset) || 'auto');
    var next = cur === 'auto' ? 'light' : cur === 'light' ? 'dark' : 'auto';
    U.store.set(THEME_KEY, next);
    applyTheme();
  }

  /* ================= 搜索 ================= */

  function ensureSearch() {
    if (document.getElementById('xlp-search')) return;
    var box = document.createElement('div');
    box.id = 'xlp-search';
    box.className = 'xlp-search';
    box.innerHTML =
      '<div class="xlp-search-mask"></div>' +
      '<div class="xlp-search-panel">' +
      '<input id="xlp-search-input" type="search" placeholder="' + U.escape(C.text.searchPlaceholder) + '" />' +
      '<div id="xlp-search-list" class="xlp-search-list"></div>' +
      '</div>';
    document.body.appendChild(box);

    box.querySelector('.xlp-search-mask').addEventListener('click', closeSearch);
    document.getElementById('xlp-search-input').addEventListener('input', function () {
      renderResults(this.value);
    });
    document.getElementById('xlp-search-list').addEventListener('click', function (e) {
      var item = e.target.closest ? e.target.closest('.xlp-search-item') : null;
      if (!item) return;
      var id = item.getAttribute('data-conv');
      closeSearch();
      if (NS.utils.convs.switchTo) NS.utils.convs.switchTo(id);
    });
  }

  function closeSearch() {
    var box = document.getElementById('xlp-search');
    if (box) box.style.display = 'none';
  }

  function openSearch() {
    ensureSearch();
    var box = document.getElementById('xlp-search');
    box.style.display = 'block';
    var input = document.getElementById('xlp-search-input');
    input.value = '';
    renderResults('');
    setTimeout(function () { input.focus(); }, 60);
  }

  function renderResults(q) {
    var list = document.getElementById('xlp-search-list');
    if (!list) return;
    var query = String(q || '').trim().toLowerCase();
    var convs = U.convs.all();
    var out = [];
    convs.forEach(function (c) {
      var msgs = c.messages || [];
      if (!query) {
        out.push({ conv: c, text: msgs.length ? msgs[msgs.length - 1].content || '' : '', hit: false });
        return;
      }
      if (String(c.title || '').toLowerCase().indexOf(query) > -1) {
        out.push({ conv: c, text: '（对话标题命中）', hit: true });
        return;
      }
      for (var i = msgs.length - 1; i >= 0; i--) {
        var body = String(msgs[i].content || '');
        var idx = body.toLowerCase().indexOf(query);
        if (idx > -1) {
          var from = Math.max(0, idx - 24);
          out.push({
            conv: c,
            text: (from > 0 ? '…' : '') + body.slice(from, idx + query.length + 40).replace(/\s+/g, ' '),
            hit: true
          });
          break;
        }
      }
    });

    if (!out.length) {
      list.innerHTML = '<div class="xlp-search-empty">' + U.escape(C.text.searchEmpty) + '</div>';
      return;
    }
    list.innerHTML = out.slice(0, 40).map(function (r) {
      return '<button class="xlp-search-item" type="button" data-conv="' + U.escape(r.conv.id) + '">' +
        '<span class="xlp-search-title">' + U.escape(r.conv.title || '未命名对话') + '</span>' +
        '<span class="xlp-search-text">' + U.escape(r.text || '（空对话）') + '</span>' +
        '</button>';
    }).join('');
  }

  /* ================= 导出 ================= */

  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function convText() {
    var conv = U.convs.current && U.convs.current();
    if (!conv) return '';
    var lines = ['# ' + (conv.title || '小了对话'), ''];
    (conv.messages || []).forEach(function (m) {
      if (m.type === 'image') {
        lines.push('![图片](' + (m.url || '') + ')');
        if (m.prompt) lines.push('> 画面描述：' + m.prompt);
        lines.push('');
        return;
      }
      lines.push((m.role === 'user' ? '**我**：' : '**小了**：') + String(m.content || ''));
      lines.push('');
    });
    lines.push('---');
    lines.push('由小了导出 · ' + new Date().toLocaleString());
    return lines.join('\n');
  }

  function exportMarkdown() {
    var conv = U.convs.current && U.convs.current();
    download('xiaole-' + (conv ? conv.id : 'chat') + '.md', convText(), 'text/markdown;charset=utf-8');
  }

  function exportPdf() {
    var conv = U.convs.current && U.convs.current();
    var title = (conv && conv.title) || '小了对话';
    var body = (conv && conv.messages || []).map(function (m) {
      if (m.type === 'image') {
        return '<figure><img src="' + U.escape(m.url || '') + '" /><figcaption>' +
          U.escape(m.prompt || '') + '</figcaption></figure>';
      }
      return '<section class="' + (m.role === 'user' ? 'u' : 'a') + '"><h4>' +
        (m.role === 'user' ? '我' : '小了') + '</h4><p>' + U.escape(String(m.content || '')).replace(/\n/g, '<br>') + '</p></section>';
    }).join('');
    var win = window.open('', '_blank');
    if (!win) return;
    win.document.write('<!doctype html><meta charset="utf-8"><title>' + U.escape(title) + '</title>' +
      '<style>body{font:14px/1.7 -apple-system,"PingFang SC",sans-serif;max-width:760px;margin:32px auto;padding:0 20px;color:#222}' +
      'h1{font-size:20px}h4{margin:0 0 6px;color:#4a6fb5;font-size:12px}section{margin:0 0 18px;padding:12px 14px;border-radius:10px;background:#f5f7fb}' +
      'section.u{background:#eef3ff}img{max-width:100%;border-radius:8px}figcaption{font-size:12px;color:#666}</style>' +
      '<h1>' + U.escape(title) + '</h1>' + body +
      '<script>setTimeout(function(){window.print()},400)<\/script>');
    win.document.close();
  }

  /* ================= 图片面板扩展 ================= */

  function enhanceImagePanel() {
    var panel = document.getElementById('xlp-img-panel');
    if (!panel || panel.dataset.xlExtra) return;
    panel.dataset.xlExtra = '1';

    var row = document.createElement('div');
    row.className = 'xlp-img-opts';
    var sizes = (C.image && C.image.sizes) || [];
    row.innerHTML = '<select id="xlp-img-size">' + sizes.map(function (s) {
      return '<option value="' + s.value + '"' + (s.value === C.image.defaultSize ? ' selected' : '') + '>' + s.label + '</option>';
    }).join('') + '</select><span class="xlp-img-tpls" id="xlp-img-tpls"></span>';
    panel.insertBefore(row, panel.firstChild);

    document.getElementById('xlp-img-size').addEventListener('change', function () {
      C.image.defaultSize = this.value;
      U.store.set('img-size', this.value);
    });
    var saved = U.store.get('img-size', '');
    if (saved) C.image.defaultSize = saved;

    var tpls = document.getElementById('xlp-img-tpls');
    tpls.innerHTML = ((C.image && C.image.templates) || []).map(function (t) {
      return '<button type="button" class="xlp-img-tpl" data-p="' +
        U.escape(t.prompt) + '">' + U.escape(t.name) + '</button>';
    }).join('');
    tpls.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.xlp-img-tpl') : null;
      if (!b) return;
      var input = document.getElementById('xlp-img-input');
      if (input) {
        input.value = b.getAttribute('data-p') || '';
        input.focus();
      }
    });
  }

  /* ================= 自定义指令 ================= */

  function manageCommands() {
    var cmds = NS.commands;
    if (!cmds || !cmds.setCustom) return;
    var existing = cmds.custom();
    var raw = window.prompt(
      '一行一条，格式：名字=提示词\n（提示词里的 {内容} 会被替换成 /名字 后面写的内容）\n留空则清空自定义指令。',
      existing.map(function (c) { return c.name + '=' + c.prompt; }).join('\n')
    );
    if (raw === null) return;
    var list = String(raw).split('\n').map(function (line) {
      var i = line.indexOf('=');
      if (i < 1) return null;
      return { name: line.slice(0, i).trim(), prompt: line.slice(i + 1).trim() };
    }).filter(Boolean);
    cmds.setCustom(list);
    if (NS.ui && NS.ui.showTip) NS.ui.showTip('已保存 ' + list.length + ' 条自定义指令');
  }

  /* ================= 生成中：停止 ================= */

  function ensureStopButton() {
    if (!isPage() || document.getElementById('xlp-stop-btn')) return;
    var inputRow = document.querySelector('.xlp-input-row');
    if (!inputRow) return;
    var btn = document.createElement('button');
    btn.id = 'xlp-stop-btn';
    btn.className = 'xlp-stop-btn';
    btn.type = 'button';
    btn.textContent = C.text.stop;
    btn.style.display = 'none';
    inputRow.appendChild(btn);
    btn.addEventListener('click', function () {
      try { if (NS.chat && NS.chat.abort) NS.chat.abort(); } catch (e) {}
      hideStop();
    });
    // 请求进行中把「停止」亮出来
    setInterval(function () {
      var busy = !!(document.querySelector('.xlp-msg .xl-cursor'));
      btn.style.display = busy ? 'inline-flex' : 'none';
    }, 800);
  }

  function hideStop() {
    var b = document.getElementById('xlp-stop-btn');
    if (b) b.style.display = 'none';
  }

  /* ================= 单条回答导出：只留右键 ================= */

  function bindMessageExport() {
    document.addEventListener('contextmenu', function (e) {
      var body = e.target.closest ? e.target.closest('.xlp-msg-body, .xl-msg-body') : null;
      if (!body) return;
      var text = body.innerText || '';
      if (text.length < 8) return;
      e.preventDefault();
      var q = '';
      var wrap = body.closest('.xlp-msg, .xl-msg');
      if (wrap && wrap.previousElementSibling) q = wrap.previousElementSibling.innerText || '';
      if (NS.exportImage && NS.exportImage.pair) NS.exportImage.pair(q, text);
    });
  }

  /* ================= 每周本地快照 ================= */

  function takeSnapshot(silent) {
    var data = {
      at: Date.now(),
      convs: U.convs.all ? U.convs.all() : [],
      memory: NS.memory && NS.memory.list ? NS.memory.list() : [],
      toolAllow: U.store.get('tool-allow', {})
    };
    var ok = U.store.set('snapshot', data);
    U.store.set(SNAP_KEY, Date.now());
    if (!silent && NS.ui && NS.ui.showTip) NS.ui.showTip(C.text.snapshotOn);
    if (!ok && NS.ui && NS.ui.showTip) NS.ui.showTip(C.text.quotaTip, true);
    return ok;
  }

  function autoSnapshot() {
    var last = U.store.get(SNAP_KEY, 0) || 0;
    if (Date.now() - last < 7 * 864e5) return;
    takeSnapshot(true);
  }

  function downloadSnapshot() {
    var data = U.store.get('snapshot', null);
    if (!data) { takeSnapshot(true); data = U.store.get('snapshot', null); }
    download('xiaole-snapshot-' + new Date().toISOString().slice(0, 10) + '.json',
      JSON.stringify(data, null, 2), 'application/json');
  }

  /* ================= 顶栏按钮 ================= */

  function addHeaderButtons() {
    var actions = document.querySelector('.xlp-actions');
    if (!actions || actions.dataset.xlExtra) return;
    actions.dataset.xlExtra = '1';
    actions.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.id) return;
      if (t.id === 'xlp-search-btn') openSearch();
      else if (t.id === 'xlp-theme-btn') cycleTheme();
      else if (t.id === 'xlp-export-btn') exportMarkdown();
      else if (t.id === 'xlp-pdf-btn') exportPdf();
      else if (t.id === 'xlp-cmd-btn') manageCommands();
    });
    var group = document.createElement('span');
    group.className = 'xlp-extra-group';
    group.innerHTML =
      '<button class="xlp-btn" id="xlp-search-btn" title="搜索聊天记录">搜索</button>' +
      '<button class="xlp-btn" id="xlp-theme-btn" title="切换主题">主题:自动</button>' +
      '<button class="xlp-btn" id="xlp-export-btn" title="导出为 Markdown">导出 MD</button>' +
      '<button class="xlp-btn" id="xlp-pdf-btn" title="导出为 PDF（打印）">导出 PDF</button>' +
      '<button class="xlp-btn" id="xlp-cmd-btn" title="自定义快捷指令">自定义指令</button>';
    actions.insertBefore(group, actions.firstChild);

    // 窄屏：按钮太多会把顶栏撑到 170px 高，收进一个「更多」下拉
    if (window.innerWidth < 620) {
      group.style.display = 'none';
      var more = document.createElement('button');
      more.className = 'xlp-btn';
      more.id = 'xlp-more-btn';
      more.textContent = '更多';
      var menu = document.createElement('div');
      menu.className = 'xlp-more-menu';
      menu.id = 'xlp-more-menu';
      menu.style.display = 'none';
      menu.innerHTML = [
        ['搜索聊天记录', 'search'], ['切换主题', 'theme'],
        ['导出 Markdown', 'md'], ['导出 PDF', 'pdf'],
        ['自定义指令', 'cmd'], ['本地快照', 'snap']
      ].map(function (x) { return '<button type="button" data-act="' + x[1] + '">' + x[0] + '</button>'; }).join('');
      actions.insertBefore(more, actions.firstChild);
      actions.appendChild(menu);
      more.addEventListener('click', function () {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
      });
      menu.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('button') : null;
        if (!b) return;
        menu.style.display = 'none';
        var act = b.getAttribute('data-act');
        if (act === 'search') openSearch();
        else if (act === 'theme') cycleTheme();
        else if (act === 'md') exportMarkdown();
        else if (act === 'pdf') exportPdf();
        else if (act === 'cmd') manageCommands();
        else if (act === 'snap') { takeSnapshot(false); downloadSnapshot(); }
      });
    }
  }

  function addMenuItems() {
    var flat = document.querySelector('.xlp-actions');
    if (!flat) return;
    if (!document.getElementById('xlp-snap-btn')) {
      var snap = document.createElement('button');
      snap.className = 'xlp-btn';
      snap.id = 'xlp-snap-btn';
      snap.textContent = '本地快照';
      snap.addEventListener('click', function () { takeSnapshot(false); downloadSnapshot(); });
      flat.appendChild(snap);
    }
  }

  /* ================= 启动 ================= */

  function wireUi() {
    if (!isPage()) return;
    addHeaderButtons();
    addMenuItems();
    enhanceImagePanel();
    ensureStopButton();
  }

  function boot() {
    applyTheme();
    // 页面可能在 extras 之后才建好，重试几轮直到顶栏/图片面板出现
    var tries = 0;
    var timer = setInterval(function () {
      wireUi();
      if (++tries > 24 || (document.getElementById('xlp-search-btn') && document.getElementById('xlp-img-size'))) {
        clearInterval(timer);
      }
    }, 250);
    wireUi();
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { applyTheme(); });
    } catch (e) {}

    bindMessageExport();
    autoSnapshot();
    NS.extras = {
      search: openSearch, theme: applyTheme, cycleTheme: cycleTheme,
      exportMarkdown: exportMarkdown, exportPdf: exportPdf,
      snapshot: takeSnapshot, downloadSnapshot: downloadSnapshot,
      commands: manageCommands
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
