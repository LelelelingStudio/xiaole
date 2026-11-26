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
    if (C.character.anchor === 'left') {
      root.style.left = C.character.left + 'px';
      root.style.right = 'auto';
    } else {
      root.style.right = C.character.right + 'px';
      root.style.left = 'auto';
    }
    root.style.bottom = C.character.bottom + 'px';

    document.body.appendChild(root);

    Ch.setGender(gender, true);
    bindEvents();
    bindMouse();
    ready = true;

    return Promise.resolve();
  };

  /* ================= 立绘模式：阴影 + 主图 + 表情帧 + 柔光 ================= */

  function assetUrl(path) {
    if (!path) return '';
    if (/^https?:\/\//.test(path) || path.charAt(0) === '/') return path;
    return C.baseUrl.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
  }

  var frameEls = {};
  var currentFrame = 'idle';
  var blinkTimer = null;
  var happyTimer = null;

  function frameSet() {
    var set = (C.character.frames && C.character.frames[gender]) || {};
    return {
      idle: set.idle || C.character.staticImage[gender],
      blink: set.blink,
      happy: set.happy
    };
  }

  function mountStatic() {
    root.innerHTML = '';
    layerEls = [];
    frameEls = {};

    // 1) 柔光
    var glow = U.el('span', 'xl-char-glow');
    root.appendChild(glow);
    // 2) 地面阴影
    var shadow = U.el('span', 'xl-char-shadow');
    root.appendChild(shadow);
    // 3) 立绘舞台（呼吸动画作用在这一层，所有帧同步）
    var stage = U.el('div', 'xl-char-stage');
    root.appendChild(stage);

    var set = frameSet();
    var names = ['idle'];
    if (set.blink) names.push('blink');
    if (set.happy) names.push('happy');

    names.forEach(function (name, i) {
      var el = new Image();
      el.className = 'xl-character-img xl-char-frame' + (i === 0 ? ' is-on' : '');
      el.alt = C.name;
      el.draggable = false;
      el.dataset.frame = name;
      el.src = assetUrl(set[name]);
      el.onerror = function () {
        if (name === 'idle') {
          root.classList.add('xl-character-empty');
          stage.innerHTML = '<div class="xl-placeholder"><span>小</span></div>';
        } else {
          // 表情帧缺失就把这一帧整个摘掉，避免切过去时角色消失
          el.style.display = 'none';
          delete frameEls[name];
          if (currentFrame === name) setFrame('idle');
        }
      };
      stage.appendChild(el);
      frameEls[name] = el;
    });

    currentFrame = 'idle';
    C.state.mode = 'static';
    startBlinkLoop();
  }

  function setFrame(name) {
    if (!frameEls[name] || !frameEls[name].parentNode) {
      name = 'idle';
      if (!frameEls.idle) return;
    }
    if (currentFrame === name) return;
    Object.keys(frameEls).forEach(function (k) {
      frameEls[k].classList.toggle('is-on', k === name);
    });
    currentFrame = name;
  }

  function startBlinkLoop() {
    if (blinkTimer) clearTimeout(blinkTimer);
    if (!C.character.blink || !frameEls.blink) return;

    function schedule() {
      var range = C.character.blinkRange || [3200, 6500];
      var wait = range[0] + Math.random() * (range[1] - range[0]);
      blinkTimer = setTimeout(function () {
        if (!hidden && currentFrame === 'idle') {
          setFrame('blink');
          setTimeout(function () {
            if (currentFrame === 'blink') setFrame('idle');
          }, C.character.blinkDuration || 120);
        }
        schedule();
      }, wait);
    }
    schedule();
  }

  /** 开心一下：收到回复 / 发消息 / 打开聊天时调用 */
  Ch.react = function (kind) {
    if (!root || hidden) return;
    if (happyTimer) {
      clearTimeout(happyTimer);
      happyTimer = null;
    }
    if (kind === 'blink') {
      if (!frameEls.blink) return;
      setFrame('blink');
      setTimeout(function () { if (currentFrame === 'blink') setFrame('idle'); }, C.character.blinkDuration || 120);
      return;
    }
    if (!frameEls.happy) return;
    setFrame('happy');
    root.classList.add('xl-char-pop');
    happyTimer = setTimeout(function () {
      setFrame('idle');
      root.classList.remove('xl-char-pop');
      happyTimer = null;
    }, C.character.happyDuration || 900);
  };

  /* ================= 性别 ================= */

  Ch.setGender = function (next, silent) {
    next = next === 'boy' ? 'boy' : 'girl';
    var changed = next !== gender;
    gender = next;
    U.store.set('gender', gender);

    if (C.character.useLayers) {
      mountLayered(function () { mountStatic(); });
    } else {
      mountStatic();
    }

    if (changed && !silent) {
      root.classList.add('xl-fade');
      setTimeout(function () { root.classList.remove('xl-fade'); }, 320);
    }
    U.emit('gender', gender);

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
