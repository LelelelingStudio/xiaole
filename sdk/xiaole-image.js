/*!
 * 小了 SDK - 生图模块
 * 调用 /image 接口 + 每日限额 + 水印（双层策略）
 *
 * 水印策略说明：
 * 1) 先尝试 fetch 把远程图片读成 blob（同源 blob 不污染 canvas），画进 canvas 叠加水印，
 *    导出 dataURL —— 这时「显示的图」和「保存的图」都带水印。
 * 2) 远程图未开 CORS 时 fetch 会失败（浏览器安全策略），此时退回展示原图 + 在图片上层
 *    叠一个 DOM 水印徽标，保证肉眼始终能看到水印，保存仍是原图。
 */
(function () {
  'use strict';

  var NS = (window.Xiaole = window.Xiaole || {});
  var C = NS.config;
  var U = NS.utils;

  var Img = (NS.image = {});

  /* ================= 限额 ================= */

  function countKey() { return 'image-count'; }
  function dateKey() { return 'image-date'; }

  Img.remaining = function () {
    var date = U.store.get(dateKey(), '');
    if (date !== U.today()) {
      U.store.set(dateKey(), U.today());
      U.store.set(countKey(), 0);
      return C.image.maxPerDay;
    }
    var used = U.store.get(countKey(), 0) || 0;
    return Math.max(0, C.image.maxPerDay - used);
  };

  Img.canGenerate = function () {
    return Img.remaining() > 0;
  };

  function consume() {
    var used = U.store.get(countKey(), 0) || 0;
    U.store.set(countKey(), used + 1);
    U.store.set(dateKey(), U.today());
  }

  /* ================= 生成 ================= */

  /**
   * @param {Object} opts { prompt, size, model }
   * @returns {Promise<{url:string, display:string, save:string, mode:string}>}
   */
  Img.generate = function (opts) {
    opts = opts || {};
    if (!opts.prompt) return Promise.reject(new Error('prompt required'));
    if (!Img.canGenerate()) {
      return Promise.reject(new Error(C.text.imageLimitTip));
    }

    var body = {
      prompt: opts.prompt,
      size: opts.size || '1024x1024',
      model: opts.model || '',
      fingerprint: U.fingerprint(),
      preset: C.state.preset || 'default'
    };

    return fetch(C.apiBase + C.image.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var url = extractUrl(data);
        if (!url) throw new Error('no image url');
        consume();
        U.emit('image', { url: url, remaining: Img.remaining() });
        return Img.prepare(url).then(function (r) {
          return {
            url: url,
            display: r.display,
            save: r.save,
            mode: r.mode
          };
        });
      });
  };

  function extractUrl(data) {
    if (!data) return '';
    if (typeof data === 'string') return data;
    var keys = ['image_url', 'imgUrl', 'url', 'imageUrl', 'image'];
    for (var i = 0; i < keys.length; i++) {
      if (typeof data[keys[i]] === 'string' && data[keys[i]]) return data[keys[i]];
    }
    if (data.data) {
      if (typeof data.data === 'string') return data.data;
      if (Array.isArray(data.data) && data.data[0]) {
        return extractUrl(data.data[0]);
      }
      if (data.data.url) return data.data.url;
    }
    return '';
  }

  /* ================= 水印 ================= */

  // 取右下角区域平均亮度：深色图 → 白字；浅色图 → 黑灰字
  function sampleLuma(ctx, w, h) {
    var boxW = Math.min(80, Math.floor(w * 0.3));
    var boxH = Math.min(80, Math.floor(h * 0.3));
    var x = Math.max(0, w - boxW);
    var y = Math.max(0, h - boxH);
    var data = ctx.getImageData(x, y, boxW, boxH).data;
    var total = 0;
    var count = 0;
    for (var i = 0; i < data.length; i += 4) {
      total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      count++;
    }
    return count ? total / count : 255;
  }

  function toImage(src, crossOrigin) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      if (crossOrigin) image.crossOrigin = 'anonymous';
      image.onload = function () { resolve(image); };
      image.onerror = function () { reject(new Error('image load failed')); };
      image.src = src;
    });
  }

  // 把图片画进 canvas 并叠加文字水印，返回 dataURL
  function markImage(image) {
    var cfg = C.image.watermark;
    var canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;

    var ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    var luma = sampleLuma(ctx, canvas.width, canvas.height);
    var color = luma < 128 ? '255,255,255' : '70,75,90';

    var fontSize = Math.max(10, Math.round(cfg.fontSize * (canvas.width / 1024)));
    ctx.font = fontSize + 'px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';

    var pad = Math.round(cfg.padding * (canvas.width / 1024));
    var x = canvas.width - pad;
    var y = canvas.height - pad;

    ctx.fillStyle = 'rgba(' + color + ',' + cfg.opacity + ')';
    ctx.fillText(cfg.text, x, y);

    return canvas.toDataURL('image/png');
  }

  /**
   * 准备一张可展示的图：优先本地化 + canvas 水印，失败则退回原图（由 UI 叠 DOM 水印）
   * @returns {Promise<{display:string, save:string, mode:'watermarked'|'overlay'}>}
   */
  Img.prepare = function (url) {
    var timeoutMs = 8000;

    function fallback() {
      return { display: url, save: url, mode: 'overlay' };
    }

    var blobUrl = null;
    var settled = false;

    return new Promise(function (resolve) {
      var timer = setTimeout(function () {
        if (!settled) { settled = true; resolve(fallback()); }
      }, timeoutMs);

      function done(v) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      }

      // 第一层：fetch 拿字节（需要图片源允许跨域）
      fetch(url, { mode: 'cors', credentials: 'omit' })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.blob();
        })
        .then(function (blob) {
          blobUrl = URL.createObjectURL(blob);
          return toImage(blobUrl);
        })
        .then(function (image) {
          var dataUrl = markImage(image);
          done({ display: dataUrl, save: dataUrl, mode: 'watermarked' });
        })
        .catch(function () {
          // 第二层：不带 crossOrigin 的 img 先能显示（canvas 会被污染，无法导出）
          toImage(url, false)
            .then(function () { done(fallback()); })
            .catch(function () { done(fallback()); });
        });
    });
  };

  // 兼容旧调用：只取可展示的图
  Img.watermark = function (url) {
    return Img.prepare(url).then(function (r) { return r.display; });
  };
})();
