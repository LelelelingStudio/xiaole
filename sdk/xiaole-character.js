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
    root.style.height = C.character.size + 'px';
    root.style.width = Math.round(C.character.size * rootAspect()) + 'px';
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

  function layeredMode() {
    return C.character.style === 'layers';
  }

  function rigMode() {
    return C.character.style !== 'layers' && C.character.style !== 'frames';
  }

  function rootAspect() {
    if (rigMode()) {
      var rc = C.character.rigCanvas || { w: 360, h: 520 };
      return rc.w / rc.h;
    }
    if (!layeredMode()) return 1;
    var cv = C.character.layersCanvas || { w: 480, h: 760 };
    return cv.w / cv.h;
  }

  function assetUrl(path) {
    if (!path) return '';
    if (/^https?:\/\//.test(path) || path.charAt(0) === '/') return path;
    return C.baseUrl.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
  }

  var frameEls = {};
  var currentFrame = 'idle';
  var blinkTimer = null;
  var happyTimer = null;
  var layerIris = null;
  var layerBlush = null;
  var rigBody = null;
  var waveImg = null;
  var waveTimer = null;

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

  function layerOcclude(on) {
    // 分层模式下「闭眼」= 把眼珠层收起来（脸底没有眼形，看起来就是闭眼）
    if (!layerIris) return;
    layerIris.style.opacity = on ? '0' : '';
    layerIris.style.transform = on ? 'scaleY(0.35)' : (layerIris.dataset.baseTransform || '');
  }

  function startLayerBlink() {
    if (blinkTimer) clearTimeout(blinkTimer);
    if (!C.character.blink || !layerIris) return;

    function schedule() {
      var range = C.character.blinkRange || [3200, 6500];
      var wait = range[0] + Math.random() * (range[1] - range[0]);
      blinkTimer = setTimeout(function () {
        if (!hidden && C.state.mode === 'layered') {
          layerOcclude(true);
          setTimeout(function () { layerOcclude(false); }, C.character.blinkDuration || 120);
        }
        schedule();
      }, wait);
    }
    schedule();
  }

  /** 开心一下：收到回复 / 发消息 / 打开聊天时调用 */
  Ch.react = function (kind) {
    if (!root || hidden) return;

    // 分层画法：眨眼靠收眼珠层，开心靠弹一下 + 腮红加强
    if (C.state.mode === 'layered' && !frameEls.happy) {
      if (happyTimer) { clearTimeout(happyTimer); happyTimer = null; }
      if (kind === 'blink') {
        layerOcclude(true);
        setTimeout(function () { layerOcclude(false); }, C.character.blinkDuration || 120);
        return;
      }
      root.classList.add('xl-char-pop');
      if (layerBlush) layerBlush.style.filter = 'saturate(1.4)';
      happyTimer = setTimeout(function () {
        root.classList.remove('xl-char-pop');
        if (layerBlush) layerBlush.style.filter = '';
        happyTimer = null;
      }, C.character.happyDuration || 900);
      return;
    }
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

  /* ================= 骨架模式：身体 + 头（含闭眼/开心两版）+ 头轻微点头 ================= */

  function rigPath(name) {
    var dir = (C.character.rigDir || 'assets/rig').replace(/\/$/, '');
    return assetUrl(dir + '/' + gender + '/' + name + '.png');
  }

  function mountRig(onFallback) {
    root.innerHTML = '';
    layerEls = [];
    frameEls = {};

    root.appendChild(U.el('span', 'xl-char-glow'));
    root.appendChild(U.el('span', 'xl-char-shadow'));
    var stage = U.el('div', 'xl-char-stage');
    root.appendChild(stage);

    var map = C.character.rig || {};
    var bodyImg = new Image();
    bodyImg.className = 'xl-rig-body';
    bodyImg.alt = C.name;
    bodyImg.draggable = false;
    var bodyOk = false;
    bodyImg.onload = function () {
      bodyOk = true;
      C.state.mode = 'rig';
      U.emit('mode', 'rig');
    };
    bodyImg.onerror = function () { if (typeof onFallback === 'function') onFallback(); };
    bodyImg.src = rigPath(map.body || 'body');
    stage.appendChild(bodyImg);

    var headWrap = U.el('div', 'xl-rig-head');
    stage.appendChild(headWrap);

    // 长发 / 马尾：单独成层，挂在头部容器里跟着点头，同时自己有摆动
    var tails = (map.tails && map.tails[gender]) || [];
    if (tails.length) {
      tails.forEach(function (name, i) {
        var t = new Image();
        t.className = 'xl-rig-tail xl-rig-tail-' + (i % 2 ? 'r' : 'l');
        t.alt = '';
        t.draggable = false;
        t.style.transformOrigin = (map.tailOrigin && map.tailOrigin[name]) || '50% 35%';
        t.onerror = function () { t.style.display = 'none'; };
        t.src = rigPath(name);
        headWrap.appendChild(t);
      });
    }

    var coreSuffix = tails.length ? (map.coreSuffix || '_core') : '';
    var set = {
      idle: (map.head || 'head') + coreSuffix,
      blink: (map.headBlink || 'head_blink') + coreSuffix,
      happy: (map.headHappy || 'head_happy') + coreSuffix
    };
    var heads = {};
    var loaded = 0;
    Object.keys(set).forEach(function (k) {
      var el = new Image();
      el.className = 'xl-rig-frame' + (k === 'idle' ? ' is-on' : '');
      el.alt = C.name;
      el.draggable = false;
      el.dataset.frame = k;
      el.onload = function () {
        loaded++;
        if (k === 'idle' && bodyOk) {
          C.state.mode = 'rig';
          startBlinkLoop();
        }
      };
      el.onerror = function () {
        if (k !== 'idle') { el.style.display = 'none'; delete frameEls[k]; }
        else { el.style.display = 'none'; }
      };
      el.src = rigPath(set[k]);
      headWrap.appendChild(el);
      heads[k] = el;
      frameEls[k] = el;
    });

    rigBody = bodyImg;
    currentFrame = 'idle';
    startBlinkLoop();
  }

  /** 挥手：身体层换成抬手臂版，1.2s 后换回来 */
  Ch.wave = function () {
    var map = C.character.rig || {};
    var waveName = map.wave && map.wave[gender];
    if (!waveName || !rigBody || C.state.mode !== 'rig' || hidden) return false;
    if (waveTimer) clearTimeout(waveTimer);

    var idleSrc = rigPath(map.body || 'body');
    var waveSrc = rigPath(waveName);
    if (waveImg && waveImg.dataset.gender === gender && waveImg.dataset.name === waveName) {
      applyWave();
      return true;
    }
    waveImg = new Image();
    waveImg.dataset.gender = gender;
    waveImg.dataset.name = waveName;
    waveImg.onload = function () { if (C.state.mode === 'rig') applyWave(); };
    waveImg.onerror = function () { waveImg = null; };
    waveImg.src = waveSrc;

    function applyWave() {
      if (!rigBody) return;
      rigBody.src = waveSrc;
      rigBody.style.zIndex = '2.5';
      root.classList.add('xl-char-wave');
      waveTimer = setTimeout(function () {
        if (!rigBody) return;
        rigBody.src = idleSrc;
        rigBody.style.zIndex = '';
        root.classList.remove('xl-char-wave');
        waveTimer = null;
      }, map.waveDuration || 1250);
    }
    return true;
  };

  /* ================= 分层模式：8 张已对齐的层按同一画布叠起来 ================= */

  function layerPath(name) {
    var dir = (C.character.layersDir || 'assets/layers-aligned').replace(/\/$/, '');
    return assetUrl(dir + '/' + gender + '/' + name + '.png');
  }

  function mountLayered(onFallback) {
    root.innerHTML = '';
    layerEls = [];
    frameEls = {};
    layerIris = null;
    layerBlush = null;

    // 柔光 + 阴影（和表情帧模式一致，只是主角换成 8 个层）
    root.appendChild(U.el('span', 'xl-char-glow'));
    root.appendChild(U.el('span', 'xl-char-shadow'));
    var stage = U.el('div', 'xl-char-stage');
    root.appendChild(stage);

    var list = C.character.layers[gender] || [];
    var loaded = 0;
    var settled = 0;
    var decided = false;
    var timer = null;

    function decide(ok) {
      if (decided) return;
      decided = true;
      if (timer) clearTimeout(timer);
      if (ok) {
        C.state.mode = 'layered';
        root.classList.remove('xl-character-empty');
        U.emit('mode', 'layered');
        startLayerBlink();
      } else if (typeof onFallback === 'function') {
        onFallback();
      }
    }

    function check() {
      if (decided) return;
      if (loaded >= 5) return decide(true);
      if (settled >= shown.length) return decide(false);
    }

    var hiddenLayers = C.character.layerHidden || [];
    var shown = list.filter(function (n) { return hiddenLayers.indexOf(n) === -1; });

    shown.forEach(function (name) {
      var el = new Image();
      el.className = 'xl-layer xl-layer-' + name;
      el.draggable = false;
      el.alt = C.name;
      if (name === '04_iris') { el.className += ' xl-layer-iris'; layerIris = el; }
      if (name === '05_blush') { el.className += ' xl-layer-blush'; layerBlush = el; }
      el.onload = function () { loaded++; settled++; check(); };
      el.onerror = function () { el.style.display = 'none'; settled++; check(); };
      el.src = layerPath(name);
      stage.appendChild(el);
      layerEls.push(el);
    });

    timer = setTimeout(function () {
      if (loaded >= 5) decide(true);
      else decide(false);
    }, 8000);
  }

  /* ================= 性别 ================= */

  Ch.setGender = function (next, silent) {
    next = next === 'boy' ? 'boy' : 'girl';
    var changed = next !== gender;
    gender = next;
    U.store.set('gender', gender);

    root.style.width = Math.round(C.character.size * rootAspect()) + 'px';

    if (layeredMode()) {
      mountLayered(function () { mountRig(function () { mountStatic(); }); });
    } else if (rigMode()) {
      mountRig(function () { mountStatic(); });
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
