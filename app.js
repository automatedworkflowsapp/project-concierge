/** ID anonimo di questo telefono: serve a bloccare solo lui dopo troppi PIN errati */
function deviceId() {
  var k = 'portin_device', v = null;
  try { v = localStorage.getItem(k); } catch (e) {}
  if (!v) {
    var a = new Uint8Array(12);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a); else for (var i = 0; i < 12; i++) a[i] = Math.random() * 256;
    v = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    try { localStorage.setItem(k, v); } catch (e) {}
  }
  return v;
}

/* ---------- Login Google ---------- */
var AUTH = {
  key: 'tc_idtoken',
  payload: function (t) {
    try {
      var b = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b.length % 4) b += '=';
      return JSON.parse(decodeURIComponent(escape(atob(b))));
    } catch (e) { return null; }
  },
  get: function () {
    var t = null;
    try { t = localStorage.getItem(AUTH.key); } catch (e) { t = AUTH.mem || null; }
    if (!t) return null;
    var p = AUTH.payload(t);
    if (!p || p.exp * 1000 < Date.now() + 60000) return null;   // scaduto (o quasi)
    return t;
  },
  email: function () { var t = AUTH.get(), p = t && AUTH.payload(t); return p ? p.email : ''; },
  set: function (t) { AUTH.mem = t; try { localStorage.setItem(AUTH.key, t); } catch (e) {} },
  clear: function () { AUTH.mem = null; try { localStorage.removeItem(AUTH.key); localStorage.removeItem('tc_brand'); } catch (e) {} },
  logout: function () {
    AUTH.clear();
    try { google.accounts.id.disableAutoSelect(); } catch (e) {}
    location.reload();
  },
  /** Risolve quando c'è un login valido; altrimenti mostra "Accedi con Google" */
  ready: function () {
    if (!APP.GOOGLE_CLIENT_ID || AUTH.get()) return Promise.resolve();
    return new Promise(function (res) {
      var box = document.getElementById('bootMsg');
      box.innerHTML = '<div class="login"><i class="ti ti-lock"></i><h1>Accesso riservato</h1>' +
        '<p class="sub">Entra con il tuo account Google autorizzato.</p><div id="gbtn"></div><p class="muted" id="gerr"></p></div>';
      var go = function () {
        google.accounts.id.initialize({
          client_id: APP.GOOGLE_CLIENT_ID, auto_select: true, cancel_on_tap_outside: false,
          callback: function (r) { AUTH.set(r.credential); box.textContent = 'Caricamento…'; res(); }
        });
        google.accounts.id.renderButton(document.getElementById('gbtn'),
          { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', locale: 'it', width: 260 });
        google.accounts.id.prompt();
      };
      var tries = 0, iv = setInterval(function () {
        if (window.google && google.accounts && google.accounts.id) { clearInterval(iv); go(); }
        else if (++tries > 60) { clearInterval(iv); document.getElementById('gerr').textContent = 'Login Google non disponibile: ricarica la pagina.'; }
      }, 200);
    });
  }
};

/** Nome e logo veri arrivano dal motore solo dopo il login (non sono pubblici su GitHub) */
function loadBrand() {
  try { var c = JSON.parse(localStorage.getItem('tc_brand') || 'null'); if (c) applyBrand(c); } catch (e) {}
  return run('brand').then(function (b) {
    try { localStorage.setItem('tc_brand', JSON.stringify(b)); } catch (e) {}
    applyBrand(b);
  }).catch(function () {});
}
function applyBrand(b) {
  if (!b || !b.name) return;
  APP.BRAND = { NAME: b.name, POWERED_BY: b.poweredBy || APP.BRAND.POWERED_BY, LOGO_URL: b.logo || '' };
  document.title = document.title.replace(/^Concierge/, b.name);
  var m = document.querySelector('meta[name="apple-mobile-web-app-title"]'); if (m) m.setAttribute('content', b.name);
  renderBrand();
}

function renderBrand() {
  var el = document.getElementById('brand');
  if (!el) return;
  var B = APP.BRAND;
  el.innerHTML = (B.LOGO_URL
    ? '<img src="' + esc(B.LOGO_URL) + '" alt="' + esc(B.NAME) + '">'
    : '<span class="wordmark">' + wordmark(B.NAME) + '</span>') +
    '<span class="powered">powered by ' + esc(B.POWERED_BY) + '</span>';
  var btn = document.getElementById('infoBtn'), help = document.getElementById('help');
  if (btn && help) {
    var who = AUTH.email();
    help.innerHTML = '<h3>Come funziona</h3>' + (window.HELP || '') +
      (who ? '<p class="muted" style="margin-top:12px">Accesso: ' + esc(who) + ' · <a href="#" id="logout">Esci</a></p>' : '');
    var lo = document.getElementById('logout');
    if (lo) lo.onclick = function (e) { e.preventDefault(); AUTH.logout(); };
    btn.onclick = function () { help.classList.toggle('hidden'); };
  }
}
function wordmark(name) {
  var p = String(name).split(' ');
  return '<b>' + esc(p[0]) + '</b>' + (p.length > 1 ? ' <span>' + esc(p.slice(1).join(' ')) + '</span>' : '');
}
document.addEventListener('DOMContentLoaded', renderBrand);
/** Chiama il motore Apps Script: POST {fn, args} → JSON {ok, data | error} */
function run(fn) {
  var args = [].slice.call(arguments, 1);
  var ctl = window.AbortController ? new AbortController() : null;
  var timer = ctl && setTimeout(function () { ctl.abort(); }, 30000);
  return fetch(APP.API_URL, {
    method: 'POST', redirect: 'follow', signal: ctl ? ctl.signal : undefined,
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ fn: fn, args: args, idToken: AUTH.get() })
  }).then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j.ok) {
        var msg = j.error || 'Errore';
        if (/^AUTH_(EXPIRED|REQUIRED)/.test(msg)) { AUTH.clear(); location.reload(); return new Promise(function () {}); }
        if (/^AUTH_DENIED/.test(msg)) { AUTH.clear(); var e = new Error(msg.replace(/^AUTH_DENIED:\s*/, '')); e.denied = true; throw e; }
        throw new Error(msg);
      }
      return j.data;
    })
    .catch(function (e) {
      if (e && e.denied) throw e;
      throw new Error(e && e.name === 'AbortError' ? 'Connessione lenta, riprova' : (e.message || 'Connessione non riuscita'));
    })
    .finally(function () { if (timer) clearTimeout(timer); });
}
function qs(k) { return new URLSearchParams(location.search).get(k) || ''; }
function $(s) { return document.querySelector(s); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function toast(msg, ms) {
  var t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function () { t.remove(); }, ms || 2600);
}
function hhmm(ts) { return new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); }
function dayTime(ts) {
  var d = new Date(ts), today = new Date();
  var same = d.toDateString() === today.toDateString();
  return (same ? 'oggi' : d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })) + ' ' + hhmm(ts);
}
function errMsg(e) {
  if (!e) return 'Errore';
  if (typeof e === 'string') return e;
  var m = e.message || e.errorMsg || (e.error && (e.error.msg || e.error.type)) || '';
  if (m && typeof m === 'object') m = m.errorMsg || m.msg || JSON.stringify(m);
  if (!m) { try { m = JSON.stringify(e); } catch (x) { m = 'Errore'; } }
  return String(m).replace(/^Error:\s*/, '');
}
/** Messaggi video comprensibili */
function videoErr(e) {
  var m = errMsg(e);
  if (/NotAllowed|permission|denied/i.test(m)) return 'Consenti fotocamera e microfono al browser e riprova';
  if (/NotFound|no device|Requested device/i.test(m)) return 'Fotocamera o microfono non trovati';
  if (/NotReadable|in use|Could not start/i.test(m)) return 'Fotocamera già in uso da un’altra app';
  return 'Video: ' + m;
}
function setRing(el, cls, icon) {
  el.className = 'ring ' + (cls || '');
  var i = el.querySelector('.ri');
  if (i) i.className = 'ri ti ti-' + (icon || 'door');
}

/** Posizione GPS: {lat,lng,acc} oppure {err:codice} (1 = permesso negato) */
function getLoc(timeout) {
  return new Promise(function (res) {
    if (!navigator.geolocation) return res({ err: 0 });
    navigator.geolocation.getCurrentPosition(
      function (p) { res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }); },
      function (e) { res({ err: e.code || 0 }); },
      { enableHighAccuracy: true, timeout: timeout || 12000, maximumAge: 20000 });
  });
}

function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { toast('Copiato'); }, function () { fallbackCopy(text); });
    }
  } catch (e) {}
  fallbackCopy(text);
}
function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast('Copiato'); } catch (e) { prompt('Copia il testo:', text); }
  ta.remove();
}

var EV = {
  call_open: ['Aperto su chiamata', 'g'], call_deny: ['Chiamata rifiutata', 'r'],
  call_timeout: ['Chiamata senza risposta', 'a'], pin_ok: ['Ingresso con PIN', 'g'],
  pin_fail: ['PIN errato', 'r'], pin_far: ['PIN da fuori zona', 'a'], pin_lock: ['Telefono bloccato (PIN)', 'r'],
  pass_new: ['Pass creato', 'b'], pass_revoke: ['Pass revocato', 'm'],
  door_error: ['Errore apertura', 'r'], door_test: ['Test apertura', 'b'], call_int: ['Videochiamata', 'b'], call_end: ['Videochiamata conclusa', 'm']
};
function logRow(x, withName) {
  var ev = EV[x.e] || [x.e, 'm'];
  var info = [withName ? x.name : '', x.d].filter(Boolean).join(' · ');
  return '<div class="logrow"><div><span class="pill ' + ev[1] + '">' + esc(ev[0]) + '</span>' +
    (info ? '<div class="muted" style="margin-top:4px">' + esc(info) + '</div>' : '') + '</div>' +
    '<div class="muted" style="white-space:nowrap">' + esc(dayTime(x.t)) + '</div></div>';
}

/* ---------- Videochiamata (Daily, call object con interfaccia nostra) ---------- */
var VC = {
  call: null,
  /** o = { url, token, cam, mic, local: <video>, remote: <video>, audio: <audio>, onRemote(bool), onLeft() } */
  join: function (o) {
    var D = window.Daily || window.DailyIframe;
    if (!D) return Promise.reject(new Error('Video non disponibile su questo browser'));
    VC.leave();
    // aspetta che l'eventuale chiamata precedente sia chiusa del tutto (Daily ne ammette una alla volta)
    return (VC.closing || Promise.resolve()).then(function () {
      var old = D.getCallInstance && D.getCallInstance();
      return old ? old.destroy().catch(function () {}) : null;
    }).then(function () { return VC._join(D, o); });
  },
  _join: function (D, o) {
    var c = VC.call = D.createCallObject({ subscribeToTracksAutomatically: true });
    c.on('track-started', function (e) {
      var p = e.participant, t = e.track;
      if (!p || !t) return;
      if (p.local) {
        if (t.kind === 'video' && o.local) VC.attach(o.local, t);
      } else if (t.kind === 'video' && e.type !== 'screenVideo') {
        if (o.remote) VC.attach(o.remote, t);
        if (o.onRemote) o.onRemote(true);
      } else if (t.kind === 'audio' && o.audio) {
        VC.attach(o.audio, t);
      }
    });
    c.on('track-stopped', function (e) {
      if (e.participant && !e.participant.local && e.track && e.track.kind === 'video' && o.onRemote) o.onRemote(false);
    });
    c.on('participant-left', function () { if (o.onRemote) o.onRemote(false); });
    c.on('left-meeting', function () { if (o.onLeft) o.onLeft(); });
    c.on('error', function (e) { console.error('daily error', e); if (o.onError) o.onError(videoErr(e)); });
    c.on('camera-error', function (e) { console.error('daily camera-error', e); if (o.onError) o.onError(videoErr(e && e.errorMsg ? e.errorMsg : e)); });
    return c.join({ url: o.url, token: o.token, startVideoOff: !o.cam, startAudioOff: !o.mic })
      .catch(function (e) { console.error('daily join', e); VC.leave(); throw new Error(videoErr(e)); });
  },
  attach: function (el, track) {
    el.srcObject = new MediaStream([track]);
    var p = el.play(); if (p && p.catch) p.catch(function () {});
  },
  /** da chiamare dentro un tocco dell'utente: sblocca l'audio su iPhone */
  unlockAudio: function (el) {
    if (!el) return;
    try { if (!el.srcObject) el.srcObject = new MediaStream(); var p = el.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  },
  cam: function (on) { if (VC.call) VC.call.setLocalVideo(on); },
  mic: function (on) { if (VC.call) VC.call.setLocalAudio(on); },
  leave: function () {
    var c = VC.call; VC.call = null;
    if (c) VC.closing = c.leave().catch(function () {}).then(function () { return c.destroy(); }).catch(function () {});
  }
};
