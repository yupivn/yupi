/* App Yupi – cầu nối: cho các bảng (vốn viết cho Claude) đọc/ghi dữ liệu.
   08/11/2026: thêm BẢN NHANH (Cloudflare Worker + D1). Bản cũ (Apps Script + Google Sheet) vẫn chạy song song đến khi chị duyệt.
   - Mở app: hiện ngay dữ liệu đã lưu trên máy, tải bản mới phía sau
   - Bản nhanh: 1 lần hỏi/4 giây cho mọi bảng, chỉ tải bảng có thay đổi; bấm nút báo ✅ ngay khi máy chủ nhận, lỗi thì báo lại
   - 08/11 15h20 (chi Phuong): BỎ HẲN bản cũ (cả dự phòng). Máy chủ app lỗi -> dải đỏ báo + khóa nút + link duyệt tạm trên Telegram; chạy lại tự hết */
(function () {
  var API = 'https://script.google.com/macros/s/AKfycbyayRLS2PuNXLdV2TrxU2jwsCb5Z21Q90osSCXppZSq5sgqx3dVyjO_K2iYjGK5BnlX/exec';
  var CF = 'https://yupi-bang-tong.haphuongphuong96.workers.dev';
  var KEY = 'yupi_pw';
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  ls('yupi_nhanh', null); ls('yupi_tam_cu', null); ls('yupi_tam_ly', null);   // 08/11 15h20: không còn bản cũ
  var NHANH = true;
  var HOP = '1rl3Gtuy1zZ3Bxc8odMVNKdUNddHn0BFZUBNTKrcfL5M';
  var TG_DUYET = 'https://t.me/c/3986855047';   // nhóm Telegram "Zalo Gia Di – Tin khách"
  // 07/11: nho mat khau lau dai – luu ca localStorage lan cookie 1 nam (dien thoai hay xoa 1 trong 2), xin trinh duyet giu du lieu
  function getPw() {
    var v = ls(KEY) || '';
    if (!v) { var m = document.cookie.match(/(?:^|; )yupi_pw=([^;]*)/); if (m) { v = decodeURIComponent(m[1]); ls(KEY, v); } }
    return v || window.__ypw || '';
  }
  function setPw(v) {
    window.__ypw = v; ls(KEY, v || null);
    try { document.cookie = 'yupi_pw=' + encodeURIComponent(v) + '; max-age=' + (v ? 31536000 : 0) + '; path=/; SameSite=Lax; Secure'; } catch (e) {}
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

  // ---- thông báo nhỏ ----
  function toast(t, bad) {
    var f = function () {
      var d = document.createElement('div'); d.textContent = t;
      d.setAttribute('style', 'position:fixed;left:50%;transform:translateX(-50%);top:calc(12px + env(safe-area-inset-top));z-index:99998;max-width:92vw;background:' + (bad ? '#c8372d' : '#1f8a5e') + ';color:#fff;font:600 14px system-ui,sans-serif;padding:10px 16px;border-radius:12px;box-shadow:0 6px 18px rgba(0,0,0,.25)');
      document.body.appendChild(d); setTimeout(function () { d.remove(); }, bad ? 6000 : 2200);
    };
    if (document.body) f(); else document.addEventListener('DOMContentLoaded', f);
  }

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

  function post(url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.err === 'SAI_MAT_KHAU') { setPw(''); throw new Error('SAI_MAT_KHAU'); }
        if (!j || j.err) throw new Error(j && j.err || 'loi');
        return j;
      });
  }
  function call(body, pw) {
    body.pw = pw;
    return post(CF + '/api', body);   // 08/11 15h20: chỉ còn bản nhanh, lỗi thì báo lỗi (không lấy bản cũ)
  }
  function api(body) {
    return needPw().then(function (pw) {
      return call(body, pw).catch(function (e) {
        if (String(e.message) === 'SAI_MAT_KHAU') return needPw().then(function (p2) { return call(body, p2); });
        throw e;
      });
    });
  }

  // ---- cắt vùng A1 trên máy (dùng cho bản nhanh + bộ nhớ đệm) ----
  function colNum(s) { var n = 0; s = s.toUpperCase(); for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64); return n; }
  function tach(range) {
    var p = String(range || ''), i = p.lastIndexOf('!');
    var ten = i < 0 ? '' : p.slice(0, i).replace(/^'|'$/g, ''), a1 = i < 0 ? p : p.slice(i + 1);
    var m = a1.match(/^([A-Za-z]+)?(\d+)?(?::([A-Za-z]+)?(\d+)?)?$/) || [];
    return { ten: ten, c1: m[1] ? colNum(m[1]) : 1, r1: m[2] ? +m[2] : 1, c2: m[3] ? colNum(m[3]) : 1e9, r2: m[4] ? +m[4] : 1e9 };
  }
  function cat(rows, g) {
    var out = [];
    for (var r = g.r1; r <= Math.min(g.r2, rows.length); r++) {
      var x = (rows[r - 1] || []).slice(g.c1 - 1, g.c2 === 1e9 ? undefined : g.c2).map(function (v) { return v == null ? '' : String(v); });
      var n = x.length; while (n && x[n - 1] === '') n--; out.push(x.slice(0, n));
    }
    var k = out.length; while (k && !out[k - 1].length) k--; return out.slice(0, k);
  }
  function dmKey(w) { return 'yc:' + (NHANH ? 'n:' : 'c:') + w.args.spreadsheetId + '|' + w.args.range; }
  function giao(w, values, luc) { w.cb({ type: 'data', result: { payload: { range: w.args.range, values: values }, cache: { storedAt: luc || Date.now() } } }); }

  var watchers = [];
  // ---- bản cũ: mỗi bảng tự hỏi Apps Script ----
  function fetchOnce(w) {
    return api({ op: 'get', id: w.args.spreadsheetId, range: w.args.range }).then(function (j) {
      ls(dmKey(w), JSON.stringify({ t: Date.now(), v: j.values || [] }));
      giao(w, j.values);
    }, function (e) { w.cb({ type: 'error', error: String(e && e.message || e) }); });
  }
  // ---- bản nhanh: 1 lần hỏi cho mọi bảng, chỉ nhận bảng đổi ----
  var tabs = {};   // key sheet|ten -> {id, ten, v, rows}
  function tabKey(id, ten) { return id + '|' + ten; }
  function napTab(id, ten) {
    var k = tabKey(id, ten); if (tabs[k]) return tabs[k];
    var o = null; try { o = JSON.parse(ls('yt:' + k) || 'null'); } catch (e) {}
    return (tabs[k] = o || { id: id, ten: ten, v: 0, rows: null });
  }
  // ---- 08/11 15h20: máy chủ app lỗi -> dải đỏ + khóa nút + link duyệt tạm trên Telegram; chạy lại thì tự hết ----
  var loiTu = 0, mcLoi = '', lanKtCu = 0;
  function vn(s) { return s ? new Date(String(s).replace(' ', 'T') + 'Z').getTime() - 7 * 3600e3 : 0; }   // giờ VN dạng chữ -> ms
  function veDai() {
    var d = document.getElementById('yupi-mc-dai');
    if (!mcLoi) { if (d) d.remove(); return; }
    if (!document.body) return;
    if (!d) { d = document.createElement('div'); d.id = 'yupi-mc-dai'; d.setAttribute('style', 'position:sticky;top:0;z-index:9998;background:#c8372d;color:#fff;font:600 13px system-ui,sans-serif;padding:9px 12px;text-align:center;line-height:1.45'); document.body.insertBefore(d, document.body.firstChild); }
    d.innerHTML = '⛔ <b></b> – các nút tạm khóa, chờ máy chủ chạy lại. <a target="_blank" rel="noopener" style="color:#fff;text-decoration:underline;font-weight:800;margin-left:4px;white-space:nowrap">Duyệt tạm trên Telegram ›</a>';
    d.querySelector('b').textContent = mcLoi; d.querySelector('a').href = TG_DUYET;
  }
  function datLoi(ly) {
    if (ly === mcLoi) return; var coLoi = !!mcLoi; mcLoi = ly;
    try { document.body.classList.toggle('yupi-mcloi', !!ly); } catch (e) {}
    veDai(); try { window.dispatchEvent(new Event('yupi-mc')); } catch (e) {}
    if (ly) toast('⛔ ' + ly + ' – duyệt tin khách tạm trên Telegram', true);
    else if (coLoi) toast('✅ Máy chủ app chạy lại – bấm nút bình thường');
  }
  function loiSync(m) { if (m === 'SAI_MAT_KHAU') return; if (!loiTu) loiTu = Date.now(); if (Date.now() - loiTu > 12000) datLoi('Máy chủ app đang lỗi'); }
  function suKhoe(j) {
    loiTu = 0;
    var bay = vn(j.bay), cho = vn(j.cho), may = vn(j.may);
    var cu = bay && ((cho && bay - cho > 90000) || (may && bay - may > 90000));
    if (!cu) { datLoi(''); return; }
    if (Date.now() - lanKtCu < 30000) return;
    lanKtCu = Date.now();
    // máy chủ không thấy laptop -> hỏi Google xem laptop còn bật không (chỉ để báo đúng: máy chủ lỗi hay laptop tắt)
    post(API, { op: 'get', id: HOP, range: 'Trạng thái!A1:B3', pw: getPw() }).then(function (r) {
      var cap = ''; (r.values || []).forEach(function (x) { if (x[0] === 'Cập nhật lúc') cap = x[1]; });
      datLoi(cap && Date.now() - vn(cap) < 180000 ? 'Máy chủ app đang lỗi – laptop vẫn bật' : '');
    }).catch(function () {});
  }
  window.yupiMayChuLoi = function () { return mcLoi; };
  (function () { var f = function () { var s = document.createElement('style'); s.textContent = 'body.yupi-mcloi .b-ok,body.yupi-mcloi .b-acc,body.yupi-mcloi .b-soft{opacity:.45;filter:grayscale(1)}'; document.head.appendChild(s); }; if (document.head) f(); else document.addEventListener('DOMContentLoaded', f); })();
  var dangSync = false, lanSync = 0;
  function sync() {
    if (!NHANH || dangSync || !watchers.length) return Promise.resolve();
    dangSync = true; lanSync = Date.now();
    var ds = {}; watchers.forEach(function (w) { var g = tach(w.args.range); var t = napTab(w.args.spreadsheetId, g.ten); ds[tabKey(t.id, t.ten)] = { id: t.id, ten: t.ten, v: t.v }; });
    return api({ op: 'sync', tabs: Object.keys(ds).map(function (k) { return ds[k]; }) }).then(function (j) {
      dangSync = false; window.__yupiMay = j.may; window.__yupiCho = j.cho; window.__yupiBay = j.bay; suKhoe(j);
      (j.tabs || []).forEach(function (t) {
        var k = tabKey(t.id, t.ten); tabs[k] = { id: t.id, ten: t.ten, v: t.v, rows: t.rows };
        try { ls('yt:' + k, JSON.stringify(tabs[k])); } catch (e) {}
        watchers.forEach(function (w) { var g = tach(w.args.range); if (w.args.spreadsheetId === t.id && g.ten === t.ten) giao(w, cat(t.rows, g)); });
      });
    }, function (e) { dangSync = false; var m = String(e && e.message || e); loiSync(m); watchers.forEach(function (w) { w.cb({ type: 'error', error: 'Máy chủ nhanh: ' + m }); }); });
  }
  if (NHANH) setInterval(function () { if (document.visibilityState === 'visible' && Date.now() - lanSync > 3500) sync(); }, 1000);

  var mcp = {
    watchTool: function (server, tool, args, cb, opts) {
      var w = { args: args, cb: cb };
      watchers.push(w);
      // hiện ngay dữ liệu đã lưu trên máy
      try {
        if (NHANH) { var g = tach(args.range), t = napTab(args.spreadsheetId, g.ten); if (t.rows) setTimeout(function () { giao(w, cat(t.rows, g), 1); }, 0); }
        else { var c = JSON.parse(ls(dmKey(w)) || 'null'); if (c) setTimeout(function () { giao(w, c.v, c.t); }, 0); }
      } catch (e) {}
      if (NHANH) { setTimeout(sync, 30); return function () { watchers = watchers.filter(function (x) { return x !== w; }); }; }
      fetchOnce(w);
      var ms = (opts && opts.refetchInterval) || 60000;
      w.t = setInterval(function () { if (document.visibilityState === 'visible') fetchOnce(w); }, Math.max(ms, 30000));
      return function () { clearInterval(w.t); watchers = watchers.filter(function (x) { return x !== w; }); };
    },
    callTool: function (server, tool, args) {
      var op = tool === 'update_values' ? 'update' : tool === 'append_values' ? 'append' : tool === 'get_values' ? 'get' : null;
      if (!op) return Promise.reject(new Error('Lệnh chưa hỗ trợ: ' + tool));
      var t0 = Date.now();
      // 08/11 15h20: máy chủ app đang lỗi -> khóa nút ghi, báo rõ (không gửi hụt)
      if (op !== 'get' && mcLoi) { toast('⛔ ' + mcLoi + ' – chưa gửi được. Duyệt tin khách tạm trên Telegram', true); return Promise.reject(new Error(mcLoi)); }
      return api({ op: op, id: args.spreadsheetId, range: args.range, values: args.values }).then(function (j) {
        if (op !== 'get') {
          toast('✅ Đã gửi' + (NHANH ? ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' giây) – máy đang làm' : ''));
          if (NHANH) { lanSync = 0; [300, 1200, 2500, 5000].forEach(function (ms) { setTimeout(sync, ms); }); }
          else setTimeout(function () { watchers.forEach(fetchOnce); }, 800);
        }
        return { payload: { range: args.range, values: j.values || [] } };
      }, function (e) { if (op !== 'get') toast('⚠️ Chưa gửi được: ' + (e && e.message || e) + ' – bấm lại giúp em', true); throw e; });
    },
    invalidate: function () { if (NHANH) { lanSync = 0; return sync(); } watchers.forEach(fetchOnce); }
  };
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { if (NHANH) sync(); else watchers.forEach(fetchOnce); } });

  // ảnh nhỏ quiz: bản nhanh tải từng ảnh từ máy chủ (trình duyệt tự lưu), không tải cả bảng ảnh
  var maAnh = null;
  window.yupiAnh = !NHANH ? null : function (k) {
    if (!maAnh) return '';
    return CF + '/anh/' + encodeURIComponent(k) + '?t=' + maAnh;
  };
  if (NHANH) needPw().then(function (pw) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode('yupi:' + pw)).then(function (h) {
      maAnh = Array.prototype.map.call(new Uint8Array(h), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('').slice(0, 16);
      window.dispatchEvent(new Event('yupi-anh'));
    });
  });

  window.claude = {
    use: function (name) {
      if (name === 'mcp') return Promise.resolve(mcp);
      if (name === 'permissions') return Promise.resolve({ request: function () { return Promise.resolve({ mcp: 'granted' }); }, manage: function () { return Promise.resolve(); } });
      return Promise.resolve(null);
    }
  };

  var page = location.pathname.split('/').pop();
  var them = function () {
    // Nút quay về Bảng tổng trên các bảng con
    if (page && page !== 'index.html') {
      var b = document.createElement('a');
      b.href = './'; b.textContent = '‹ Bảng tổng';
      b.setAttribute('style', 'position:fixed;left:12px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:9999;background:#14213d;color:#fff;font:700 14px system-ui,sans-serif;padding:11px 16px;border-radius:99px;text-decoration:none;box-shadow:0 6px 18px rgba(0,0,0,.3);border:2px solid #c9a227');
      document.body.appendChild(b);
    }
    // 08/11 15h20: không còn nút chuyển bản; máy chủ lỗi thì hiện dải đỏ
    veDai(); if (mcLoi) document.body.classList.add('yupi-mcloi');
  };
  if (document.body) them(); else document.addEventListener('DOMContentLoaded', them);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
