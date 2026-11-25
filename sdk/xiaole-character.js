/*!
 * 小了 SDK - 角色模块
 * 当前版本：static（单张整体图）
 * 预留：layered（分层图层 + 眨眼 + 呼吸 + 眼珠跟随），资源齐全时自动升级
 */
(function () {
  'use strict';

  var NS = (window.Xiaole = window.Xiaole || {});
  var C = NS.config;
  var U = NS.utils;

  var Ch = (NS.character = {});

  var root = null;
  var img = null;
  var layerEls = [];
  var gender = 'girl';
  var hidden = false;
  var ready = false;
  var mouse = { x: 0, y: 0 };
  var blinkTimer = null;
  var rafId = null;

  /* ================= 初始化 ================= */

  Ch.init = function () {
    gender = U.store.get('gender', C.character.defaultGender);
    if (gender !== 'boy') gender = 'girl';

    root = U.el('div', 'xl-character');
    root.id = 'xl-character';
    root.style.width = C.character.size + 'px';
    root.style.height = C.character.size + 'px';
    root.style.right = C.character.right + 'px';
    root.style.bottom = C.character.bottom + 'px';

    document.body.appendChild(root);

    Ch.setGender(gender, true);
    bindEvents();
    bindMouse();
    ready = true;

    return Promise.resolve();
  };

  /* ================= 静态模式 ================= */

  function assetUrl(path) {
    if (!path) return '';
    if (/^https?:\/\//.test(path) || path.charAt(0) === '/') return path;
    return C.baseUrl.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
  }

  function mountStatic() {
    root.innerHTML = '';
    layerEls = [];

    img = new Image();
    img.className = 'xl-character-img';
    img.alt = C.name;
    img.draggable = false;
    img.onerror = function () {
      // 图片缺失时用占位占位（不空白）
      root.classList.add('xl-character-empty');
      root.innerHTML = '<div class="xl-placeholder"><span>小</span></div>';
    };
    img.src = assetUrl(C.character.staticImage[gender]);
    root.appendChild(img);
    C.state.mode = 'static';
  }

  /* ================= 分层模式（预留，资源齐全时自动启用）================= */

  function layerPath(name) {
    return assetUrl('assets/layers/' + gender + '/' + name + '.png');
  }

  function mountLayered() {
    root.innerHTML = '';
    layerEls = [];
    C.character.layers[gender].forEach(function (name) {
      var el = new Image();
      el.className = 'xl-layer xl-layer-' + name;
      el.draggable = false;
      if (name === '04_iris') el.className += ' xl-layer-iris';
      el.style.transformOrigin = '50% 100%';
      var tf = (C.character.layerTransform[gender] || {})[name];
      if (tf) {
        var sc = tf.scale || 1;
        var tx = tf.x || 0;
        var ty = tf.y || 0;
        el.dataset.baseTransform =
          'translate(' + tx + 'px,' + ty + 'px) scale(' + sc + ')';
        el.style.transform = el.dataset.baseTransform;
      }
      el.src = layerPath(name);
      el.onerror = function () { el.style.display = 'none'; };
      root.appendChild(el);
      layerEls.push(el);
    });
    C.state.mode = 'layered';
  }

  // 探测图层是否齐全，齐全则自动切换到分层模式（宿主无感知）
  Ch.detectLayers = function () {
    var list = C.character.layers[gender] || [];
    return Promise.all(
      list.map(function (name) {
        return U.probeImage(layerPath(name));
      })
    ).then(function (results) {
      var ok = results.filter(Boolean).length >= 5; // 核心层基本齐全
      try { console.log('[xiaole] detect', gender, JSON.stringify(results), 'ok=' + ok); } catch (e) {}
      return ok;
    });
  };

  /* ================= 性别 ================= */

  Ch.setGender = function (next, silent) {
    next = next === 'boy' ? 'boy' : 'girl';
    var changed = next !== gender;
    gender = next;
    U.store.set('gender', gender);

    // 先探测图层是否齐全：齐全直接走分层模式，否则用静态整体图
    function detectWithRetry(tried) {
      return Ch.detectLayers().then(function (ok) {
        if (ok || tried) return ok;
        // 首次冷加载素材慢时会超时，稍等再探一次
        return new Promise(function (r) {
          setTimeout(function () { r(detectWithRetry(1)); }, 2500);
        });
      });
    }

    detectWithRetry(0).then(function (ok) {
      if (ok) {
        mountLayered();
      } else {
        mountStatic();
      }
      if (changed && !silent) {
        root.classList.add('xl-fade');
        setTimeout(function () { root.classList.remove('xl-fade'); }, 320);
      }
      U.emit('gender', gender);
      U.emit('mode', C.state.mode);
    });

    return gender;
  };

  Ch.toggleGender = function () {
    return Ch.setGender(gender === 'girl' ? 'boy' : 'girl');
  };

  Ch.getGender = function () {
    return gender;
  };

  /* ================= 显示 / 隐藏 ================= */

  Ch.hide = function () {
    hidden = true;
    root.classList.add('xl-hidden');
    U.emit('hide');
    var dot = document.getElementById('xl-reset-dot');
    if (dot) dot.classList.add('xl-show');
  };

  Ch.show = function () {
    hidden = false;
    root.classList.remove('xl-hidden');
    U.emit('show');
    var dot = document.getElementById('xl-reset-dot');
    if (dot) dot.classList.remove('xl-show');
  };

  Ch.toggle = function () {
    if (hidden) Ch.show();
    else Ch.hide();
    return !hidden;
  };

  Ch.isHidden = function () {
    return hidden;
  };

  Ch.el = function () {
    return root;
  };

  /* ================= 交互 ================= */

  function bindEvents() {
    root.addEventListener('click', function (e) {
      e.stopPropagation();
      U.emit('toggle-chat');
    });

    root.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var x = e.clientX;
      var y = e.clientY;
      if (NS.ui && NS.ui.openMenu) NS.ui.openMenu(x, y);
    });
  }

  /* ================= 眼珠跟随 / 呼吸（分层模式下生效）================= */

  function bindMouse() {
    document.addEventListener(
      'mousemove',
      function (e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        if (C.state.mode !== 'layered' || !C.character.eyeFollow) return;
        if (rafId) return;
        rafId = requestAnimationFrame(function () {
          rafId = null;
          applyEyeFollow();
        });
      },
      { passive: true }
    );
  }

  function applyEyeFollow() {
    if (!root) return;
    var rect = root.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var dx = (mouse.x - cx) / (window.innerWidth / 2);
    var dy = (mouse.y - cy) / (window.innerHeight / 2);
    dx = Math.max(-1, Math.min(1, dx));
    dy = Math.max(-1, Math.min(1, dy));

    var max = rect.width * 0.05;
    layerEls.forEach(function (el) {
      var cls = el.className;
      var base = el.dataset.baseTransform || '';
      var suffix = base ? ' ' + base : '';
      if (cls.indexOf('xl-layer-iris') > -1) {
        el.style.transform =
          'translate(' + dx * max + 'px,' + dy * max * 0.6 + 'px)' + suffix;
      } else if (cls.indexOf('face_base') > -1) {
        el.style.transform =
          'translate(' + dx * max * 0.25 + 'px,' + dy * max * 0.15 + 'px)' + suffix;
      }
    });
  }
})();
