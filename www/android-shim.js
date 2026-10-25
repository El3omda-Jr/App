/* Android bridge for the AQUALIMA app. Runs inside each app frame.
   Makes saving files, sharing, printing / Save-as-PDF and external links work in the APK WebView.
   Does nothing in a normal browser. */
(function () {
  var C = window.Capacitor || (window.parent && window.parent !== window && window.parent.Capacitor);
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) {
    console.log('AQUALIMA shim: not native platform');
    return;
  }
  try {
    var FS = C.registerPlugin('Filesystem'), SH = C.registerPlugin('Share'),
        PR = C.registerPlugin('PrintPlugin'), BR = C.registerPlugin('Browser');
    // Debug toast that the shim loaded
    setTimeout(function() {
      try {
        var d = document.createElement('div');
        d.textContent = 'Shim OK - PrintPlugin: ' + (PR ? 'موجود' : 'مش موجود');
        d.style.cssText = 'position:fixed;z-index:2147483647;left:50%;top:20px;transform:translateX(-50%);background:#087c91;color:#fff;padding:8px 14px;border-radius:10px;font:700 13px Tahoma,Arial;';
        (document.body || document.documentElement).appendChild(d);
        setTimeout(function () { d.remove(); }, 4000);
      } catch(e){}
    }, 1500);
  } catch(err) {
    alert('Shim error: ' + err);
    return;
  }

  function errText(e) { return (e && (e.message || e.errorMessage || e.code)) || String(e); }
  function isCancel(e) { return /cancel/i.test(errText(e)); }
  function toast(t) {
    try {
      var d = document.createElement('div');
      d.textContent = t;
      d.style.cssText = 'position:fixed;z-index:2147483647;left:50%;bottom:24px;transform:translateX(-50%);background:#142b46;color:#fff;padding:10px 18px;border-radius:12px;font:700 14px Tahoma,Arial;box-shadow:0 4px 16px rgba(0,0,0,.3)';
      (document.body || document.documentElement).appendChild(d);
      setTimeout(function () { d.remove(); }, 3000);
    } catch (e) {}
  }
  function fail(prefix, e) { if (isCancel(e)) return; alert(prefix + ': ' + errText(e)); }

  /* ---------- blobs: the app revokes object URLs right after click() ---------- */
  var blobs = {}, origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (b) { var u = origCreate(b); blobs[u] = b; return u; };

  function toB64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { rej(r.error || new Error('read failed')); };
      r.readAsDataURL(blob);
    });
  }
  function cleanName(n) { return String(n || 'file').replace(/[\\\/:*?"<>|]+/g, '_'); }

  /* save the file, then open the Android share sheet (Save to Files / Drive / WhatsApp ...) */
  function saveAndShare(blob, name) {
    name = cleanName(name);
    toast('جارٍ تجهيز الملف…');
    return toB64(blob)
      .then(function (d) { return FS.writeFile({ path: name, data: d, directory: 'CACHE' }); })
      .then(function (r) { return SH.share({ title: name, url: r.uri, dialogTitle: 'حفظ / مشاركة' }); })
      .catch(function (e) { fail('تعذر حفظ أو مشاركة الملف', e); });
  }
  function fetchBlob(url) {
    return blobs[url] ? Promise.resolve(blobs[url]) : fetch(url).then(function (r) { return r.blob(); });
  }

  /* ---------- downloads (<a download href=blob:|data:>) ---------- */
  function isDl(a) { return a && a.hasAttribute && a.hasAttribute('download') && /^(blob:|data:)/.test(a.href); }
  function doDl(a) {
    var url = a.href, name = a.getAttribute('download') || 'file';
    fetchBlob(url).then(function (b) { return saveAndShare(b, name); }).catch(function (e) { fail('تعذر حفظ الملف', e); });
  }
  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (isDl(this)) { doDl(this); return; }
    return origClick.apply(this, arguments);
  };
  document.addEventListener('click', function (e) {
    var t = e.target, a = t && t.closest && t.closest('a[href]');
    if (!a) return;
    if (isDl(a)) { e.preventDefault(); doDl(a); return; }
    if (/^https?:/i.test(a.href)) { e.preventDefault(); BR.open({ url: a.href }).catch(function (x) { fail('تعذر فتح الرابط', x); }); }
  }, true);

  /* ---------- printing / Save as PDF ---------- */
  function sendPrint(html, name) {
    var id = String(Date.now()), size = 400000, total = Math.max(1, Math.ceil(html.length / size)), i = 0;
    function next() {
      if (i >= total) return Promise.resolve();
      var chunk = html.substr(i * size, size);
      return PR.printHtmlChunk({ id: id, index: i++, total: total, chunk: chunk, name: cleanName(name) }).then(next);
    }
    return next();
  }
  function snapshotDoc(doc) {
    var c = doc.cloneNode(true);
    try { /* keep what the user typed / chose */
      var o = doc.querySelectorAll('input,textarea,select'), n = c.querySelectorAll('input,textarea,select');
      for (var i = 0; i < o.length && i < n.length; i++) {
        var a = o[i], b = n[i], tag = a.tagName;
        if (tag === 'TEXTAREA') b.textContent = a.value;
        else if (tag === 'SELECT') { for (var j = 0; j < b.options.length; j++) { if (a.options[j] && a.options[j].selected) b.options[j].setAttribute('selected', ''); else b.options[j].removeAttribute('selected'); } }
        else if (a.type === 'checkbox' || a.type === 'radio') { if (a.checked) b.setAttribute('checked', ''); else b.removeAttribute('checked'); }
        else b.setAttribute('value', a.value);
      }
      var oc = doc.querySelectorAll('canvas'), nc = c.querySelectorAll('canvas');
      for (var k = 0; k < oc.length && k < nc.length; k++) {
        try { var im = doc.createElement('img'); im.src = oc[k].toDataURL('image/png'); im.style.cssText = oc[k].style.cssText; im.width = oc[k].width; im.height = oc[k].height; nc[k].replaceWith(im); } catch (e) {}
      }
    } catch (e) {}
    c.querySelectorAll('script,noscript').forEach(function (s) { s.remove(); });
    return '<!doctype html>' + c.documentElement.outerHTML;
  }
  function printNow(html, name) {
    toast('جارٍ تجهيز الطباعة…');
    if (!PR || !PR.printHtmlChunk) {
      alert('PrintPlugin مش موجود أو مش شغال');
      return Promise.reject('no plugin');
    }
    return sendPrint(html, name).catch(function (e) { fail('تعذر الطباعة', e); });
  }
  window.print = function () { /* snapshot synchronously: the app cleans up right after calling print() */
    toast('تم استدعاء window.print');
    var html;
    try { html = snapshotDoc(document); } catch (e) { fail('تعذر الطباعة', e); return; }
    printNow(html, document.title || 'AQUALIMA');
  };

  /* ---------- window.open(): used for contracts / receipts (print) and the water-analysis file ---------- */
  var EXT = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
  function handleOpenedDoc(html) {
    var m = html.match(/<iframe[^>]*\ssrc=["'](data:[^"']+)["']/i);
    if (m) {
      var mime = (m[1].match(/^data:([^;,]+)/) || [])[1] || '';
      fetch(m[1]).then(function (r) { return r.blob(); })
        .then(function (b) { return saveAndShare(b, 'AQUALIMA-analysis.' + (EXT[mime] || 'bin')); })
        .catch(function (e) { fail('تعذر فتح الملف', e); });
      return;
    }
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    printNow(html, 'AQUALIMA');
  }
  window.open = function (url) {
    if (url && url !== 'about:blank') {
      if (/^https?:/i.test(url)) BR.open({ url: url }).catch(function (e) { fail('تعذر فتح الرابط', e); });
      return { closed: false, focus: function () {}, close: function () {} };
    }
    var parts = [], done = false, timer = null;
    function flush() { if (done) return; done = true; clearTimeout(timer); handleOpenedDoc(parts.join('')); }
    var fake = { closed: false, focus: function () {}, close: function () {}, print: flush };
    fake.document = {
      open: function () { parts = []; done = false; return fake.document; },
      write: function () { for (var i = 0; i < arguments.length; i++) parts.push(String(arguments[i])); clearTimeout(timer); timer = setTimeout(flush, 600); },
      writeln: function () { for (var i = 0; i < arguments.length; i++) parts.push(String(arguments[i])); parts.push('\n'); clearTimeout(timer); timer = setTimeout(flush, 600); },
      close: flush
    };
    return fake;
  };
})();
