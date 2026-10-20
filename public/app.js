const $ = s => document.querySelector(s);
const K = { active: 'ai_active', sys: 'ai_sys', token: 'ai_token' };
const PROVIDERS = {
  groq: 'https://api.groq.com/openai/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  openrouter: 'https://openrouter.ai/api/v1',
  together: 'https://api.together.xyz/v1',
  custom: ''
};

const rd = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? d : JSON.parse(v);
  } catch {
    return d;
  }
};
const wr = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

const tokenGet = () => {
  try {
    return localStorage.getItem(K.token) || '';
  } catch {
    return '';
  }
};

const tokenSet = v => {
  try {
    if (v) localStorage.setItem(K.token, v);
    else localStorage.removeItem(K.token);
  } catch {}
};

try {
  localStorage.removeItem('ai_models');
} catch {}

let models = [];
let activeId = rd(K.active, null);
let sysPrompt = rd(K.sys, '');
let token = tokenGet();
let sessions = [];
let current = null;
let busy = false;
let editingId = null;
let keepIds = [];
let openSeq = 0;
const deleted = new Set();

const activeModel = () => models.find(m => m.id === activeId) || null;

function ensureActive() {
  if (!models.find(x => x.id === activeId)) {
    activeId = models[0] ? models[0].id : null;
    wr(K.active, activeId);
  }
}

async function api(path, opt = {}) {
  const r = await fetch(path, {
    ...opt,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opt.headers || {}) }
  });
  if (r.status === 401) {
    logout();
    throw new Error('Sesi berakhir');
  }
  if (!r.ok) {
    let msg = 'Permintaan gagal (' + r.status + ')';
    try {
      msg = (await r.json()).error || msg;
    } catch {}
    throw new Error(msg);
  }
  return r.json();
}

async function loadModels() {
  try {
    models = await api('/api/models');
    ensureActive();
  } catch (e) {
    toast(e.message);
  }
  renderModelBtn();
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast.id);
  toast.id = setTimeout(() => t.classList.add('hidden'), 2600);
}

function showLogin() {
  $('#app').classList.add('hidden');
  $('#login').classList.remove('hidden');
}

async function showApp() {
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  fit();
  $('#sysText').value = sysPrompt;
  newSession();
  renderModelBtn();
  await Promise.all([loadModels(), refreshList()]);
}

function logout() {
  token = '';
  tokenSet('');
  sessions = [];
  models = [];
  $('#messages').innerHTML = '';
  $('#sessionList').innerHTML = '';
  showLogin();
}

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('#le').textContent = '';
  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: $('#lu').value, password: $('#lp').value })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Gagal masuk');
    token = j.token;
    tokenSet(token);
    $('#lp').value = '';
    await showApp();
  } catch (err) {
    $('#le').textContent = err.message;
  }
});

$('#logout').addEventListener('click', logout);

const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

DOMPurify.addHook('afterSanitizeAttributes', n => {
  if (n.tagName === 'A') {
    n.setAttribute('target', '_blank');
    n.setAttribute('rel', 'noopener noreferrer');
  }
});

function renderMd(el, text) {
  const code = [];
  const math = [];
  const hide = (store, tag) => m => tag + (store.push(m) - 1) + 'X';
  const show = (store, tag, fn) => t => t.replace(new RegExp(tag + '(\\d+)X', 'g'), (m, i) => fn(store[i]));

  let t = text
    .replace(/```[\s\S]*?(?:```|$)/g, hide(code, 'CODEPH'))
    .replace(/`[^`\n]+`/g, hide(code, 'CODEPH'))
    .replace(/\$\$[\s\S]+?\$\$/g, hide(math, 'MATHPH'))
    .replace(/\\\[[\s\S]+?\\\]/g, hide(math, 'MATHPH'))
    .replace(/\\\([\s\S]+?\\\)/g, hide(math, 'MATHPH'))
    .replace(/(^|[^\\$\d])\$(?![\s$])([^$\n]*?[^\s$\\])\$(?![\d$])/g, (m, p, b) => p + hide(math, 'MATHPH')('$' + b + '$'));
  t = show(code, 'CODEPH', x => x)(t);

  const clean = DOMPurify.sanitize(marked.parse(t, { gfm: true, breaks: true }));
  el.innerHTML = show(math, 'MATHPH', esc)(clean);
  el.querySelectorAll('pre code').forEach(b => hljs.highlightElement(b));
  try {
    renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
        { left: '$', right: '$', display: false }
      ],
      throwOnError: false
    });
  } catch {}
}

function stick(force) {
  const m = $('#messages');
  if (force || m.scrollHeight - m.scrollTop - m.clientHeight < 140) m.scrollTop = m.scrollHeight;
}

function addMsg(role, text) {
  const w = document.createElement('div');
  w.className = 'msg ' + role;
  const c = document.createElement('div');
  c.className = 'bubble' + (role === 'assistant' ? ' md' : '');
  if (role === 'user') c.textContent = text;
  else renderMd(c, text);
  w.append(c);
  $('#messages').append(w);
  return c;
}

function drawChat() {
  $('#messages').innerHTML = '';
  $('#title').textContent = current.title;
  current.messages.forEach(m => addMsg(m.role, m.content || ''));
  stick(true);
}

function newSession() {
  openSeq++;
  current = { id: crypto.randomUUID(), title: 'Obrolan Baru', messages: [] };
  drawChat();
  renderList();
  closeSidebar();
}

function renderList() {
  const box = $('#sessionList');
  box.innerHTML = '';
  sessions.forEach(s => {
    const row = document.createElement('div');
    row.className = 'session' + (current && current.id === s.id ? ' active' : '');
    const t = document.createElement('span');
    t.className = 's-title';
    t.textContent = s.title;
    const d = document.createElement('button');
    d.className = 'icon-btn sm';
    d.textContent = '✕';
    d.addEventListener('click', ev => {
      ev.stopPropagation();
      removeSession(s.id);
    });
    row.append(t, d);
    row.addEventListener('click', () => openSession(s.id));
    box.append(row);
  });
}

async function refreshList() {
  try {
    sessions = await api('/api/sessions');
  } catch {}
  renderList();
}

async function openSession(id) {
  closeSidebar();
  if (current && current.id === id) return;
  const seq = ++openSeq;
  try {
    const r = await api('/api/sessions?id=' + id);
    if (seq !== openSeq) return;
    current = { id: r.id, title: r.title, messages: r.messages || [] };
    drawChat();
    renderList();
  } catch (e) {
    toast(e.message);
  }
}

async function removeSession(id) {
  if (!confirm('Hapus sesi ini?')) return;
  try {
    await api('/api/sessions?id=' + id, { method: 'DELETE' });
    deleted.add(id);
    sessions = sessions.filter(s => s.id !== id);
    if (current && current.id === id) newSession();
    else renderList();
  } catch (e) {
    toast(e.message);
  }
}

async function persist(sess) {
  if (deleted.has(sess.id)) return;
  try {
    await api('/api/sessions', {
      method: 'PUT',
      body: JSON.stringify({ id: sess.id, title: sess.title, messages: sess.messages })
    });
    await refreshList();
  } catch (e) {
    toast('Gagal menyimpan riwayat');
  }
}

function buildMessages(sess) {
  const m = activeModel();
  const parts = [sysPrompt.trim(), m && m.instruction ? m.instruction.trim() : ''].filter(Boolean);
  const list = [];
  if (parts.length) list.push({ role: 'system', content: parts.join('\n\n') });
  sess.messages.forEach(x => list.push({ role: x.role, content: x.content }));
  return list;
}

async function readSSE(r, onText) {
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let out = '';
  const handle = line => {
    const s = line.trim();
    if (!s.startsWith('data:')) return;
    const d = s.slice(5).trim();
    if (!d || d === '[DONE]') return;
    let j;
    try {
      j = JSON.parse(d);
    } catch {
      return;
    }
    if (j.error) throw new Error(typeof j.error === 'string' ? j.error : j.error.message || 'Error dari penyedia model');
    const c = j.choices?.[0]?.delta?.content;
    if (c) {
      out += c;
      onText(out);
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    lines.forEach(handle);
  }
  buf += dec.decode();
  if (buf) handle(buf);
  return out;
}

async function streamChat(m, msgs, onText) {
  const r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ modelId: m.id, messages: msgs })
  });
  if (r.status === 401) {
    logout();
    throw new Error('Sesi berakhir');
  }
  if (r.status === 429) throw Object.assign(new Error('Kuota habis'), { quota: true });
  if (!r.ok) {
    let msg = 'Error ' + r.status;
    try {
      msg = (await r.json()).error || msg;
    } catch {}
    throw new Error(msg);
  }
  return readSSE(r, onText);
}

function setBusy(v) {
  busy = v;
  $('#sendBtn').disabled = v;
}

async function send() {
  const text = $('#input').value.trim();
  if (!text || busy) return;
  const m = activeModel();
  if (!m) {
    toast('Tambahkan dan pilih model dulu');
    openSettings();
    return;
  }
  const sess = current;
  setBusy(true);
  sess.messages.push({ role: 'user', content: text });
  const firstMsg = sess.messages.length === 1;
  if (firstMsg) {
    sess.title = Array.from(text).slice(0, 40).join('');
    $('#title').textContent = sess.title;
  }
  $('#input').value = '';
  autosize();
  const userBubble = addMsg('user', text);
  const bubble = addMsg('assistant', '');
  bubble.textContent = '…';
  stick(true);

  let latest = '';
  let pending = null;
  const onText = t => {
    latest = t;
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = null;
      renderMd(bubble, latest);
      if (current === sess) stick();
    });
  };

  try {
    let out = '';
    try {
      out = await streamChat(m, buildMessages(sess), onText);
      if (!out.trim()) throw new Error('Model tidak mengembalikan jawaban');
    } catch (e) {
      if (pending) cancelAnimationFrame(pending);
      sess.messages.pop();
      if (firstMsg) sess.title = 'Obrolan Baru';
      if (current === sess) {
        userBubble.parentElement.remove();
        bubble.parentElement.remove();
        if (!$('#input').value) $('#input').value = text;
        autosize();
        if (firstMsg) $('#title').textContent = sess.title;
      }
      if (e.quota) showPopup(m.name);
      else toast(e.message || 'Terjadi kesalahan');
      return;
    }
    if (pending) cancelAnimationFrame(pending);
    sess.messages.push({ role: 'assistant', content: out });
    renderMd(bubble, out);
    if (current === sess) stick();
    await persist(sess);
  } finally {
    setBusy(false);
  }
}

$('#sendBtn').addEventListener('click', send);
$('#input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(pointer:fine)').matches) {
    e.preventDefault();
    send();
  }
});

function autosize() {
  const t = $('#input');
  t.style.height = 'auto';
  t.style.height = Math.min(t.scrollHeight, 140) + 'px';
}
$('#input').addEventListener('input', autosize);

function renderModelBtn() {
  const m = activeModel();
  $('#modelBtn').textContent = (m ? m.name : 'Pilih model') + ' ▾';
}

function renderModelMenu() {
  const menu = $('#modelMenu');
  menu.innerHTML = '';
  models.forEach(m => {
    const b = document.createElement('button');
    b.className = 'menu-item' + (m.id === activeId ? ' on' : '');
    b.textContent = m.name;
    b.addEventListener('click', () => {
      activeId = m.id;
      wr(K.active, activeId);
      renderModelBtn();
      menu.classList.add('hidden');
    });
    menu.append(b);
  });
  const manage = document.createElement('button');
  manage.className = 'menu-item';
  manage.textContent = '⚙ Kelola model';
  manage.addEventListener('click', () => {
    menu.classList.add('hidden');
    openSettings();
  });
  menu.append(manage);
}

$('#modelBtn').addEventListener('click', () => {
  const menu = $('#modelMenu');
  if (menu.classList.contains('hidden')) {
    renderModelMenu();
    menu.classList.remove('hidden');
  } else {
    menu.classList.add('hidden');
  }
});

document.addEventListener('click', e => {
  if (!e.target.closest('.model-row')) $('#modelMenu').classList.add('hidden');
});

function showPopup(name) {
  $('#popupText').textContent = 'Model ' + name + ' telah mencapai batas kuota, silakan pilih model lain atau ganti API Key.';
  $('#popup').classList.remove('hidden');
}
$('#popupClose').addEventListener('click', () => $('#popup').classList.add('hidden'));
$('#popupModel').addEventListener('click', e => {
  e.stopPropagation();
  $('#popup').classList.add('hidden');
  renderModelMenu();
  $('#modelMenu').classList.remove('hidden');
});
$('#popupKey').addEventListener('click', () => {
  $('#popup').classList.add('hidden');
  openSettings();
});

function openSettings() {
  closeSidebar();
  closeForm();
  renderSettings();
  $('#settings').classList.remove('hidden');
}
$('#openSettings').addEventListener('click', openSettings);
$('#closeSettings').addEventListener('click', () => $('#settings').classList.add('hidden'));
$('#settings').addEventListener('click', e => {
  if (e.target.id === 'settings') $('#settings').classList.add('hidden');
});

document.querySelectorAll('.tab').forEach(t =>
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('hidden', p.id !== t.dataset.tab));
  })
);

function renderSettings() {
  const box = $('#modelList');
  box.innerHTML = '';
  if (!models.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Belum ada model.';
    box.append(p);
  }
  models.forEach(m => {
    const card = document.createElement('div');
    card.className = 'model-card';
    const info = document.createElement('div');
    info.className = 'mc-info';
    const n = document.createElement('div');
    n.className = 'mc-name';
    n.textContent = m.name;
    const s = document.createElement('div');
    s.className = 'mc-sub';
    s.textContent = m.modelId + ' · ' + m.keys.length + ' key';
    info.append(n, s);
    const e = document.createElement('button');
    e.className = 'btn';
    e.textContent = 'Edit';
    e.addEventListener('click', () => openForm(m.id));
    const d = document.createElement('button');
    d.className = 'btn';
    d.textContent = 'Hapus';
    d.addEventListener('click', async () => {
      if (!confirm('Hapus model ' + m.name + '?')) return;
      try {
        await api('/api/models?id=' + m.id, { method: 'DELETE' });
        await loadModels();
        renderSettings();
      } catch (err) {
        toast(err.message);
      }
    });
    card.append(info, e, d);
    box.append(card);
  });
}

function renderKeyList() {
  const box = $('#mKeyList');
  box.innerHTML = '';
  const m = models.find(x => x.id === editingId);
  const list = m ? m.keys : [];
  box.parentElement.classList.toggle('hidden', !list.length);
  list.forEach(k => {
    const on = keepIds.includes(k.id);
    const row = document.createElement('div');
    row.className = 'key-item' + (on ? '' : ' off');
    const t = document.createElement('span');
    t.textContent = k.mask;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon-btn sm';
    b.textContent = on ? '✕' : '↺';
    b.addEventListener('click', () => {
      keepIds = on ? keepIds.filter(x => x !== k.id) : [...keepIds, k.id];
      renderKeyList();
    });
    row.append(t, b);
    box.append(row);
  });
}

function openForm(id) {
  editingId = id || null;
  const m = models.find(x => x.id === id) || { name: '', provider: 'groq', baseUrl: PROVIDERS.groq, modelId: '', instruction: '', keys: [] };
  keepIds = m.keys.map(k => k.id);
  $('#mName').value = m.name;
  $('#mProvider').value = m.provider || 'custom';
  $('#mBase').value = m.baseUrl;
  $('#mModel').value = m.modelId;
  $('#mInstr').value = m.instruction || '';
  $('#mKeys').value = '';
  renderKeyList();
  $('#modelForm').classList.remove('hidden');
  $('#addModel').classList.add('hidden');
  $('#modelForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function closeForm() {
  $('#modelForm').classList.add('hidden');
  $('#addModel').classList.remove('hidden');
  editingId = null;
  keepIds = [];
}

$('#addModel').addEventListener('click', () => openForm(null));
$('#cancelForm').addEventListener('click', closeForm);
$('#mProvider').addEventListener('change', e => {
  if (e.target.value !== 'custom') $('#mBase').value = PROVIDERS[e.target.value];
});

$('#modelForm').addEventListener('submit', async e => {
  e.preventDefault();
  const add = $('#mKeys').value.split('\n').map(x => x.trim()).filter(Boolean);
  if (!keepIds.length && !add.length) {
    toast('Minimal satu API Key');
    return;
  }
  const id = editingId || crypto.randomUUID();
  const body = {
    id,
    name: $('#mName').value.trim(),
    provider: $('#mProvider').value,
    baseUrl: $('#mBase').value.trim(),
    modelId: $('#mModel').value.trim(),
    instruction: $('#mInstr').value.trim(),
    keep: keepIds,
    add
  };
  try {
    await api('/api/models', { method: 'PUT', body: JSON.stringify(body) });
    await loadModels();
    if (!activeId) {
      activeId = id;
      wr(K.active, activeId);
      renderModelBtn();
    }
    closeForm();
    renderSettings();
    toast('Model disimpan');
  } catch (err) {
    toast(err.message);
  }
});

$('#saveSys').addEventListener('click', () => {
  sysPrompt = $('#sysText').value;
  wr(K.sys, sysPrompt);
  toast('Instruksi Khusus disimpan');
});

const sidebar = $('#sidebar');
const overlay = $('#overlay');
let pos = 0;

function setPos(p) {
  pos = Math.max(0, Math.min(1, p));
  sidebar.style.transform = 'translateX(' + (pos - 1) * 100 + '%)';
  overlay.style.opacity = pos;
  overlay.style.pointerEvents = pos > 0.01 ? 'auto' : 'none';
}
function openSidebar() {
  setPos(1);
}
function closeSidebar() {
  setPos(0);
}
$('#menuBtn').addEventListener('click', () => (pos > 0.5 ? closeSidebar() : openSidebar()));
overlay.addEventListener('click', closeSidebar);
$('#newChat').addEventListener('click', newSession);

let sx = 0, sy = 0, base = 0, mode = null, lastX = 0, lastT = 0, vel = 0;

document.addEventListener('touchstart', e => {
  if (e.target.closest('.modal')) return;
  const t = e.touches[0];
  sx = t.clientX;
  sy = t.clientY;
  lastX = sx;
  lastT = Date.now();
  vel = 0;
  base = pos;
  mode = pos > 0.5 || sx < 28 ? 'pending' : null;
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (!mode) return;
  const t = e.touches[0];
  const dx = t.clientX - sx;
  const dy = t.clientY - sy;
  if (mode === 'pending') {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      mode = 'drag';
      sidebar.classList.add('dragging');
      overlay.classList.add('dragging');
    } else {
      mode = null;
      return;
    }
  }
  if (mode === 'drag') {
    e.preventDefault();
    const now = Date.now();
    vel = (t.clientX - lastX) / Math.max(1, now - lastT);
    lastX = t.clientX;
    lastT = now;
    setPos(base + dx / sidebar.offsetWidth);
  }
}, { passive: false });

function endTouch() {
  if (mode === 'drag') {
    sidebar.classList.remove('dragging');
    overlay.classList.remove('dragging');
    if (Date.now() - lastT > 100) vel = 0;
    if (vel > 0.4) openSidebar();
    else if (vel < -0.4) closeSidebar();
    else setPos(pos > 0.5 ? 1 : 0);
  }
  mode = null;
}

document.addEventListener('touchend', endTouch);
document.addEventListener('touchcancel', endTouch);

function fit() {
  const v = window.visualViewport;
  if (!v) return;
  const off = Math.max(0, window.innerHeight - v.height - v.offsetTop);
  document.documentElement.style.setProperty('--kb', off + 'px');
  stick();
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', fit);
  window.visualViewport.addEventListener('scroll', fit);
}

new ResizeObserver(() => {
  document.documentElement.style.setProperty('--bar-h', $('#inputBar').offsetHeight + 'px');
  stick();
}).observe($('#inputBar'));

(async () => {
  if (!token) return showLogin();
  try {
    await api('/api/verify');
    await showApp();
  } catch {
    showLogin();
  }
})();
