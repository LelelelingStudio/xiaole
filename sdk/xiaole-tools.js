/*!
 * 小了 SDK - 动作调用（需要用户点头）
 *
 * 模型可以在回复里写 [[call:动作id]] 或 [[call:动作id {"参数":...}]] 申请执行一个动作。
 * SDK 不会自己跑：先在气泡里弹出确认卡，用户点「允许」才执行，点「忽略」就当没发生。
 * 宿主通过 Xiaole.tools.register(id, { label, desc, run }) 开放自己的能力。
 */
(function () {
  'use strict';

  var NS = window.Xiaole;
  if (!NS) return;

  var U = NS.utils;
  var C = NS.config;

  var registry = {};   // id -> { id, label, desc, run, danger }
  var ALLOW_KEY = 'lelele-xiaole-tool-allow';

  // 「总是允许」过的动作，下次直接执行
  function alwaysAllowed() {
    try { return JSON.parse(localStorage.getItem(ALLOW_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function allowAlways(id) {
    var m = alwaysAllowed();
    m[id] = true;
    try { localStorage.setItem(ALLOW_KEY, JSON.stringify(m)); } catch (e) {}
  }


  function cfg() {
    return (C && C.tools) || {};
  }

  /* ================= 注册 ================= */

  var Tools = NS.tools = {};

  Tools.alwaysAllowed = alwaysAllowed;
  Tools.forgetAlways = function (id) {
    var m = alwaysAllowed();
    delete m[id];
    try { localStorage.setItem(ALLOW_KEY, JSON.stringify(m)); } catch (e) {}
  };

  Tools.register = function (id, def) {
    id = String(id || '').trim().toLowerCase();
    if (!id || !def || typeof def.run !== 'function') return false;
    registry[id] = {
      id: id,
      label: def.label || id,
      desc: def.desc || '',
      run: def.run,
      danger: !!def.danger
    };
    return true;
  };

  Tools.list = function () {
    return Object.keys(registry).map(function (k) {
      var t = registry[k];
      return { id: t.id, label: t.label, desc: t.desc, danger: t.danger };
    });
  };

  Tools.has = function (id) { return !!registry[String(id || '').toLowerCase()]; };

  /* ================= 解析标记 ================= */

  /**
   * 从回复里抽出 [[call:id {...}]]，返回干净文本 + 调用列表（对用户不可见的部分已剥离）
   */
  Tools.parse = function (text) {
    var calls = [];
    var clean = String(text || '').replace(/\[\[call[:：]\s*([a-z0-9_-]{2,24})(?:\s+(\{[^\]]{0,300}\}))?\s*\]\]/gi, function (_, id, args) {
      var c = { id: id.toLowerCase(), args: null, raw: _ };
      if (args) {
        try { c.args = JSON.parse(args); } catch (e) { c.args = null; }
      }
      if (cfg().enabled !== false) calls.push(c);
      return '';
    }).replace(/\[\[call[:：]?[^\]]*$/gi, '').replace(/\n{3,}/g, '\n\n').trim();

    return { text: clean, calls: calls };
  };

  /* ================= 执行 ================= */

  Tools.exec = function (call) {
    var t = registry[call && call.id];
    if (!t) return Promise.resolve({ ok: false, msg: '这个动作没有开放：' + (call && call.id) });
    try {
      var r = t.run(call.args || {});
      return Promise.resolve(r).then(function (v) {
        return { ok: true, msg: typeof v === 'string' ? v : '' };
      }).catch(function (e) {
        return { ok: false, msg: (e && e.message) || '执行失败' };
      });
    } catch (e) {
      return Promise.resolve({ ok: false, msg: (e && e.message) || '执行失败' });
    }
  };

  /* ================= 确认卡 ================= */

  /**
   * 在消息气泡里插一张"是否允许"的卡
   * @param {HTMLElement} host 气泡里放卡的容器
   * @param {Object} call    { id, args }
   */
  Tools.card = function (host, call) {
    if (!host || !call) return null;
    var t = registry[call.id];

    // 之前点过「总是允许」→ 直接执行，不再打扰
    if (t && alwaysAllowed()[call.id]) {
      Tools.exec(call).then(function (r) {
        U.emit('tool', { id: call.id, ok: r.ok, msg: r.msg, auto: true });
      });
      return null;
    }
    var box = document.createElement('div');
    box.className = 'xl-call';

    var head = document.createElement('div');
    head.className = 'xl-call-head';
    head.textContent = t ? '小了想为你执行：' + t.label : '小了想执行一个未开放的动作：' + call.id;
    box.appendChild(head);

    var sub = document.createElement('div');
    sub.className = 'xl-call-sub';
    sub.textContent = t ? (t.desc || '需要你确认后才会执行。') : '这个动作没有在宿主里注册，不会执行。';
    box.appendChild(sub);

    var row = document.createElement('div');
    row.className = 'xl-call-actions';

    var ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'xl-call-ok';
    ok.textContent = '允许';

    var all = document.createElement('button');
    all.type = 'button';
    all.className = 'xl-call-no';
    all.textContent = '总是允许';
    all.title = '以后这个动作不再询问，可在浏览器站点数据里清除';

    var no = document.createElement('button');
    no.type = 'button';
    no.className = 'xl-call-no';
    no.textContent = '忽略';

    row.appendChild(ok);
    row.appendChild(all);
    row.appendChild(no);
    box.appendChild(row);

    var tipLine = document.createElement('div');
    tipLine.className = 'xl-call-tip';
    box.appendChild(tipLine);

    function done(text, cls) {
      row.style.display = 'none';
      tipLine.textContent = text;
      tipLine.className = 'xl-call-tip ' + (cls || '');
      box.classList.add('is-done');
    }

    all.addEventListener('click', function () {
      if (!t) { done('这个动作没有开放，无法执行。', 'bad'); return; }
      allowAlways(call.id);
      done('已允许，以后这个动作不会再问你。', 'good');
      U.emit('tool', { id: call.id, ok: true, remembered: true });
    });

    no.addEventListener('click', function () {
      done('已忽略，什么都没执行。', 'muted');
      U.emit('tool', { id: call.id, ok: false, ignored: true });
    });

    ok.addEventListener('click', function () {
      if (!t) { done('这个动作没有开放，无法执行。', 'bad'); return; }
      ok.disabled = true;
      no.disabled = true;
      row.style.display = 'none';
      tipLine.textContent = '执行中…';
      Tools.exec(call).then(function (r) {
        done(r.ok ? '已执行' + (r.msg ? '：' + r.msg : '。') : '没成功：' + r.msg, r.ok ? 'good' : 'bad');
        U.emit('tool', { id: call.id, ok: r.ok, msg: r.msg });
      });
    });

    host.appendChild(box);
    return box;
  };

  /* ================= 内置动作 ================= */

  // 挥手：确认后动一下，用来验证「调用 + 同意」链路
  Tools.register('wave', {
    label: '挥手',
    desc: '让小了朝你挥一下手，大约 1.6 秒。',
    run: function () {
      if (!NS.character || !NS.character.wave) return '角色还没准备好';
      NS.character.wave();
      return '挥手完成';
    }
  });

  // 打开链接：只允许站内/工作室域名，避免被诱导跳外站
  Tools.register('open', {
    label: '打开页面',
    desc: '在新标签打开一个工作室页面，不会提交任何表单。',
    run: function (args) {
      var url = String((args && args.url) || '');
      if (!/^https:\/\//i.test(url)) return '地址必须以 https:// 开头';
      var host = '';
      try { host = new URL(url).hostname; } catch (e) { return '地址不合法'; }
      var okHost = /\.leleleling\.site$/i.test(host) || host === 'leleleling.site' || host === location.hostname;
      if (!okHost) return '只能打开了了了岭工作室的页面：' + host;
      window.open(url, '_blank', 'noopener');
      return '已在新标签打开';
    }
  });

  // 复制一段文本到剪贴板
  Tools.register('copy', {
    label: '复制文本',
    desc: '把这段文字放进你的剪贴板。',
    run: function (args) {
      var text = String((args && (args.text || args.value)) || '').slice(0, 2000);
      if (!text) return '没有要复制的内容';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(function () { return '已复制'; });
      }
      return '当前浏览器不支持自动复制';
    }
  });

  // 切换角色形象
  Tools.register('gender', {
    label: '切换角色',
    desc: '把地标上的小了换成另一个形象。',
    run: function (args) {
      var v = String((args && args.value) || '').toLowerCase();
      if (v !== 'boy' && v !== 'girl') return '只能选 boy 或 girl';
      if (!NS.setGender) return '角色还没准备好';
      NS.setGender(v);
      return '已切换';
    }
  });

  // 指位置：把页面上的某个元素圈出来（只画，不点）
  Tools.register('point', {
    label: '指出位置',
    desc: '在页面上圈出目标，不会替你点击。',
    run: function (args) {
      if (!NS.perceive) return '页面感知没开';
      var id = (args && (args.element || args.id)) || '';
      if (!id) return '缺少目标元素';
      NS.perceive.draw([String(id).toLowerCase()]);
      return '已标出 ' + id;
    }
  });

  Tools.enabled = function () {
    return cfg().enabled !== false;
  };
})();
