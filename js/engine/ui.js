// HUD·메뉴·모달 UI (DOM). 게임 로직은 모르고, 콜백으로만 통신한다.
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
  constructor() {
    this.sub = $('#sub'); this.subTxt = $('#sub .txt'); this.subWho = $('#sub .who'); this.promptEl = $('#prompt');
    this.toastEl = $('#toasts'); this.modalEl = $('#modal'); this.invEl = $('#inv');
    this.modalOpen = false; this.subScale = 1;
  }
  subtitle(text, who) {
    if (!text) { this.sub.classList.remove('on'); return; }
    if (this.showSpeaker === false) who = ''; this.subWho.textContent = who || ''; this.subWho.style.display = who ? '' : 'none'; this.subTxt.textContent = text; this.sub.classList.add('on');
  }
  prompt(name) { if (name) { this.promptEl.querySelector('.pt').textContent = name; this.promptEl.classList.add('on'); document.body.classList.add('hovering'); } else document.body.classList.remove('hovering');
    if (!name) this.promptEl.classList.remove('on'); }
  toast(title, desc, icon = '◆') {
    const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<div class="ti">${icon}</div><div><b>${esc(title)}</b><span>${esc(desc)}</span></div>`;
    this.toastEl.appendChild(t); requestAnimationFrame(() => t.classList.add('on'));
    setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 600); }, 4200);
  }
  inv(items) { this.invEl.innerHTML = items.map(i => `<span>${esc(i)}</span>`).join(''); }
  // 범용 모달
  modal(html, cls = '', onClose) {
    this.closeModal(true);
    const m = this.modalEl; m.className = 'modal on ' + cls; m.innerHTML = `<div class="mbox">${html}<button class="mclose" aria-label="닫기">닫기</button></div>`;
    this.modalOpen = true; this._onClose = onClose;
    m.querySelector('.mclose').onclick = () => this.closeModal();
    return m;
  }
  closeModal(silent) { if (!this.modalOpen) return; this.modalOpen = false; this.modalEl.className = 'modal'; this.modalEl.innerHTML = ''; const f = this._onClose; this._onClose = null; if (!silent) f?.(); else f?.(); }
  doc(title, body, cls = 'paper') { return this.modal(`<div class="doc ${cls}"><h3>${esc(title)}</h3><pre>${esc(body)}</pre></div>`, 'm-doc'); }
  computer(title, mails, onOpen, onClose) {
    const m = this.modal(`<div class="pc"><div class="pchead">${esc(title)}</div><div class="pclist"></div><div class="pcread"></div></div>`, 'm-pc', onClose);
    const list = m.querySelector('.pclist'), read = m.querySelector('.pcread');
    const show = () => { read.style.display = 'none'; list.style.display = ''; };
    list.innerHTML = mails.map((x, i) => `<button class="mail ${x.read ? '' : 'new'}" data-i="${i}"><b>${esc(x.from)}</b><span>${esc(x.subject)}</span><em>${esc(x.date)}</em></button>`).join('') || '<p class="empty">받은 메일이 없습니다.</p>';
    list.querySelectorAll('.mail').forEach(b => b.onclick = () => { const x = mails[+b.dataset.i]; b.classList.remove('new'); list.style.display = 'none'; read.style.display = 'block';
      read.innerHTML = `<button class="back">← 목록</button><h3>${esc(x.subject)}</h3><div class="meta">${esc(x.from)} · ${esc(x.date)}</div><pre>${esc(x.bodyText)}</pre>`; read.querySelector('.back').onclick = show; onOpen(x); });
  }
  keypad(onCode) {
    const m = this.modal(`<div class="keypad"><div class="kdisp">····</div><div class="keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].map(k => `<button data-k="${k}">${k}</button>`).join('')}</div></div>`, 'm-keypad');
    let code = ''; const disp = m.querySelector('.kdisp');
    const upd = () => disp.textContent = (code + '····').slice(0, 4).replace(/\d/g, d => d);
    m.querySelectorAll('.keys button').forEach(b => b.onclick = () => { const k = b.dataset.k; if (k === 'C') code = ''; else if (k === 'OK') { onCode(code, ok => { disp.classList.toggle('ok', ok); disp.classList.toggle('bad', !ok); if (!ok) { code = ''; setTimeout(upd, 500); } }); return; } else if (code.length < 4) code += k; onCode.key?.(); upd(); });
    return m;
  }
  elevator(onBtn) {
    const m = this.modal(`<div class="elev"><div class="edisp" id="edisp">7</div><div class="ebtns">${[7, 6, 5, 4, 3, 2, 1, 0].map(k => `<button data-b="${k}">${k}</button>`).join('')}<button data-b="open">◀▶</button><button data-b="close">▶◀</button><button data-b="call" class="ecall">🔔 비상</button></div></div>`, 'm-elev');
    m.querySelectorAll('.ebtns button').forEach(b => b.onclick = () => { b.classList.add('lit'); setTimeout(() => b.classList.remove('lit'), 900); onBtn(b.dataset.b); });
    return m;
  }
  radio(freq, onTune) {
    const m = this.modal(`<div class="radio"><div class="rdisp">FM <b>${freq.toFixed(1)}</b></div><input type="range" min="880" max="1080" step="1" value="${Math.round(freq * 10)}"><div class="rhint">밀어서 주파수를 맞추세요</div></div>`, 'm-radio');
    const r = m.querySelector('input'), d = m.querySelector('.rdisp b');
    const f = e => { e.stopPropagation(); const v = r.value / 10; d.textContent = v.toFixed(1); onTune(v); };
    r.oninput = f; r.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
    return m;
  }
  phone(onAction, onClose) {
    const m = this.modal(`<div class="phone"><div class="pstat">통화 중</div><div class="ptime">00:00</div><div class="pbtns"><button data-a="hang" class="hang">끊기</button></div></div>`, 'm-phone', onClose);
    m.querySelectorAll('.pbtns button').forEach(b => b.onclick = () => onAction(b.dataset.a));
    return m;
  }
  inspect(name, desc, opts, onBtn) {
    const btns = (opts || []).map(o => `<button data-a="${o.a}">${esc(o.t)}</button>`).join('');
    const m = this.modal(`<div class="insp"><h3>${esc(name)}</h3><p>${esc(desc || '')}</p><div class="ibtns">${btns}</div><div class="ihint">드래그해서 돌려 보기</div></div>`, 'm-inspect');
    m.querySelectorAll('.ibtns button').forEach(b => b.onclick = () => onBtn(b.dataset.a));
    return m;
  }
  arcade(onPlay) { const m = this.modal(`<div class="arcade"><canvas width="320" height="240"></canvas><button class="coin">동전 넣기</button></div>`, 'm-arcade'); m.querySelector('.coin').onclick = onPlay; return m; }
  screen(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id); }
}
export { esc };
