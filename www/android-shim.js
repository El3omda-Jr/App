/* Android bridge: makes file downloads and printing work inside the APK WebView.
   Does nothing in a normal browser. Loaded inside each embedded app frame. */
(function () {
  var C = window.Capacitor || (window.parent && window.parent.Capacitor);
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  var FS = C.registerPlugin('Filesystem'), SH = C.registerPlugin('Share'), PR = C.registerPlugin('PrintPlugin');

  // Remember blobs: the app revokes object URLs right after click().
  var blobs = {}, origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (b) { var u = origCreate(b); blobs[u] = b; return u; };

  function toB64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1] || ''); };
      r.onerror = rej; r.readAsDataURL(blob);
    });
  }
  function saveAndShare(a) {
    var url = a.href, name = (a.getAttribute('download') || 'file').replace(/[\\/:*?"<>|]+/g, '_');
    var get = blobs[url] ? Promise.resolve(blobs[url]) : fetch(url).then(function (r) { return r.blob(); });
    get.then(toB64)
      .then(function (d) { return FS.writeFile({ path: name, data: d, directory: 'CACHE' }); })
      .then(function (r) { return SH.share({ title: name, url: r.uri, dialogTitle: 'حفظ / مشاركة' }); })
      .catch(function (e) { if (e && /cancel/i.test(e.message || '')) return; alert('تعذر حفظ الملف: ' + (e && e.message || e)); });
  }
  function isDl(a) { return a && a.hasAttribute && a.hasAttribute('download') && /^(blob:|data:)/.test(a.href); }

  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (isDl(this)) { saveAndShare(this); return; }
    return origClick.apply(this, arguments);
  };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[download]');
    if (isDl(a)) { e.preventDefault(); saveAndShare(a); }
  }, true);

  // Printing: send a script-free copy of the page to the native print service (Save as PDF / printers).
  window.print = function () {
    var d = document.cloneNode(true);
    d.querySelectorAll('script').forEach(function (s) { s.remove(); });
    PR.printHtml({ html: '<!doctype html>' + d.documentElement.outerHTML, name: (document.title || 'AQUALIMA').replace(/[\\/:*?"<>|]+/g, '_') })
      .catch(function (e) { alert('تعذر الطباعة: ' + (e && e.message || e)); });
  };
})();
