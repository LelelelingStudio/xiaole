/*!
 * 小了 SDK - 本地使用统计
 *
 * 全部从本机 localStorage 算出来，不埋点、不上传。
 * 面板里显示：对话数、消息数、今日消息、最近 7 天活跃、生图次数、记忆条数。
 */
(function () {
  'use strict';

  var NS = window.Xiaole;
  if (!NS) return;

  var U = NS.utils;
  var Stats = NS.stats = {};

  function read(key, dft) {
    try {
      var v = localStorage.getItem('lelele-xiaole-' + key);
      return v === null ? dft : JSON.parse(v);
    } catch (e) { return dft; }
  }

  function todayKey(ts) {
    var d = new Date(ts || Date.now());
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  Stats.summary = function () {
    var convs = (U.convs && U.convs.all) ? U.convs.all() : [];
    var out = {
      convs: convs.length,
      messages: 0,
      todayMessages: 0,
      images: read('image-count', 0) || 0,
      memory: (NS.memory && NS.memory.list) ? NS.memory.list().length : 0,
      days: {},
      firstAt: null,
      lastAt: null
    };
    var tk = todayKey();

    convs.forEach(function (c) {
      var msgs = c.messages || [];
      out.messages += msgs.length;
      if (!out.firstAt || (c.createdAt && c.createdAt < out.firstAt)) out.firstAt = c.createdAt || out.firstAt;
      if (c.updatedAt && (!out.lastAt || c.updatedAt > out.lastAt)) out.lastAt = c.updatedAt;
      if (tk === todayKey(c.updatedAt)) out.todayMessages += msgs.length;

      // 最近 7 天：按会话更新时间记一次活跃
      if (c.updatedAt) {
        var k = todayKey(c.updatedAt);
        out.days[k] = (out.days[k] || 0) + 1;
      }
    });

    // 超过 7 天的不显示
    var now = Date.now();
    Object.keys(out.days).forEach(function (k) {
      var parts = k.split('-');
      var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (now - d.getTime() > 7 * 86400000) delete out.days[k];
    });

    return out;
  };

  Stats.html = function () {
    var s = Stats.summary();
    var cells = [
      { k: '对话', v: s.convs },
      { k: '消息', v: s.messages },
      { k: '今日消息', v: s.todayMessages },
      { k: '生图', v: s.images },
      { k: '记忆', v: s.memory }
    ];
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(Date.now() - i * 86400000);
      var k = todayKey(d.getTime());
      days.push({ label: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()], active: !!s.days[k] });
    }

    return '<div class="xl-mem-sec">使用情况</div>' +
      '<div class="xl-stat-grid">' + cells.map(function (c) {
        return '<div class="xl-stat-cell"><b>' + c.v + '</b><span>' + c.k + '</span></div>';
      }).join('') + '</div>' +
      '<div class="xl-stat-days">' + days.map(function (d) {
        return '<div class="xl-stat-day' + (d.active ? ' is-on' : '') + '"><i></i><span>' + d.label + '</span></div>';
      }).join('') + '</div>' +
      '<div class="xl-store-hint">这些数字只在你的浏览器里算出来，没有上传；清站点数据或换设备后会重新开始。</div>';
  };

  Stats.reset = function () {
    // 只清统计相关计数，不动对话内容；主要用于调试与「归零」
    U.store.remove('image-count');
  };
})();
