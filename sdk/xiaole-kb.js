/*!
 * 小了 SDK - 工作室知识库（kb/<产品id>.json）
 *
 * 规则：
 * - 系统背景（工作室总览）永远在 basePrompt 里，每轮都有。
 * - 产品详情默认只注入"当前站点那一份"（宿主用 data-product 指定，或按 preset 同名推断）。
 * - AI 想了解其他产品时：用户提问里出现其它产品名 → 自动补该产品档案（仅本次请求）；
 *   模型也可以输出 [[kb:产品id]] 主动申请，SDK 取回后供下一轮使用。
 */
(function () {
  'use strict';

  var NS = window.Xiaole;
  if (!NS) return;

  var C = NS.config;
  var U = NS.utils;

  var cache = {};        // id -> doc
  var pending = {};      // id -> Promise
  var indexCache = null; // [{id,name,site,aliases}]
  var hostId = '';       // 当前站点自己的产品 id
  var prefetched = [];   // 模型申请的、待下一轮注入的 id

  function cfg() {
    return (C && C.kb) || {};
  }

  function dir() {
    var d = cfg().dir || 'kb/';
    var base = (C.baseUrl || '').replace(/\/$/, '');
    return base + '/' + d.replace(/^\/+/, '');
  }

  function fetchJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('kb ' + r.status);
      return r.json();
    });
  }

  // 域名 → 产品 id（index.json 的 domains 表；也认子域名）
  function resolveHost() {
    var map = (indexCache && indexCache.domains) || {};
    var host = String(location.hostname || '').toLowerCase();
    if (map[host]) return map[host];
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) {
      if (host === keys[i] || host.slice(-keys[i].length - 1) === '.' + keys[i]) return map[keys[i]];
    }
    return '';
  }

  function known(id) {
    if (!indexCache || !indexCache.length) return false;
    for (var i = 0; i < indexCache.length; i++) if (indexCache[i].id === id) return true;
    return false;
  }

  function loadIndex() {
    if (indexCache) return Promise.resolve(indexCache);
    // 带时间戳，避免浏览器/CDN 继续用旧索引（曾导致域名映射失效、整轮没档案）
    return fetchJSON(dir() + 'index.json?t=' + Date.now()).then(function (d) {
      indexCache = (d && d.products) || [];
      indexCache.domains = (d && d.domains) || {};
      return indexCache;
    }).catch(function () {
      indexCache = [];
      indexCache.domains = {};
      return indexCache;
    });
  }

  function load(id) {
    id = String(id || '').toLowerCase();
    if (!id) return Promise.resolve(null);
    if (cache[id]) return Promise.resolve(cache[id]);
    if (pending[id]) return pending[id];
    pending[id] = fetchJSON(dir() + id + '.json').then(function (d) {
      cache[id] = d;
      delete pending[id];
      return d;
    }).catch(function () {
      delete pending[id];
      return null;
    });
    return pending[id];
  }

  function trimDoc(doc) {
    if (!doc) return '';
    var detail = String(doc.detail || '');
    var max = cfg().maxChars || 2200;
    if (detail.length > max) detail = detail.slice(0, max) + '…';
    return '【' + (doc.name || doc.id) + '】' + (doc.site ? ' ' + doc.site : '') + '\n' + detail;
  }

  /* ================= 名字匹配 ================= */

  function match(text) {
    if (cfg().autoMatch === false) return [];
    var s = String(text || '').toLowerCase();
    if (!s) return [];
    var hits = [];
    (indexCache || []).forEach(function (p) {
      if (p.id === hostId) return;
      var aliases = (p.aliases || []).concat([p.id, p.name]);
      for (var i = 0; i < aliases.length; i++) {
        var a = String(aliases[i] || '').toLowerCase();
        if (a.length < 2) continue;
        if (s.indexOf(a) >= 0) {
          hits.push(p.id);
          return;
        }
      }
    });
    return hits;
  }

  /* ================= 对外 ================= */

  var KB = NS.kb = {};

  KB.config = cfg;

  /** 当前站点产品 id */
  KB.host = function (id) {
    hostId = String(id || '').toLowerCase();
    return hostId;
  };

  KB.hostId = function () { return hostId; };

  /**
   * 取某产品的档案文本（用于拼进系统提示词）
   */
  KB.doc = function (id) {
    return load(id).then(trimDoc);
  };

  /**
   * 组装当前站点的产品说明：宿主档案 + 预设说明
   */
  KB.hostPrompt = function (presetPrompt) {
    var preset = String(presetPrompt || '').trim();
    return loadIndex().then(function () {
      // 宿主没显式指定，或指定的不是档案里的产品 → 按当前域名自动认领
      if (!known(hostId)) hostId = resolveHost();
      if (!hostId) return preset;
      return KB.doc(hostId).then(function (docText) {
        var parts = [];
      if (preset) parts.push(preset);
        if (docText) parts.push('【当前站点产品档案】\n' + docText);
        return parts.join('\n\n');
      });
    });
  };

  /**
   * 本轮请求的补充上下文：
   * 1) 用户提到别的产品 → 自动补；
   * 2) 上一轮模型用 [[kb:id]] 申请的 → 这次补上。
   */
  KB.context = function (text) {
    var want = match(text);
    var extra = prefetched.slice();
    prefetched = [];

    var ids = [];
    extra.concat(want).forEach(function (id) {
      if (!id || id === hostId) return;
      if (ids.indexOf(id) >= 0) return;
      if (ids.length >= (cfg().maxExtra || 2)) return;
      ids.push(id);
    });
    if (!ids.length) return Promise.resolve('');

    return Promise.all(ids.map(function (id) { return load(id); })).then(function (docs) {
      var parts = docs.filter(Boolean).map(trimDoc);
      if (!parts.length) return '';
      return '【其他产品档案（按用户提问临时调取）】\n' + parts.join('\n\n') +
        '\n（这些档案只用于本轮回答，不要向用户说明资料来源。）';
    });
  };

  /** 模型在回复里申请了档案：取回来存着，下一轮用 */
  KB.prefetch = function (ids) {
    if (!ids || !ids.length) return;
    ids.forEach(function (id) {
      id = String(id || '').toLowerCase();
      if (!id || id === hostId) return;
      if (prefetched.indexOf(id) < 0) prefetched.push(id);
      load(id);
    });
  };

  /** 预热：启动时把索引拉下来，后面匹配不用等 */
  KB.init = function () {
    return loadIndex();
  };
})();
