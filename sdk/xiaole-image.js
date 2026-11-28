/*!
 * 小了 SDK - 生图模块
 * 调用 /image + 每日限额 + 真实水印（烧进图片像素）+ 本地 7 天缓存
 *
 * 为什么要走代理：
 *   agnes 的图片域名没有 Access-Control-Allow-Origin，浏览器 fetch 读不到字节，
 *   canvas 会被"污染"，既不能打水印也不能导出。所以先试直连，失败改走
 *   config.image.proxy（带 ACAO:*），拿到 blob 后画进 canvas、烧水印、导出真正
 *   带水印的 PNG，再写进 IndexedDB（默认保留 7 天）。
 */
(function () {
  'use strict';

  var NS = (window.Xiaole = window.Xiaole || {});
  var C = NS.config;
  var U = NS.utils;

  var Img = (NS.image = {});
  var objectUrls = [];

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
   * @returns {Promise<{id,url,display,save,mode}>}
   */
  // 生图串行队列：agnes 同一账号并发两个任务时偶尔把结果串线（拿到别人的图），
  // 一次只发一个请求，回来再发下一个。
  var chain = Promise.resolve();
  Img.generate = function (opts) {
    var run = chain.then(function () { return doGenerate(opts); }, function () { return doGenerate(opts); });
    chain = run.catch(function () {});
    return run;
  };

  function doGenerate(opts) {
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

        // 先返回可展示的远程图（立刻出画面），水印版在后台烤好后再换
        var id = U.hash(url);
        return {
          id: id,
          url: url,
          display: url,
          save: url,
          mode: 'overlay',
          pending: true,
          ready: Img.prepare(url)
        };
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

  function toImage(src) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = function () { reject(new Error('image load failed')); };
      image.src = src;
    });
  }

  // canvas 上烧水印并导出 blob（真·带水印文件）
  function markToBlob(image) {
    return new Promise(function (resolve, reject) {
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

      if (canvas.toBlob) {
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob);
          else reject(new Error('toBlob failed'));
        }, 'image/png', 0.92);
      } else {
        reject(new Error('toBlob unsupported'));
      }
    });
  }

  function fetchBlob(url) {
    return fetch(url, { mode: 'cors', credentials: 'omit' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.blob();
    });
  }

  function remember(objUrl) {
    objectUrls.push(objUrl);
    if (objectUrls.length > 60) {
      try { URL.revokeObjectURL(objectUrls.shift()); } catch (e) {}
    }
    return objUrl;
  }

  /**
   * 准备一张可展示 / 可下载的图
   * 直连读字节 → 失败走代理 → 再失败退回原图（由 UI 叠 DOM 水印）
   * @returns {Promise<{id,url,display,save,mode}>}
   */
  Img.prepare = function (url) {
    var id = U.hash(url);
    var settled = false;

    return new Promise(function (resolve) {
      var timer = setTimeout(function () {
        if (!settled) { settled = true; resolve({ id: id, url: url, display: url, save: url, mode: 'overlay' }); }
      }, 25000);

      function done(v) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      }

      function fallback() {
        done({ id: id, url: url, display: url, save: url, mode: 'overlay' });
      }

      fetchBlob(url)
        .catch(function () {
          var proxy = C.image.proxy || '';
          if (!proxy) throw new Error('no proxy');
          return fetchBlob(proxy + encodeURIComponent(url));
        })
        .then(function (blob) {
          var localUrl = remember(URL.createObjectURL(blob));
          return toImage(localUrl).then(markToBlob);
        })
        .then(function (wmBlob) {
          U.imgStore.put(id, wmBlob);
          var objUrl = remember(URL.createObjectURL(wmBlob));
          done({ id: id, url: url, display: objUrl, save: objUrl, mode: 'watermarked' });
        })
        .catch(fallback);
    });
  };

  /** 从本地缓存恢复图片（历史记录用），缓存过期则回落远程地址 */
  Img.restore = function (id, url) {
    return U.imgStore.get(id)
      .then(function (blob) {
        if (blob) {
          var a = remember(URL.createObjectURL(blob));
          var b = remember(URL.createObjectURL(blob));
          return { id: id, url: url, display: a, save: b, mode: 'watermarked', cached: true };
        }
        return { id: id, url: url, display: url, save: url, mode: 'overlay', cached: false };
      })
      .catch(function () {
        return { id: id, url: url, display: url, save: url, mode: 'overlay', cached: false };
      });
  };

  // 兼容旧调用
  Img.watermark = function (url) {
    return Img.prepare(url).then(function (r) { return r.display; });
  };
})();
