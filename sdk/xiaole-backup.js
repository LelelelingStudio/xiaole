/*!
 * 小了 SDK - 本地备份
 *
 * 把 localStorage 里的 lelele-xiaole-* 打成一个 JSON 下载，换设备时再导回来。
 * 不含 IndexedDB（生图缓存体积大，且可重新生成）。
 */
(function () {
  'use strict';

  var NS = window.Xiaole;
  if (!NS) return;

  var U = NS.utils;
  var PREFIX = 'lelele-xiaole-';
  var VERSION = 1;

  function keys() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0) out.push(k);
      }
    } catch (e) {}
    return out;
  }

  function stamp() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  var Backup = NS.backup = {};

  Backup.summary = function () {
    var ks = keys();
    var size = 0;
    ks.forEach(function (k) { size += (localStorage.getItem(k) || '').length; });
    return { count: ks.length, bytes: size };
  };

  /** 导出成文件并触发下载 */
  Backup.export = function () {
    var data = { app: 'lelele-xiaole', version: VERSION, exportedAt: new Date().toISOString(), keys: {} };
    keys().forEach(function (k) {
      try { data.keys[k] = localStorage.getItem(k); } catch (e) {}
    });
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'xiaole-backup-' + stamp() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    U.emit('backup', { action: 'export', count: Object.keys(data.keys).length });
    return data;
  };

  /** 读文件、校验、写回（覆盖同名键），返回条数 */
  Backup.import = function (file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('文件读不出来')); };
      reader.onload = function () {
        var data;
        try { data = JSON.parse(String(reader.result || '')); } catch (e) { reject(new Error('不是有效的备份文件')); return; }
        if (!data || data.app !== 'lelele-xiaole' || !data.keys) { reject(new Error('不是小了导出的备份')); return; }
        var n = 0;
        Object.keys(data.keys).forEach(function (k) {
          if (k.indexOf(PREFIX) !== 0) return;
          try { localStorage.setItem(k, String(data.keys[k])); n++; } catch (e) {}
        });
        U.emit('backup', { action: 'import', count: n });
        resolve(n);
      };
      reader.readAsText(file, 'utf-8');
    });
  };

  Backup.clearAll = function () {
    keys().forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    U.emit('backup', { action: 'clear' });
  };
})();
