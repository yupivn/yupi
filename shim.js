/* App Yupi – cầu nối: cho các bảng (vốn viết cho Claude) đọc/ghi Google Sheets qua máy chủ Apps Script.
   Mọi lệnh đều cần mật khẩu chung; máy chủ chỉ cho phép 2 sheet của shop. */
(function () {
  var API = 'https://script.google.com/macros/s/AKfycbyayRLS2PuNXLdV2TrxU2jwsCb5Z21Q90osSCXppZSq5sgqx3dVyjO_K2iYjGK5BnlX/exec';
  var KEY = 'yupi_pw';
  function getPw() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return window.__ypw || ''; } }
  function setPw(v) { window.__ypw = v; try { localStorage.setItem(KEY, v); } catch (e) {} }

  var waiting = [];
  function needPw() {
    return new Promise(function (res) {
      if (getPw()) return res(getPw());
      waiting.push(res);
      if (document.getElementById('ypw')) return;
      var show = function () {
        var d = document.createElement('div');
        d.id = 'ypw';
        d.innerHTML = '<div style="position:fixed;inset:0;z-index:99999;background:#14213d;display:grid;place-items:center;padding:24px;font-family:system-ui,sans-serif">' +
          '<div style="background:#fff;border-radius:22px;padding:24px 20px;width:100%;max-width:360px;text-align:center;color:#14213d">' +
          '<img src="icon-192.png" alt="" style="width:80px;height:80px;border-radius:20px;border:3px solid #c9a227">' +
          '<h2 style="margin:10px 0 4px;font-size:21px">Bảng tổng Yupi</h2><div style="color:#5b6785;font-size:14px">Nhập mật khẩu chung của shop</div>' +
          '<input id="ypwi" type="password" autocomplete="current-password" style="width:100%;box-sizing:border-box;margin-top:14px;font-size:16px;padding:12px;border:1px solid #d9dfec;border-radius:12px">' +
          '<div id="ypwe" style="color:#c8372d;font-size:13px;min-height:18px;margin-top:8px"></div>' +
          '<button id="ypwb" style="width:100%;border:0;border-radius:12px;padding:13px;font-size:16px;font-weight:700;background:#c9a227;color:#14213d">Vào app</button></div></div>';
        document.body.appendChild(d);
        var go = function () {
          var v = document.getElementById('ypwi').value.trim();
          if (!v) return;
          document.getElementById('ypwe').textContent = 'Đang kiểm tra…';
          call({ op: 'ping' }, v).then(function () {
            setPw(v); d.remove(); var w = waiting; waiting = []; w.forEach(function (f) { f(v); });
          }, function () { document.getElementById('ypwe').textContent = 'Sai mật khẩu, nhập lại giúp em.'; });
        };
        document.getElementById('ypwb').onclick = go;
        document.getElementById('ypwi').onkeydown = function (e) { if (e.key === 'Enter') go(); };
      };
      if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
    });
  }

  function call(body, pw) {
    body.pw = pw;
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.err === 'SAI_MAT_KHAU') { setPw(''); throw new Error('SAI_MAT_KHAU'); }
        if (!j || j.err) throw new Error(j && j.err || 'loi');
        return j;
      });
  }
  function api(body) {
    return needPw().then(function (pw) {
      return call(body, pw).catch(function (e) {
        if (String(e.message) === 'SAI_MAT_KHAU') return needPw().then(function (p2) { return call(body, p2); });
        throw e;
      });
    });
  }

  var watchers = [];
  function fetchOnce(w) {
    return api({ op: 'get', id: w.args.spreadsheetId, range: w.args.range }).then(function (j) {
      w.cb({ type: 'data', result: { payload: { range: w.args.range, values: j.values }, cache: { storedAt: Date.now() } } });
    }, function (e) { w.cb({ type: 'error', error: String(e && e.message || e) }); });
  }
  var mcp = {
    watchTool: function (server, tool, args, cb, opts) {
      var w = { args: args, cb: cb };
      watchers.push(w);
      fetchOnce(w);
      var ms = (opts && opts.refetchInterval) || 60000;
      w.t = setInterval(function () { if (document.visibilityState === 'visible') fetchOnce(w); }, Math.max(ms, 30000));
      return function () { clearInterval(w.t); watchers = watchers.filter(function (x) { return x !== w; }); };
    },
    callTool: function (server, tool, args) {
      var op = tool === 'update_values' ? 'update' : tool === 'append_values' ? 'append' : tool === 'get_values' ? 'get' : null;
      if (!op) return Promise.reject(new Error('Lệnh chưa hỗ trợ: ' + tool));
      return api({ op: op, id: args.spreadsheetId, range: args.range, values: args.values }).then(function (j) {
        if (op !== 'get') setTimeout(function () { watchers.forEach(fetchOnce); }, 800);
        return { payload: { range: args.range, values: j.values || [] } };
      });
    },
    invalidate: function () { watchers.forEach(fetchOnce); }
  };
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') watchers.forEach(fetchOnce); });

  window.claude = {
    use: function (name) {
      if (name === 'mcp') return Promise.resolve(mcp);
      if (name === 'permissions') return Promise.resolve({ request: function () { return Promise.resolve({ mcp: 'granted' }); }, manage: function () { return Promise.resolve(); } });
      return Promise.resolve(null);
    }
  };

  // Nút quay về Bảng tổng trên các bảng con
  var page = location.pathname.split('/').pop();
  if (page && page !== 'index.html') {
    var addBack = function () {
      var b = document.createElement('a');
      b.href = './'; b.textContent = '‹ Bảng tổng';
      b.setAttribute('style', 'position:fixed;left:12px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:9999;background:#14213d;color:#fff;font:700 14px system-ui,sans-serif;padding:11px 16px;border-radius:99px;text-decoration:none;box-shadow:0 6px 18px rgba(0,0,0,.3);border:2px solid #c9a227');
      document.body.appendChild(b);
    };
    if (document.body) addBack(); else document.addEventListener('DOMContentLoaded', addBack);
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
