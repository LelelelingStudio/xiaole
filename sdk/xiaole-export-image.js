/*!
 * 小了 SDK - 对话导出成图片卡片
 *
 * 把当前对话排成一张竖版长图：标题、双方气泡、页脚水印。
 * 纯前端 canvas 绘制，不上传；导出为 PNG。
 */
(function () {
  'use strict';

  var NS = window.Xiaole;
  if (!NS) return;

  var U = NS.utils;
  var Export = NS.exportImage = {};

  var W = 720;
  var PAD = 34;
  var MAX_MSG = 80;

  function wrap(ctx, text, maxWidth) {
    var lines = [];
    var para = String(text || '').replace(/\r/g, '').split('\n');
    para.forEach(function (p) {
      if (!p) { lines.push(''); return; }
      var line = '';
      for (var i = 0; i < p.length; i++) {
        var ch = p[i];
        var test = line + ch;
        if (ctx.measureText(test).width > maxWidth) {
          lines.push(line);
          line = ch;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
    });
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw(messages, title, convTitle) {
    var scale = 2;
    var meas = document.createElement('canvas').getContext('2d');
    meas.font = '400 26px -apple-system, "PingFang SC", "Microsoft YaHei", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';

    var blocks = [];
    var contentW = W - PAD * 2;
    var bubbleMax = contentW - 150;

    messages.slice(-MAX_MSG).forEach(function (m) {
      if (!m || !m.role || m.role === 'system') return;
      var me = m.role === 'user';
      var text = m.type === 'image'
        ? '［图片］' + (m.prompt || '')
        : String(m.content || '');
      if (!text) return;
      // 单条最多 4000 字，长回答不再截到 900 字
      if (text.length > 4000) text = text.slice(0, 4000) + '\n…（超长内容可导出 Markdown 查看全文）';
      var lines = wrap(meas, text, bubbleMax);
      blocks.push({ me: me, lines: lines, h: lines.length * 36 + 28, type: m.type });
    });

    if (!blocks.length) {
      blocks.push({ me: false, lines: ['（这段对话还没有内容）'], h: 64 });
    }

    var headH = 108;
    var footH = 76;
    var totalH = 0;
    blocks.forEach(function (b) { totalH += b.h + 14; });
    var H = headH + totalH + footH + PAD;

    var canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    var ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // 背景
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#f7f8ff');
    bg.addColorStop(1, '#ffffff');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 顶部品牌条
    var bar = ctx.createLinearGradient(0, 0, W, 0);
    bar.addColorStop(0, '#6d6afc');
    bar.addColorStop(1, '#9b7bfa');
    ctx.fillStyle = bar;
    ctx.fillRect(0, 0, W, 6);

    // 标题
    ctx.fillStyle = '#1c1f2b';
    ctx.font = '600 34px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    var headTitle = convTitle || '和小了的对话';
    ctx.fillText(headTitle.length > 18 ? headTitle.slice(0, 18) + '…' : headTitle, PAD, 56);

    ctx.fillStyle = '#8a8fa3';
    ctx.font = '400 20px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    var when = new Date();
    ctx.fillText(when.getFullYear() + '/' + (when.getMonth() + 1) + '/' + when.getDate() +
      ' · 由小了导出' + (title ? ' · ' + title : ''), PAD, 88);

    var y = headH;
    ctx.textBaseline = 'top';

    blocks.forEach(function (b) {
      var bw = 0;
      b.lines.forEach(function (l) { bw = Math.max(bw, meas.measureText(l).width); });
      bw = Math.min(bubbleMax + 32, bw + 32);
      var x = b.me ? W - PAD - bw : PAD;

      // 头像
      ctx.fillStyle = b.me ? '#e8e9f7' : '#efeafd';
      ctx.beginPath();
      ctx.arc(b.me ? W - PAD - 14 : PAD + 14, y + 16, 0, 0, Math.PI * 2);
      ctx.fill();

      // 气泡
      ctx.fillStyle = b.me ? '#5b58f0' : '#ffffff';
      roundRect(ctx, x, y, bw, b.h, 16);
      ctx.fill();
      if (!b.me) {
        ctx.strokeStyle = '#ecedf6';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // 文字
      ctx.fillStyle = b.me ? '#ffffff' : '#2a2d3a';
      ctx.font = '400 26px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      b.lines.forEach(function (l, i) {
        ctx.fillText(l, x + 16, y + 14 + i * 36);
      });

      // 小标签
      ctx.fillStyle = b.me ? 'rgba(255,255,255,.72)' : '#9aa0b4';
      ctx.font = '400 18px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText(b.me ? '你' : '小了', x + 16, y - 2);

      y += b.h + 14;
    });

    // 页脚
    ctx.fillStyle = '#f2f3fb';
    ctx.fillRect(0, H - footH, W, footH);
    ctx.fillStyle = '#8a8fa3';
    ctx.font = '400 18px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('小了 · 了了了岭工作室　xiaole.leleleling.site', PAD, H - footH + 24);
    ctx.fillStyle = '#b2b6c6';
    ctx.font = '400 16px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('对话只保存在你的浏览器本地，这张图是本地生成的', PAD, H - footH + 48);

    return canvas;
  }

  function stamp() {
    var d = new Date();
    function p(n) { return ('0' + n).slice(-2); }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  function save(canvas, prefix) {
    // 用 dataURL 同步产出，比 toBlob 稳（部分环境 toBlob 回调不触发）
    var url;
    try {
      url = canvas.toDataURL('image/png');
    } catch (e) {
      if (NS.ui && NS.ui.showTip) NS.ui.showTip('导出失败：图片太大或浏览器限制');
      return false;
    }
    var a = document.createElement('a');
    a.href = url;
    a.download = (prefix || 'xiaole-') + stamp() + '.png';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 1200);
    U.emit('export-image', { ok: true });
    return true;
  }

  /** 单条回答（连同它上面的问题）导出成一张图 */
  Export.pair = function (question, answer) {
    var presetName = (NS.config.state && NS.config.state.preset) || '';
    var canvas;
    try {
      canvas = draw([
        { role: 'user', content: String(question || '') },
        { role: 'assistant', content: String(answer || '') }
      ], presetName, '');
    } catch (e) { return false; }
    return save(canvas, 'xiaole-answer-');
  };

  /** 导出当前会话为 PNG；没会话时返回 false */
  Export.current = function () {
    var conv = U.convs.current && U.convs.current();
    if (!conv) return false;
    var presetName = (NS.config.state && NS.config.state.preset) || '';
    var canvas;
    try {
      canvas = draw(conv.messages || [], presetName, conv.title || '');
    } catch (e) {
      if (NS.ui && NS.ui.showTip) NS.ui.showTip('导出失败：' + ((e && e.message) || '画布出错'));
      return false;
    }
    return save(canvas, 'xiaole-chat-');
  };

  /** 把任意文本数组也画成卡片（内部复用） */
  Export.draw = draw;
})();
