import { px } from './icons.js';
import * as D from './due.js';
import { openDb, callFn, DEMO } from './db.js';
import { VAPID_PUBLIC_KEY } from './config.js';

// ---------- constants ----------
const FLOORS = {
  house: { name: 'ทั้งบ้าน', icon: 'house', bg: '#FFEC89' },
  f1: { name: 'ชั้น 1', icon: 'sofa', bg: '#F6B7C3' },
  f2: { name: 'ชั้น 2', icon: 'bed', bg: '#BFDDF0' },
  out: { name: 'ภายนอก', icon: 'tree', bg: '#A8D5C2' },
};
const TYPES = {
  bill: { c: '#FFEC89', label: 'ค่าใช้จ่าย', icon: 'coin', hint: 'บิลรายเดือน / รายปี' },
  ins: { c: '#6BAA75', label: 'ประกัน', icon: 'shield', hint: 'รับประกันสินค้า งาน บ้าน' },
  mnt: { c: '#FFAD33', label: 'ดูแลรักษา', icon: 'wrench', hint: 'ล้างแอร์ ฉีดปลวก' },
  sav: { c: '#F6B7C3', label: 'เก็บเงิน', icon: 'piggy', hint: 'กองกลางเป้าหมาย' },
  sch: { c: '#6698CC', label: 'ตารางประจำ', icon: 'cal', hint: 'รถขยะ วันนัด' },
  note: { c: '#FFFFFF', label: 'โน้ต', icon: 'note', hint: 'จดข้อมูลทั่วไป' },
};
const TYPE_ORDER = ['bill', 'ins', 'mnt', 'sav', 'sch', 'note'];
const PAYER = { pojo: 'pojo จ่าย', mojo: 'mojo จ่าย', split: 'หารครึ่ง', alt: 'สลับเดือน' };
const UNIT = { d: 'วัน', m: 'เดือน', y: 'ปี' };
const ROOM_ICONS = ['sofa', 'bed', 'bath', 'pot', 'house', 'tree', 'snow', 'note'];
const CAT_COLORS = ['#FFAD33', '#F6B7C3', '#BFDDF0', '#A8D5C2', '#FFEC89', '#967CC7'];
const PAGE_BG = { home: '#FFAD33', floor: '#967CC7', room: '#6698CC', item: '#C28CAE', form: '#6BAA75', alerts: '#CC1400', cats: '#FFEC89', cat: '#A8D5C2', setup: '#FFAD33' };

// ---------- state ----------
const LS = { key: 'baanrao-key', who: 'baanrao-who' };
const S = { db: null, data: { rooms: [], cats: [], items: [], logs: [], settings: [] }, who: localStorage.getItem(LS.who), key: localStorage.getItem(LS.key), form: null, ui: {} };
const app = document.getElementById('app');

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => (n === null || n === undefined || n === '' ? '฿ —' : '฿' + Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 }));
const today = () => D.todayBKK();
const byId = (t, id) => (t === 'items' ? S.allItems || S.data.items : S.data[t]).find(x => x.id === id);
const setting = (k) => (S.data.settings.find(s => s.key === k) || {}).value;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
}
function placeLabel(it) {
  if (it.place === 'cat') { const c = byId('cats', it.cat_id); return 'น้องแมว' + (c ? ' › ' + c.name : ''); }
  const r = it.room_id && byId('rooms', it.room_id);
  return FLOORS[it.place].name + (r ? ' › ' + r.name : '');
}
function tag(t) { return `<span class="tag" style="background:${TYPES[t].c}">${TYPES[t].label}</span>`; }
function due(it) { return D.nextDue(it, today()); }
function urgent(n) { return n.left !== null && n.left <= 7; }
function sortByDue(items) {
  return items.map(it => ({ it, n: due(it) })).sort((a, b) => {
    if (a.n.left === null && b.n.left === null) return 0;
    if (a.n.left === null) return 1;
    if (b.n.left === null) return -1;
    return a.n.left - b.n.left;
  });
}
function meterPct(it, n) {
  const t = today();
  if (it.type === 'ins') {
    const end = n.date, s = D.parse(it.start_date);
    if (!end) return 0;
    if (!s) return Math.max(0, Math.min(100, n.left / 365 * 100));
    return Math.max(0, Math.min(100, D.daysBetween(t, end) / Math.max(1, D.daysBetween(s, end)) * 100));
  }
  if (it.type === 'mnt') {
    const last = D.parse(it.last_done);
    if (!n.date || !last) return n.date ? 50 : 0;
    return Math.max(0, Math.min(100, n.left / Math.max(1, D.daysBetween(last, n.date)) * 100));
  }
  if (it.type === 'sav') return it.goal ? Math.min(100, (Number(it.saved) || 0) / it.goal * 100) : 0;
  if (it.type === 'bill') return n.left === null ? 0 : Math.max(0, Math.min(100, n.left / 30 * 100));
  return 0;
}
function meter(it, n, h = 14) {
  const pct = meterPct(it, n);
  const fill = (n.overdue || n.expired || (urgent(n) && it.type !== 'sav')) ? '#CC1400' : TYPES[it.type].c === '#FFFFFF' ? '#BFDDF0' : TYPES[it.type].c;
  return `<div class="meter" style="height:${h}px"><i style="width:${pct}%;background:${fill}${pct === 0 ? ';border:none' : ''}"></i></div>`;
}
function dateBox(it, n) {
  if (!n.date) return `<div class="datebox" style="border-style:dashed;background:#FFF"><b style="font-size:14px">TBA</b><span>—</span></div>`;
  return `<div class="datebox" style="background:${TYPES[it.type].c}"><b>${n.date.getUTCDate()}</b><span>${D.MON[n.date.getUTCMonth()]}</span></div>`;
}
function leftSpan(it, n) {
  const txt = it.type === 'sch' && n.left !== null ? D.leftText(n.left) : D.leftText(n.left, it.type);
  return `<span style="font-size:12px;font-weight:700;white-space:nowrap" class="${(n.overdue || n.expired || (n.left !== null && n.left <= 3)) ? 'red' : ''}">${esc(n.left === null ? (it.type === 'mnt' ? 'ยังไม่นัด' : 'ยังไม่กำหนด') : txt)}</span>`;
}
function backbar(href, title, right = '') {
  return `<div class="between"><div style="display:flex;align-items:center;gap:12px;min-width:0"><a class="btn icon" href="${href}" aria-label="กลับ">${px('back', 3)}</a><h1 class="h" style="overflow-wrap:anywhere">${esc(title)}</h1></div>${right}</div>`;
}
function nav(active) {
  const on = (k) => active === k ? ' dark' : '';
  return `<nav class="nav" aria-label="เมนูหลัก">
    <a class="btn${on('home')}" href="#/">${px('house', 2)}หน้าแรก</a>
    <a class="btn" href="#/add" style="background:#FFEC89">${px('plus', 3)}เพิ่มรายการ</a>
    <a class="btn${on('alerts')}" href="#/alerts">${px('bell', 2)}แจ้งเตือน</a>
  </nav>`;
}
function itemRow(it, n, opts = {}) {
  return `<a class="row" href="#/item/${it.id}">
    ${dateBox(it, n)}
    <div class="col" style="gap:4px">
      <span style="font-size:15px;font-weight:600">${esc(it.title)}</span>
      <div class="wrap" style="gap:6px">${opts.noPlace ? '' : `<span class="tag">${px('pin', 2)}${esc(placeLabel(it))}</span>`}${tag(it.type)}</div>
    </div>
    ${leftSpan(it, n)}
  </a>`;
}
function meterRow(it) {
  const n = due(it);
  const sub = [it.provider, it.type === 'bill' ? money(it.amount) : null, it.type === 'ins' && it.dur_n ? `${it.dur_n} ${UNIT[it.dur_unit || 'y']}` : null, it.type === 'mnt' && it.every_months ? `ทุก ${it.every_months} เดือน` : null].filter(Boolean).join(' · ');
  const showMeter = ['ins', 'mnt', 'sav', 'bill'].includes(it.type);
  return `<a class="row" href="#/item/${it.id}" style="flex-direction:column;align-items:stretch;gap:8px">
    <div style="display:flex;gap:10px;align-items:center">
      <span class="ibox" style="width:40px;height:40px;background:${TYPES[it.type].c}">${px(TYPES[it.type].icon, 2)}</span>
      <div class="col"><span style="font-size:15px;font-weight:700">${esc(it.title)}</span><span class="muted">${esc(sub || TYPES[it.type].label)}</span></div>
      ${it.type === 'note' ? '' : leftSpan(it, n)}
    </div>
    ${showMeter ? meter(it, n) : ''}
    ${showMeter && n.date ? `<div class="px between" style="font-size:11px"><span>${it.type === 'sav' ? money(it.saved) + ' / ' + money(it.goal) : ''}</span><span>${D.thaiShort(n.date)}</span></div>` : ''}
  </a>`;
}
function groupByType(items, empty = 'ยังไม่มีรายการ') {
  if (!items.length) return `<div class="panel empty">${empty}</div>`;
  return TYPE_ORDER.filter(t => items.some(i => i.type === t)).map(t => `
    <section style="display:flex;flex-direction:column;gap:10px">
      <div>${tag(t)}</div>
      <div class="panel" style="overflow:hidden">${sortByDue(items.filter(i => i.type === t)).map(x => meterRow(x.it)).join('')}</div>
    </section>`).join('');
}
function monthBills(filter = () => true) {
  const t = today(), y = t.getUTCFullYear(), m = t.getUTCMonth();
  let total = 0, pojo = 0, mojo = 0, paid = 0, count = 0;
  S.data.items.filter(i => i.type === 'bill' && filter(i)).forEach(it => {
    let d = null;
    if (it.recur === 'monthly' && it.due_day) d = D.clampDate(y, m, it.due_day);
    else if (it.recur === 'yearly' && it.due_date) { const b = D.parse(it.due_date); if (b.getUTCMonth() === m) d = D.clampDate(y, m, b.getUTCDate()); }
    else if (it.due_date) { const b = D.parse(it.due_date); if (b.getUTCMonth() === m && b.getUTCFullYear() === y) d = b; }
    if (!d) return;
    count++;
    const last = D.parse(it.last_done);
    if (last && last >= d) paid++;
    const sh = D.billShare(it, d);
    total += Number(it.amount) || 0; pojo += sh.pojo; mojo += sh.mojo;
  });
  return { total, pojo, mojo, paid, count };
}

// ---------- data ----------
function doneInfo(it) {
  if (it.closed_at) return 'ปิดรายการแล้ว';
  if (it.type === 'ins' && due(it).expired) return 'หมดประกันแล้ว (ปิดอัตโนมัติ)';
  if (it.type === 'bill' && it.recur === 'once' && it.last_done) return 'จ่ายครบแล้ว (ปิดอัตโนมัติ)';
  return '';
}
async function reload() {
  S.data = await S.db.all();
  S.allItems = S.data.items;
  S.doneItems = S.allItems.filter(i => doneInfo(i));
  S.data.items = S.allItems.filter(i => !doneInfo(i));
}
function doneSection(pred) {
  const list = (S.doneItems || []).filter(pred);
  if (!list.length) return '';
  return `<details class="panel" style="overflow:hidden;background:#F3EDE2">
    <summary class="row" style="cursor:pointer;font-weight:700;list-style:none;border-top:none">✓ เสร็จแล้ว (${list.length}) <span class="muted" style="margin-left:auto">แตะเพื่อดู</span></summary>
    ${list.map(it => `<a class="row" href="#/item/${it.id}" style="opacity:.75"><span class="ibox" style="width:36px;height:36px;background:${TYPES[it.type].c}">${px(TYPES[it.type].icon, 2)}</span><div class="col"><span style="font-size:14px;font-weight:700;text-decoration:line-through">${esc(it.title)}</span><span class="muted">${esc(doneInfo(it))}</span></div></a>`).join('')}
  </details>`;
}
async function log(row) { try { await S.db.insert('logs', { who: S.who, ...row }); } catch (e) { console.warn(e); } }
async function notifyOther(title, body) { try { await callFn('notify', S.key, { from: S.who, title, body }); } catch (e) { console.warn(e); } }

// ---------- views ----------
function viewSetup() {
  document.documentElement.style.setProperty('--bg', PAGE_BG.setup);
  return `<div class="page" style="justify-content:center">
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px">${px('house', 9, 'บ้านเรา')}<h1 class="h" style="font-size:34px">บ้านเรา</h1></div>
    <form class="panel" id="setupForm" style="padding:18px;display:flex;flex-direction:column;gap:16px">
      ${DEMO ? '<p style="margin:0;font-size:14px"><b>โหมดทดลอง</b> ข้อมูลเก็บแค่ในเครื่องนี้ (ยังไม่ได้ตั้งค่า Supabase)</p>' : `<div class="field"><label class="lbl" for="hk">รหัสบ้าน</label><input id="hk" class="inp" autocomplete="off" autocapitalize="off" required value="${esc(S.key || '')}"></div>`}
      <div class="field"><span class="lbl">เครื่องนี้เป็นของใคร</span>
        <div class="grid2"><button type="button" class="btn big${S.who === 'pojo' ? ' on' : ''}" data-who="pojo">pojo</button><button type="button" class="btn big${S.who === 'mojo' ? ' on' : ''}" data-who="mojo">mojo</button></div>
      </div>
      <button class="btn big" style="background:#FFEC89">เริ่มใช้</button>
      <p id="setupErr" class="red" style="margin:0;font-size:14px;font-weight:700"></p>
    </form>
  </div>`;
}

function viewHome() {
  const items = S.data.items;
  const photo = setting('house_photo');
  const alerts = (pred) => items.filter(i => pred(i) && urgent(due(i))).length;
  const tile = (k) => {
    const f = FLOORS[k], a = alerts(i => i.place === k);
    const rooms = S.data.rooms.filter(r => r.floor === k).length;
    const sub = k === 'house' ? `${items.filter(i => i.place === 'house').length} รายการ` : `${rooms} ห้อง`;
    return `<a class="btn" href="#/floor/${k}" style="background:${f.bg};flex-direction:column;align-items:stretch;gap:10px;padding:12px;min-height:116px;box-shadow:4px 4px 0 #1A1A1A">
      <div class="between" style="align-items:flex-start">${px(f.icon, 3)}${a ? `<span class="badge">${a}</span>` : ''}</div>
      <div class="col" style="text-align:left"><span style="font-size:17px;font-weight:800">${f.name}</span><span class="muted" style="font-weight:500">${sub}</span></div></a>`;
  };
  const catAlert = alerts(i => i.place === 'cat');
  const list = sortByDue(items.filter(i => i.type !== 'note'));
  const dated = list.filter(x => x.n.left !== null).slice(0, 7);
  const tba = list.filter(x => x.n.left === null).slice(0, 3);
  const mb = monthBills();
  const t = today();
  const badge = items.filter(i => urgent(due(i))).length;
  return `<div class="page">
    <header class="between">
      <div class="col"><span class="px" style="font-size:13px">${String(t.getUTCDate()).padStart(2, '0')}.${String(t.getUTCMonth() + 1).padStart(2, '0')}.${t.getUTCFullYear() + 543}</span><h1 class="h" style="font-size:34px">บ้านเรา</h1></div>
      <a class="btn" href="#/alerts" aria-label="แจ้งเตือน ${badge} รายการ" style="width:52px;height:52px;padding:0;position:relative;background:#FFEC89">${px('bell', 3)}${badge ? `<span class="badge" style="position:absolute;top:-10px;right:-10px">${badge}</span>` : ''}</a>
    </header>
    <section class="panel hero" aria-label="รูปบ้าน">
      ${photo ? `<img class="photo" src="${photo}" alt="รูปบ้านเรา">` : `
        <div style="position:absolute;top:16px;left:18px">${px('cloud', 4)}</div>
        <div style="position:absolute;top:44px;left:38%">${px('cloud', 3)}</div>
        <div style="position:absolute;top:14px;right:28%">${px('sun', 4)}</div>
        <div style="position:absolute;bottom:0;left:0;right:0;height:22px;background:#6BAA75;border-top:2.5px solid #1A1A1A"></div>
        <div style="position:relative;margin-bottom:18px">${px('house', 10)}</div>
        <div style="position:absolute;bottom:18px;right:22px">${px('tree', 5)}</div>`}
      <label class="btn sm" style="position:absolute;top:12px;right:12px;background:#FFEC89">${photo ? 'เปลี่ยนรูป' : '+ รูปบ้าน'}<input type="file" accept="image/*" id="housePhoto" class="sr"></label>
    </section>
    <section style="display:flex;flex-direction:column;gap:12px">
      <h2 class="h">เลือกชั้น</h2>
      <div class="grid2">${['house', 'f1', 'f2', 'out'].map(tile).join('')}</div>
      <a class="btn" href="#/cats" style="background:#967CC7;justify-content:flex-start;gap:14px;padding:12px;min-height:84px;box-shadow:4px 4px 0 #1A1A1A">
        ${px('cat', 4)}<div class="col" style="text-align:left"><span style="font-size:17px;font-weight:800">น้องแมว</span><span class="muted" style="font-weight:500">${S.data.cats.length ? S.data.cats.map(c => esc(c.name)).join(' · ') : 'อาหาร · ทราย · วัคซีน · หาหมอ'}</span></div>
        ${catAlert ? `<span class="badge">${catAlert}</span>` : ''}</a>
    </section>
    <section style="display:flex;flex-direction:column;gap:12px">
      <div class="between"><h2 class="h">ใกล้ถึงกำหนด</h2><a href="#/alerts" style="font-size:13px;font-weight:700">ดูทั้งหมด ›</a></div>
      <div class="panel" style="overflow:hidden">${[...dated, ...tba].map(x => itemRow(x.it, x.n)).join('') || '<div class="empty">ยังไม่มีรายการ กด + เพิ่มรายการ ได้เลย</div>'}</div>
    </section>
    <section class="panel" style="padding:14px;display:flex;flex-direction:column;gap:10px">
      <div class="between"><div style="display:flex;align-items:center;gap:8px">${px('coin', 3)}<span style="font-size:15px;font-weight:700">ค่าใช้จ่ายเดือน ${D.MON[t.getUTCMonth()]}</span></div><span class="px" style="font-size:13px;font-weight:700">${mb.paid}/${mb.count} PAID</span></div>
      <div class="meter" style="height:18px;display:flex">${mb.total ? `<i style="width:${mb.pojo / mb.total * 100}%;background:#967CC7"></i><i style="width:${mb.mojo / mb.total * 100}%;background:#F6B7C3;border:none"></i>` : ''}</div>
      <div class="between" style="font-size:13px;font-weight:600"><span>pojo ${money(mb.pojo)}</span><span>mojo ${money(mb.mojo)}</span><span>รวม ${money(mb.total)}</span></div>
    </section>
  </div>${nav('home')}`;
}

function viewFloor(f) {
  const F = FLOORS[f]; if (!F) return viewHome();
  const tabs = Object.keys(FLOORS).map(k => `<a class="btn sm${k === f ? ' on' : ''}" href="#/floor/${k}"${k === f ? ' aria-current="page"' : ''} style="white-space:nowrap">${FLOORS[k].name}</a>`).join('');
  let body = '';
  if (f === 'house') {
    body = groupByType(S.data.items.filter(i => i.place === 'house'), 'ยังไม่มีรายการของทั้งบ้าน');
    body += `<a class="btn ghost" href="#/add?place=house" style="min-height:56px">+ เพิ่มรายการของทั้งบ้าน</a>`;
    body += doneSection(i => i.place === 'house');
  } else {
    const rooms = S.data.rooms.filter(r => r.floor === f).sort((a, b) => (a.sort || 0) - (b.sort || 0) || String(a.created_at).localeCompare(b.created_at));
    body = rooms.map(r => {
      const its = S.data.items.filter(i => i.room_id === r.id);
      const top = sortByDue(its).find(x => x.n.left !== null);
      const nx = top ? `<span style="font-size:13px;font-weight:700" class="${urgent(top.n) ? 'red' : ''}">${esc(top.it.title)} · ${esc(D.leftText(top.n.left, top.it.type))}</span>` : '';
      return `<a class="btn" href="#/room/${r.id}" style="justify-content:flex-start;gap:14px;padding:12px;min-height:84px;box-shadow:4px 4px 0 #1A1A1A">
        <span class="ibox" style="width:56px;height:56px;background:${F.bg}">${px(r.icon || 'sofa', 3)}</span>
        <div class="col" style="text-align:left;gap:2px"><span style="font-size:17px;font-weight:800">${esc(r.name)}</span><span class="muted" style="font-weight:500">${its.length ? its.length + ' รายการ' : 'ยังไม่มีรายการ'}</span>${nx}</div>
        <span class="px" style="font-size:18px">›</span></a>`;
    }).join('') || '<div class="panel empty">ยังไม่มีห้องในชั้นนี้</div>';
    const loose = S.data.items.filter(i => i.place === f && !i.room_id);
    if (loose.length) body += `<h2 class="h" style="margin-top:6px">ทั่วทั้ง${F.name}</h2>` + groupByType(loose);
    body += S.ui.addRoom ? roomForm(f) : `<button class="btn ghost" data-act="showAddRoom" style="min-height:60px">+ เพิ่มห้องใน${F.name}</button>`;
    body += doneSection(i => i.place === f && !i.room_id);
  }
  return `<div class="page">
    ${backbar('#/', F.name)}
    <nav class="scrollx" aria-label="สลับชั้น">${tabs}</nav>
    <div style="display:flex;justify-content:center">${px(F.icon, 7)}</div>
    <div style="display:flex;flex-direction:column;gap:14px">${body}</div>
  </div>`;
}
function roomForm(f, room) {
  const icon = S.ui.roomIcon || (room && room.icon) || 'sofa';
  return `<form class="panel" id="roomForm" data-floor="${f}" data-room="${room ? room.id : ''}" style="padding:14px;display:flex;flex-direction:column;gap:12px">
    <div class="field"><label class="lbl" for="roomName">ชื่อห้อง</label><input id="roomName" class="inp" required value="${esc(room ? room.name : '')}"></div>
    <div class="field"><span class="lbl">ไอคอน</span><div class="wrap">${ROOM_ICONS.map(i => `<button type="button" class="btn sm${i === icon ? ' on' : ''}" data-roomicon="${i}" aria-label="${i}">${px(i, 2)}</button>`).join('')}</div></div>
    <div class="grid2"><button type="button" class="btn" data-act="cancelRoom">ยกเลิก</button><button class="btn" style="background:#FFEC89">บันทึก</button></div>
  </form>`;
}

function viewRoom(id) {
  const r = byId('rooms', id); if (!r) return viewHome();
  const its = S.data.items.filter(i => i.room_id === id);
  return `<div class="page">
    ${backbar('#/floor/' + r.floor, r.name, `<a class="btn icon" href="#/add?room=${r.id}" aria-label="เพิ่มรายการในห้องนี้" style="background:#FFEC89">${px('plus', 3)}</a>`)}
    <span class="tag" style="align-self:flex-start;font-size:12px">${px('pin', 2)}${esc(FLOORS[r.floor].name)} › ${esc(r.name)}</span>
    ${S.ui.editRoom ? roomForm(r.floor, r) : ''}
    ${groupByType(its, 'ยังไม่มีรายการในห้องนี้ กด + มุมขวาบนเพื่อเพิ่ม')}
    ${doneSection(i => i.room_id === id)}
    <div class="grid2"><button class="btn" data-act="editRoom">แก้ชื่อ / ไอคอน</button><button class="btn" data-act="delRoom" data-id="${r.id}">ลบห้อง</button></div>
  </div>`;
}

function detailRows(it, n) {
  const rows = [];
  const add = (k, v) => { if (v !== null && v !== undefined && v !== '') rows.push([k, v]); };
  add('อยู่ที่', placeLabel(it));
  add('ร้าน / ผู้ให้บริการ', it.provider);
  if (it.type === 'bill') {
    add('จำนวนเงิน', money(it.amount));
    add('รอบจ่าย', it.recur === 'monthly' ? `ทุกเดือน วันที่ ${it.due_day || 'TBA'}` : it.recur === 'yearly' ? `ทุกปี ${it.due_date ? D.thai(D.parse(it.due_date)).replace(/ \d+$/, '') : 'TBA'}` : `ครั้งเดียว ${it.due_date ? D.thai(D.parse(it.due_date)) : 'TBA'}`);
    add('ใครจ่าย', PAYER[it.payer] || 'หารครึ่ง');
    add('จ่ายงวดล่าสุด', it.last_done ? D.thai(D.parse(it.last_done)) : null);
  }
  if (it.type === 'ins') {
    add('เริ่มคุ้มครอง', it.start_date ? D.thai(D.parse(it.start_date)) : null);
    add('ระยะเวลา', it.dur_n ? `${it.dur_n} ${UNIT[it.dur_unit || 'y']}` : null);
    add('คุ้มครองถึง', n.date ? D.thai(n.date) : 'TBA');
  }
  if (it.type === 'mnt') {
    add('ทำทุก', it.every_months ? `${it.every_months} เดือน` : null);
    add('ทำล่าสุด', it.last_done ? D.thai(D.parse(it.last_done)) : null);
    add('ครั้งถัดไป', n.date ? D.thai(n.date) : 'TBA');
    add('ค่าใช้จ่ายต่อครั้ง', it.amount ? money(it.amount) : null);
  }
  if (it.type === 'sav') {
    add('เป้าหมาย', money(it.goal));
    add('เก็บแล้ว', money(it.saved));
    add('อยากได้ภายใน', it.due_date ? D.thai(D.parse(it.due_date)) : null);
    if (it.goal && n.left > 0) {
      const months = Math.max(1, Math.ceil(n.left / 30));
      add('ต้องเก็บ', `คนละ ${money(Math.max(0, (it.goal - (it.saved || 0)) / months / 2))} / เดือน`);
    }
  }
  if (it.type === 'sch') add('ทุกวัน', (it.weekdays || []).map(d => D.DOW[d]).join(', ') || 'TBA');
  (it.extras || []).forEach(x => add(x.label, x.value));
  if (it.remind && it.remind.length && it.type !== 'note') add('เตือนล่วงหน้า', it.remind.slice().sort((a, b) => b - a).map(r => r === 0 ? 'วันนั้น' : r + ' วัน').join(', '));
  return rows.map(([k, v]) => `<div class="row" style="justify-content:space-between;gap:16px;font-size:14px"><span>${esc(k)}</span><span style="font-weight:700;text-align:right;overflow-wrap:anywhere">${esc(v)}</span></div>`).join('');
}
function logRows(logs) {
  const KIND = { closed: 'ปิดรายการ (เสร็จแล้ว)', reopened: 'เปิดรายการอีกครั้ง', paid: 'จ่ายแล้ว', done: 'ทำแล้ว', deposit: 'หยอดเงิน', created: 'เพิ่มรายการ', vet: 'หาหมอ', weight: 'ชั่งน้ำหนัก', edit: 'แก้ไข' };
  if (!logs.length) return '<div class="empty">ยังไม่มีประวัติ</div>';
  return logs.slice(0, 30).map(l => {
    const d = new Date(l.at);
    const ds = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear() + 543).slice(2)}`;
    return `<div class="row" style="padding:10px 14px"><span class="tag" style="background:${l.who === 'mojo' ? '#F6B7C3' : '#BFDDF0'};font-size:12px">${esc(l.who || '?')}</span>
      <span style="flex:1;font-size:14px">${esc(KIND[l.kind] || l.kind)}${l.amount ? ' · ' + money(l.amount) : ''}${l.note ? ' · ' + esc(l.note) : ''}</span><span class="px" style="font-size:11px">${ds}</span></div>`;
  }).join('');
}
function viewItem(id) {
  const it = byId('items', id); if (!it) return viewHome();
  const n = due(it);
  const back = it.place === 'cat' ? (it.cat_id ? '#/cat/' + it.cat_id : '#/cats') : it.room_id ? '#/room/' + it.room_id : '#/floor/' + it.place;
  let action = '';
  if (it.type === 'bill' && n.date) action = `<button class="btn big" data-act="paid" data-id="${it.id}" style="background:#FFEC89">จ่ายแล้ว (งวด ${D.thaiShort(n.date)})</button>`;
  if (it.type === 'mnt') action = `<button class="btn big" data-act="done" data-id="${it.id}" style="background:#FFAD33">ทำแล้ววันนี้</button>`;
  if (it.type === 'sav') action = `<button class="btn big" data-act="deposit" data-id="${it.id}" style="background:#F6B7C3">หยอดเงิน</button>`;
  const logs = S.data.logs.filter(l => l.item_id === id).sort((a, b) => String(b.at).localeCompare(a.at));
  const done = doneInfo(it);
  if (done) action = '';
  return `<div class="page">
    ${backbar(back, it.title, `<a class="btn sm" href="#/edit/${it.id}">แก้ไข</a>`)}
    ${done ? `<section class="panel" style="padding:14px;background:#6BAA75;display:flex;flex-direction:column;gap:10px"><span class="h" style="font-size:18px">✓ ${esc(done)}</span>${it.closed_at ? `<span class="muted">เมื่อ ${esc(new Date(it.closed_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }))} · ไม่แจ้งเตือนแล้ว</span><button class="btn sm" data-act="reopen" data-id="${it.id}">เปิดรายการอีกครั้ง</button>` : '<span class="muted">ไม่แจ้งเตือนแล้ว ถ้าต่ออายุ กดแก้ไขแล้วใส่วันใหม่</span>'}</section>` : ''}
    <div style="display:flex;align-items:center;gap:14px">
      <span class="ibox" style="width:72px;height:72px;background:${TYPES[it.type].c}">${px(TYPES[it.type].icon, 4)}</span>
      <div class="col" style="gap:6px"><span class="tag" style="font-size:12px;align-self:flex-start">${px('pin', 2)}${esc(placeLabel(it))}</span><div>${tag(it.type)}</div></div>
    </div>
    ${it.type !== 'note' ? `<section class="panel" style="padding:14px;display:flex;flex-direction:column;gap:10px">
      <div class="between"><span class="h" style="font-size:20px">${n.date ? D.thai(n.date) : 'ยังไม่กำหนด (TBA)'}</span>${leftSpan(it, n)}</div>
      ${['ins', 'mnt', 'sav', 'bill'].includes(it.type) ? meter(it, n, 18) : ''}
    </section>` : ''}
    ${action}
    <section class="panel" style="overflow:hidden">${detailRows(it, n) || '<div class="empty">—</div>'}</section>
    ${it.note ? `<section class="panel" style="padding:14px;display:flex;gap:10px;background:#FFEC89">${px('note', 3)}<p style="margin:0;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(it.note)}</p></section>` : ''}
    <section style="display:flex;flex-direction:column;gap:10px"><h2 class="h" style="font-size:16px">ประวัติ</h2><div class="panel" style="overflow:hidden">${logRows(logs)}</div></section>
    ${done ? '' : `<button class="btn big" data-act="close" data-id="${it.id}" style="background:#6BAA75">✓ เสร็จแล้ว ปิดรายการ</button>`}
    <button class="btn" data-act="delItem" data-id="${it.id}" style="color:#CC1400">ลบรายการนี้ทิ้ง</button>
  </div>`;
}

// ----- form -----
function newForm(q) {
  const f = { type: 'ins', title: '', place: 'house', room_id: null, cat_id: null, provider: '', amount: '', payer: 'split', recur: 'monthly', due_day: '', due_date: '', start_date: '', dur_n: 1, dur_unit: 'y', every_months: 6, last_done: '', weekdays: [], goal: '', saved: 0, remind: [7, 1, 0], extras: [], note: '', fixedEnd: false };
  if (q.get('room')) { const r = byId('rooms', q.get('room')); if (r) { f.place = r.floor; f.room_id = r.id; } }
  if (q.get('place')) f.place = q.get('place');
  if (q.get('cat')) { f.place = 'cat'; f.cat_id = q.get('cat'); }
  if (q.get('type')) f.type = q.get('type');
  return f;
}
function formFromItem(it) {
  const f = newForm(new URLSearchParams());
  Object.keys(f).forEach(k => { if (it[k] !== undefined && it[k] !== null) f[k] = it[k]; });
  f.extras = JSON.parse(JSON.stringify(it.extras || []));
  f.remind = (it.remind || []).slice(); f.weekdays = (it.weekdays || []).slice();
  f.fixedEnd = it.type === 'ins' && !it.start_date && !!it.due_date;
  f.id = it.id;
  return f;
}
function placeOptions(f) {
  const sel = f.place === 'cat' ? 'cat:' + (f.cat_id || '') : f.room_id ? f.place + ':' + f.room_id : f.place;
  const o = (v, l) => `<option value="${v}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`;
  let h = o('house', 'ทั้งบ้าน');
  ['f1', 'f2', 'out'].forEach(k => {
    h += o(k, FLOORS[k].name + ' (ทั้งชั้น)');
    S.data.rooms.filter(r => r.floor === k).forEach(r => { h += o(k + ':' + r.id, FLOORS[k].name + ' › ' + r.name); });
  });
  h += o('cat:', 'น้องแมว (ทุกตัว)');
  S.data.cats.forEach(c => { h += o('cat:' + c.id, 'น้องแมว › ' + c.name); });
  return h;
}
function insCalc(f) {
  const it = { type: 'ins', start_date: f.fixedEnd ? null : f.start_date, dur_n: f.dur_n, dur_unit: f.dur_unit, due_date: f.fixedEnd ? f.due_date : null };
  const n = due(it);
  return `<span class="px" style="font-size:11px">AUTO CALC</span>
    <span class="h" style="font-size:21px">คุ้มครองถึง ${n.date ? D.thai(n.date) : '—'}</span>
    ${meter(it, n)}
    <span style="font-size:13px;font-weight:600">${n.date ? esc(D.leftText(n.left, 'ins')) + (n.left > 0 ? ` (${n.left} วัน)` : '') : 'ใส่วันเริ่มและระยะเวลา'}</span>`;
}
function chip(label, on, attrs) { return `<button type="button" class="btn sm${on ? ' on' : ''}" ${attrs}>${label}</button>`; }
function viewForm() {
  const f = S.form;
  const T = f.type;
  const fld = (id, label, inner) => `<div class="field"><label class="lbl" for="${id}">${label}</label>${inner}</div>`;
  const inp = (k, type = 'text', extra = '') => `<input id="f_${k}" data-k="${k}" class="inp${type === 'number' ? ' px' : ''}" type="${type}" value="${esc(f[k] ?? '')}" ${type === 'number' ? 'inputmode="decimal"' : ''} ${extra}>`;
  let typeFields = '';
  if (T === 'bill') typeFields = `
    ${fld('f_amount', 'จำนวนเงิน (บาท)', inp('amount', 'number', 'placeholder="0.00"'))}
    <div class="field"><span class="lbl">รอบจ่าย</span><div class="wrap">${[['monthly', 'ทุกเดือน'], ['yearly', 'ทุกปี'], ['once', 'ครั้งเดียว']].map(([v, l]) => chip(l, f.recur === v, `data-set="recur" data-v="${v}"`)).join('')}</div></div>
    ${f.recur === 'monthly' ? fld('f_due_day', 'ครบกำหนดทุกวันที่ (1–31)', inp('due_day', 'number', 'min="1" max="31" placeholder="เช่น 30"') + '<span class="muted">เดือนที่ไม่มีวันนั้น จะใช้วันสุดท้ายของเดือน</span>') : fld('f_due_date', f.recur === 'yearly' ? 'ครบกำหนดวันที่ (ปีนี้)' : 'ครบกำหนดวันที่', inp('due_date', 'date'))}
    <div class="field"><span class="lbl">ใครจ่าย</span><div class="grid2">${Object.entries(PAYER).map(([v, l]) => chip(l, f.payer === v, `data-set="payer" data-v="${v}"`)).join('')}</div></div>`;
  if (T === 'ins') typeFields = `
    ${fld('f_provider', 'ร้าน / ผู้ให้ประกัน', inp('provider', 'text', 'placeholder="เช่น ศูนย์บริการ, ช่างโต้ง, ธนาคาร"'))}
    <div class="grid2">${chip('รู้วันเริ่ม + ระยะเวลา', !f.fixedEnd, 'data-set="fixedEnd" data-v="0"')}${chip('รู้แค่วันหมด', f.fixedEnd, 'data-set="fixedEnd" data-v="1"')}</div>
    ${f.fixedEnd ? fld('f_due_date', 'หมดประกันวันที่', inp('due_date', 'date', 'data-calc="1"')) : `
    ${fld('f_start_date', 'เริ่มคุ้มครองวันที่', inp('start_date', 'date', 'data-calc="1"'))}
    <div class="field"><label class="lbl" for="f_dur_n">ระยะเวลา</label>
      <div style="display:flex;gap:8px">${inp('dur_n', 'number', 'min="1" data-calc="1" style="width:84px;font-size:18px;text-align:center"')}
        <div class="grid3" style="flex:1;gap:6px">${Object.entries(UNIT).map(([v, l]) => chip(l, f.dur_unit === v, `data-set="dur_unit" data-v="${v}" style="min-height:46px"`)).join('')}</div></div>
      <div class="wrap" style="margin-top:4px">${[[6, 'm', '6 เดือน'], [1, 'y', '1 ปี'], [2, 'y', '2 ปี'], [3, 'y', '3 ปี'], [5, 'y', '5 ปี']].map(([n, u, l]) => chip(l, false, `data-preset="${n},${u}"`)).join('')}</div>
    </div>`}
    <div class="panel" id="insCalc" style="background:#FFEC89;padding:14px;display:flex;flex-direction:column;gap:6px">${insCalc(f)}</div>`;
  if (T === 'mnt') typeFields = `
    ${fld('f_every_months', 'ทำทุก ๆ (เดือน)', inp('every_months', 'number', 'min="1"'))}
    ${fld('f_last_done', 'ทำครั้งล่าสุดเมื่อ', inp('last_done', 'date'))}
    ${fld('f_due_date', 'วันนัดครั้งถัดไป (ถ้ามี)', inp('due_date', 'date'))}
    ${fld('f_provider', 'ร้าน / ช่าง', inp('provider'))}
    ${fld('f_amount', 'ค่าใช้จ่ายต่อครั้ง (ถ้ามี)', inp('amount', 'number', 'placeholder="0.00"'))}`;
  if (T === 'sav') typeFields = `
    ${fld('f_goal', 'เป้าหมาย (บาท)', inp('goal', 'number', 'placeholder="0.00"'))}
    ${fld('f_saved', 'เก็บไปแล้ว (บาท)', inp('saved', 'number'))}
    ${fld('f_due_date', 'อยากได้ภายใน', inp('due_date', 'date'))}`;
  if (T === 'sch') typeFields = `<div class="field"><span class="lbl">วันไหนบ้าง</span><div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px">${D.DOW.map((l, i) => chip(l, f.weekdays.includes(i), `data-wd="${i}" style="padding:0"`)).join('')}</div></div>`;
  const KINDS = [['text', 'ข้อความ'], ['number', 'ตัวเลข'], ['money', 'จำนวนเงิน'], ['date', 'วันที่'], ['tel', 'เบอร์โทร'], ['url', 'ลิงก์']];
  const extras = f.extras.map((x, i) => `<div style="display:flex;gap:8px;align-items:flex-end">
      <div class="field" style="flex:1"><input class="inp" style="min-height:36px;font-size:13px;font-weight:700;padding:4px 10px" data-xl="${i}" value="${esc(x.label)}" aria-label="ชื่อช่อง" placeholder="ชื่อช่อง">
      <input class="inp" data-xv="${i}" type="${x.kind === 'money' ? 'number' : x.kind}" value="${esc(x.value || '')}" aria-label="${esc(x.label || 'ค่า')}"></div>
      <button type="button" class="btn icon" data-xdel="${i}" aria-label="ลบช่องนี้" style="background:#F6B7C3">✕</button></div>`).join('');
  return `<div class="page">
    ${backbar(f.id ? '#/item/' + f.id : '#/', f.id ? 'แก้ไขรายการ' : 'เพิ่มรายการ')}
    <form id="itemForm" style="display:flex;flex-direction:column;gap:20px">
      <div class="field"><label class="lbl" for="f_where">อยู่ที่ไหน</label><select id="f_where" class="inp" style="box-shadow:3px 3px 0 #1A1A1A">${placeOptions(f)}</select></div>
      <div class="field"><span class="lbl">เป็นรายการแบบไหน</span>
        <div class="grid3">${TYPE_ORDER.map(k => `<button type="button" class="btn${f.type === k ? ' on' : ''}" data-type="${k}" style="flex-direction:column;gap:6px;min-height:84px;padding:8px 4px;${f.type === k ? 'box-shadow:none;transform:translate(3px,3px)' : ''}">${px(TYPES[k].icon, 3)}<span style="font-size:13px">${TYPES[k].label}</span></button>`).join('')}</div>
      </div>
      <section class="panel" style="padding:16px;display:flex;flex-direction:column;gap:14px">
        ${fld('f_title', 'ชื่อรายการ', inp('title', 'text', 'required placeholder="เช่น แอร์ — ประกันคอมเพรสเซอร์"'))}
        ${typeFields}
        ${fld('f_note', 'โน้ต', `<textarea id="f_note" data-k="note" class="inp" rows="${T === 'note' ? 5 : 2}">${esc(f.note || '')}</textarea>`)}
      </section>
      <section class="panel" style="padding:16px;display:flex;flex-direction:column;gap:12px">
        <div class="col"><h2 class="h" style="font-size:16px">ช่องเพิ่มเติม</h2><span class="muted">อยากจดอะไรเพิ่ม เพิ่มช่องเองได้เลย เช่น เลขซีเรียล เบอร์ช่าง</span></div>
        ${extras}
        ${S.ui.picker ? `<div class="wrap" style="background:#FFEC89;border:2px solid #1A1A1A;border-radius:6px;padding:10px">${KINDS.map(([k, l]) => chip(l, false, `data-xadd="${k}" data-xlabel="${l}"`)).join('')}</div>` : ''}
        <button type="button" class="btn ghost" data-act="picker">${S.ui.picker ? 'ยกเลิก' : '+ เพิ่มช่อง'}</button>
      </section>
      ${T !== 'note' ? `<section class="panel" style="padding:16px;display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;align-items:center;gap:8px">${px('bell', 2)}<h2 class="h" style="font-size:16px">แจ้งเตือน</h2></div>
        <span class="lbl">เตือนล่วงหน้า (เลือกได้หลายอัน)</span>
        <div class="wrap">${[[0, 'วันนั้น'], [1, '1 วัน'], [3, '3 วัน'], [7, '7 วัน'], [30, '30 วัน'], [60, '60 วัน'], [90, '90 วัน']].map(([v, l]) => chip(l, f.remind.includes(v), `data-rem="${v}"`)).join('')}</div>
        <span class="muted" style="font-weight:600">แจ้งเตือนเด้งทั้ง pojo และ mojo ทุกเช้า 08:00</span>
      </section>` : ''}
      <div style="display:grid;grid-template-columns:1fr 2fr;gap:12px">
        <a class="btn big" href="${f.id ? '#/item/' + f.id : '#/'}">ยกเลิก</a>
        <button class="btn big" style="background:#FFEC89;box-shadow:4px 4px 0 #1A1A1A">บันทึก</button>
      </div>
    </form>
  </div>`;
}
function collectForm() {
  const f = S.form;
  document.querySelectorAll('#itemForm [data-k]').forEach(el => { f[el.dataset.k] = el.value; });
  document.querySelectorAll('#itemForm [data-xl]').forEach(el => { f.extras[+el.dataset.xl].label = el.value; });
  document.querySelectorAll('#itemForm [data-xv]').forEach(el => { f.extras[+el.dataset.xv].value = el.value; });
  const w = document.getElementById('f_where');
  if (w) {
    const [p, id] = w.value.split(':');
    f.place = p; f.room_id = p !== 'cat' && id ? id : null; f.cat_id = p === 'cat' && id ? id : null;
  }
}
function rowFromForm(f) {
  const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
  const dt = (v) => v || null;
  const row = { type: f.type, title: f.title.trim() || TYPES[f.type].label, place: f.place, room_id: f.room_id, cat_id: f.cat_id, note: f.note || null, extras: f.extras.filter(x => x.label || x.value), remind: f.remind.map(Number),
    provider: null, amount: null, payer: 'split', recur: 'monthly', due_day: null, due_date: null, start_date: null, dur_n: null, dur_unit: 'y', every_months: null, weekdays: null, goal: null };
  if (f.type === 'bill') Object.assign(row, { amount: num(f.amount), payer: f.payer, recur: f.recur, due_day: f.recur === 'monthly' ? num(f.due_day) : null, due_date: f.recur !== 'monthly' ? dt(f.due_date) : null });
  if (f.type === 'ins') Object.assign(row, { provider: f.provider || null, start_date: f.fixedEnd ? null : dt(f.start_date), dur_n: f.fixedEnd ? null : num(f.dur_n), dur_unit: f.dur_unit, due_date: f.fixedEnd ? dt(f.due_date) : null });
  if (f.type === 'mnt') Object.assign(row, { every_months: num(f.every_months), last_done: dt(f.last_done), due_date: dt(f.due_date), provider: f.provider || null, amount: num(f.amount) });
  if (f.type === 'sav') Object.assign(row, { goal: num(f.goal), saved: num(f.saved) || 0, due_date: dt(f.due_date) });
  if (f.type === 'sch') row.weekdays = f.weekdays.map(Number).sort();
  return row;
}

function viewAlerts() {
  const all = sortByDue(S.data.items.filter(i => i.type !== 'note'));
  const grp = (title, list) => list.length ? `<section style="display:flex;flex-direction:column;gap:10px"><h2 class="h" style="font-size:15px;color:#FFF">${title}</h2>
    <div class="panel" style="overflow:hidden">${list.map(x => itemRow(x.it, x.n)).join('')}</div></section>` : '';
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  let pushState = '';
  if (DEMO) pushState = 'โหมดทดลอง ยังส่งแจ้งเตือนไม่ได้ (ต้องตั้งค่า Supabase ก่อน)';
  else if (!standalone && /iPhone|iPad/.test(navigator.userAgent)) pushState = 'ต้องเปิดแอปจากไอคอนบนหน้าจอโฮมก่อน ถึงจะเปิดแจ้งเตือนได้';
  else if (perm === 'granted') pushState = 'เปิดแจ้งเตือนบนเครื่องนี้แล้ว';
  else if (perm === 'denied') pushState = 'ถูกปิดไว้ ไปเปิดที่ การตั้งค่า › การแจ้งเตือน › บ้านเรา';
  else pushState = 'ยังไม่ได้เปิดแจ้งเตือนบนเครื่องนี้';
  return `<div class="page">
    <div style="display:flex;align-items:center;gap:12px">${px('bell', 4)}<h1 class="h" style="font-size:30px;color:#FFF">แจ้งเตือน</h1></div>
    ${grp('เลยกำหนด / หมดแล้ว', all.filter(x => x.n.left !== null && x.n.left < 0))}
    ${grp('ภายใน 7 วัน', all.filter(x => x.n.left !== null && x.n.left >= 0 && x.n.left <= 7))}
    ${grp('ภายใน 30 วัน', all.filter(x => x.n.left !== null && x.n.left > 7 && x.n.left <= 30))}
    ${grp('ยังไม่กำหนด (TBA)', all.filter(x => x.n.left === null))}
    <section class="panel" style="padding:14px;display:flex;flex-direction:column;gap:12px">
      <h2 class="h" style="font-size:16px">ตั้งค่าเครื่องนี้</h2>
      <p style="margin:0;font-size:14px;font-weight:600">${esc(pushState)}</p>
      ${!DEMO && perm !== 'granted' ? '<button class="btn" data-act="enablePush" style="background:#FFEC89">เปิดแจ้งเตือนบนเครื่องนี้</button>' : ''}
      ${!DEMO && perm === 'granted' ? '<button class="btn" data-act="testPush">ส่งแจ้งเตือนทดสอบ</button>' : ''}
      <div class="field"><span class="lbl">เครื่องนี้เป็นของ</span><div class="grid2">${chip('pojo', S.who === 'pojo', 'data-who="pojo"')}${chip('mojo', S.who === 'mojo', 'data-who="mojo"')}</div></div>
      ${!DEMO ? '<button class="btn sm" data-act="resetKey">เปลี่ยนรหัสบ้าน</button>' : ''}
    </section>
  </div>${nav('alerts')}`;
}

function viewCats() {
  const cats = S.data.cats;
  const its = S.data.items.filter(i => i.place === 'cat');
  const mb = monthBills(i => i.place === 'cat');
  return `<div class="page">
    ${backbar('#/', 'น้องแมว', `<a class="btn icon" href="#/add?place=cat" aria-label="เพิ่มรายการของแมว" style="background:#FFAD33">${px('plus', 3)}</a>`)}
    <nav class="scrollx" aria-label="เลือกแมว">
      ${cats.map(c => `<a class="btn sm" href="#/cat/${c.id}" style="padding:4px 12px 4px 6px;white-space:nowrap"><span class="ibox" style="width:32px;height:32px;border-width:2px;background:${c.color}">${px('cat', 2)}</span>${esc(c.name)}</a>`).join('')}
      <button class="btn sm ghost" data-act="addCat" style="white-space:nowrap">+ เพิ่มแมว</button>
    </nav>
    <section class="panel" style="background:#967CC7;padding:16px;display:flex;align-items:center;gap:16px">
      ${px('cat', 6)}
      <div class="col" style="gap:6px"><span style="font-size:13px;font-weight:700">ค่าแมวเดือน ${D.MON[today().getUTCMonth()]}</span><span class="h" style="font-size:26px;line-height:1.1">${money(mb.total)}</span>
      <span class="px" style="font-size:11px">${mb.paid}/${mb.count} PAID</span></div>
    </section>
    ${groupByType(its, 'ยังไม่มีรายการของแมว กด + มุมขวาบนเพื่อเพิ่ม เช่น อาหาร ทราย วัคซีน')}
    ${doneSection(i => i.place === 'cat')}
  </div>`;
}

function viewCat(id) {
  const c = byId('cats', id); if (!c) return viewCats();
  const info = c.info || {};
  const its = S.data.items.filter(i => i.place === 'cat' && (i.cat_id === id || !i.cat_id) && i.type !== 'note');
  const bars = sortByDue(its).map(({ it, n }) => `<a href="#/item/${it.id}" style="display:flex;gap:10px;align-items:center;text-decoration:none">
      <span class="ibox" style="width:40px;height:40px;background:${TYPES[it.type].c}">${px(TYPES[it.type].icon, 2)}</span>
      <div class="col" style="gap:4px"><div class="between" style="font-size:13px"><span style="font-weight:700">${esc(it.title)}</span>${leftSpan(it, n)}</div>${meter(it, n)}</div></a>`).join('');
  const F = [['birthday', 'วันเกิด', 'date'], ['sex', 'เพศ', 'text'], ['breed', 'พันธุ์', 'text'], ['coat', 'สี / ลาย', 'text'], ['weight', 'น้ำหนักล่าสุด (กก.)', 'number'], ['neutered', 'ทำหมัน', 'text'], ['chip', 'ไมโครชิป', 'text'], ['allergy', 'แพ้ / ข้อควรระวัง', 'text'], ['food', 'อาหารที่กิน', 'text'], ['clinic', 'คลินิกประจำ', 'text'], ['clinic_tel', 'เบอร์คลินิก', 'tel']];
  let age = '';
  if (info.birthday) { const b = D.parse(info.birthday), t = today(); let y = t.getUTCFullYear() - b.getUTCFullYear(); let m = t.getUTCMonth() - b.getUTCMonth(); if (m < 0) { y--; m += 12; } age = y > 0 ? `${y} ปี ${m} เดือน` : `${m} เดือน`; }
  const logs = S.data.logs.filter(l => l.cat_id === id).sort((a, b) => String(b.at).localeCompare(a.at));
  return `<div class="page">
    ${backbar('#/cats', c.name)}
    <section class="panel" style="background:#FFEC89;padding:18px;display:flex;flex-direction:column;align-items:center;gap:12px;position:relative">
      <div class="panel" style="width:150px;height:150px;background:${c.color};display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:3px 3px 0 #1A1A1A">${c.photo ? `<img src="${c.photo}" alt="รูป${esc(c.name)}" style="width:100%;height:100%;object-fit:cover">` : px('cat', 10)}</div>
      <label class="btn sm" style="position:absolute;top:12px;right:12px">${c.photo ? 'เปลี่ยนรูป' : '+ รูปน้อง'}<input type="file" accept="image/*" class="sr" id="catPhoto" data-id="${c.id}"></label>
      <span class="h" style="font-size:26px">${esc(c.name)}</span>
      <div class="wrap" style="justify-content:center">${[info.sex, age, info.weight ? info.weight + ' กก.' : ''].filter(Boolean).map(v => `<span class="tag" style="font-size:12px">${esc(v)}</span>`).join('')}</div>
    </section>
    <section class="panel" style="padding:14px;display:flex;flex-direction:column;gap:12px">
      <div class="between"><h2 class="h" style="font-size:16px">สถานะน้อง</h2><span class="px" style="font-size:11px">STATUS</span></div>
      ${bars || '<span style="font-size:14px">ยังไม่มีรายการ เพิ่มวัคซีน หยอดเห็บหมัด อาหาร ได้ที่ปุ่มด้านล่าง</span>'}
      <a class="btn sm" href="#/add?cat=${c.id}&type=mnt" style="background:#FFAD33">+ เพิ่มรายการของ ${esc(c.name)}</a>
    </section>
    <form class="panel" id="catForm" data-id="${c.id}" style="padding:14px;display:flex;flex-direction:column;gap:12px">
      <h2 class="h" style="font-size:16px">ข้อมูลน้อง</h2>
      <div class="field"><label class="lbl" for="c_name">ชื่อ</label><input id="c_name" class="inp" value="${esc(c.name)}" required></div>
      ${F.map(([k, l, t]) => `<div class="field"><label class="lbl" for="c_${k}">${l}</label><input id="c_${k}" data-ck="${k}" class="inp" type="${t}" ${t === 'number' ? 'inputmode="decimal" step="0.01"' : ''} value="${esc(info[k] || '')}"></div>`).join('')}
      <div class="field"><span class="lbl">สีประจำตัว</span><div class="wrap">${CAT_COLORS.map(col => `<button type="button" class="btn sm${c.color === col ? ' on' : ''}" data-ccol="${col}" aria-label="สี ${col}" style="width:44px;background:${col}">${c.color === col ? '✓' : ''}</button>`).join('')}</div></div>
      <button class="btn" style="background:#FFEC89">บันทึกข้อมูล</button>
    </form>
    <div class="grid2"><button class="btn big" data-act="catWeight" data-id="${c.id}" style="background:#FFEC89">บันทึกน้ำหนัก</button><button class="btn big" data-act="catVet" data-id="${c.id}" style="background:#F6B7C3">บันทึกหาหมอ</button></div>
    <section style="display:flex;flex-direction:column;gap:10px"><h2 class="h" style="font-size:16px">ประวัติ</h2><div class="panel" style="overflow:hidden">${logRows(logs)}</div></section>
    <button class="btn" data-act="delCat" data-id="${c.id}">ลบข้อมูลแมวตัวนี้</button>
  </div>`;
}

// ---------- router ----------
function route() {
  const h = location.hash.slice(1) || '/';
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  return { name: parts[0] || 'home', id: parts[1], q: new URLSearchParams(qs || '') };
}
function render() {
  if (!S.db || !S.who) { app.innerHTML = viewSetup(); return; }
  const r = route();
  let html, bg = PAGE_BG[r.name] || PAGE_BG.home;
  if (r.name === 'floor') html = viewFloor(r.id);
  else if (r.name === 'room') html = viewRoom(r.id);
  else if (r.name === 'item') html = viewItem(r.id);
  else if (r.name === 'add' || r.name === 'edit') {
    if (!S.form || S.form._route !== location.hash) {
      const it = r.name === 'edit' && byId('items', r.id);
      S.form = it ? formFromItem(it) : newForm(r.q); S.form._route = location.hash; S.ui.picker = false;
    }
    html = viewForm(); bg = PAGE_BG.form;
  } else if (r.name === 'alerts') html = viewAlerts();
  else if (r.name === 'cats') html = viewCats();
  else if (r.name === 'cat') html = viewCat(r.id);
  else { html = viewHome(); bg = PAGE_BG.home; }
  document.documentElement.style.setProperty('--bg', bg);
  document.querySelector('meta[name=theme-color]').setAttribute('content', bg);
  app.innerHTML = html;
}
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
window.addEventListener('hashchange', () => { S.ui.addRoom = false; S.ui.editRoom = false; S.ui.roomIcon = null; if (!/^#\/(add|edit)/.test(location.hash)) S.form = null; render(); window.scrollTo(0, 0); });

// ---------- image ----------
function resizeImage(file, max = 1000) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      res(c.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

// ---------- push ----------
function b64ToU8(b64) {
  const p = '='.repeat((4 - b64.length % 4) % 4);
  const s = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...s].map(c => c.charCodeAt(0)));
}
async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) { toast('เครื่องนี้ยังไม่รองรับ ลองเปิดจากไอคอนหน้าจอโฮม'); return; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('ยังไม่ได้อนุญาตแจ้งเตือน'); render(); return; }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(VAPID_PUBLIC_KEY) });
  await S.db.saveSub(sub.toJSON(), S.who);
  toast('เปิดแจ้งเตือนแล้ว'); render();
}

// ---------- events ----------
app.addEventListener('click', async (e) => {
  const b = e.target.closest('button, [data-act]');
  if (!b) return;
  const d = b.dataset;
  try {
    if (d.who) {
      S.who = d.who; localStorage.setItem(LS.who, d.who);
      if (S.db) { try { const reg = await navigator.serviceWorker?.ready; const sub = await reg?.pushManager?.getSubscription(); if (sub) await S.db.saveSub(sub.toJSON(), S.who); } catch (err) { /* ignore */ } }
      document.querySelectorAll('[data-who]').forEach(x => x.classList.toggle('on', x.dataset.who === d.who));
      return;
    }
    // form interactions
    if (S.form && b.closest('#itemForm')) {
      const f = S.form;
      if (d.type || d.set || d.preset || d.wd !== undefined || d.rem !== undefined || d.xadd || d.xdel !== undefined || d.act === 'picker') {
        collectForm();
        if (d.type) f.type = d.type;
        if (d.set) f[d.set] = d.set === 'fixedEnd' ? d.v === '1' : d.v;
        if (d.preset) { const [n, u] = d.preset.split(','); f.dur_n = Number(n); f.dur_unit = u; }
        if (d.wd !== undefined) { const i = +d.wd; f.weekdays = f.weekdays.includes(i) ? f.weekdays.filter(x => x !== i) : [...f.weekdays, i]; }
        if (d.rem !== undefined) { const v = +d.rem; f.remind = f.remind.includes(v) ? f.remind.filter(x => x !== v) : [...f.remind, v]; }
        if (d.xadd) { f.extras.push({ label: '', kind: d.xadd, value: '' }); S.ui.picker = false; }
        if (d.xdel !== undefined) f.extras.splice(+d.xdel, 1);
        if (d.act === 'picker') S.ui.picker = !S.ui.picker;
        const y = window.scrollY; render(); window.scrollTo(0, y);
        if (d.xadd) { const el = document.querySelector(`[data-xl="${f.extras.length - 1}"]`); el && el.focus(); }
        return;
      }
    }
    if (d.roomicon) { S.ui.roomIcon = d.roomicon; const n = document.getElementById('roomName')?.value; render(); const el = document.getElementById('roomName'); if (el && n !== undefined) el.value = n; return; }
    if (d.ccol) { const id = b.closest('form').dataset.id; await S.db.update('cats', id, { color: d.ccol }); await reload(); render(); return; }
    switch (d.act) {
      case 'showAddRoom': S.ui.addRoom = true; S.ui.roomIcon = null; render(); document.getElementById('roomName')?.focus(); break;
      case 'cancelRoom': S.ui.addRoom = false; S.ui.editRoom = false; render(); break;
      case 'editRoom': S.ui.editRoom = true; S.ui.roomIcon = null; render(); break;
      case 'delRoom': {
        const r = byId('rooms', d.id);
        const n = S.data.items.filter(i => i.room_id === d.id).length;
        if (!confirm(`ลบห้อง "${r.name}"?${n ? ` รายการ ${n} อันในห้องจะย้ายไปอยู่ "${FLOORS[r.floor].name} (ทั้งชั้น)"` : ''}`)) return;
        await S.db.remove('rooms', d.id); await reload(); go('#/floor/' + r.floor); break;
      }
      case 'paid': {
        const it = byId('items', d.id), n = due(it);
        await S.db.update('items', it.id, { last_done: D.fmt(n.date) });
        await log({ item_id: it.id, kind: 'paid', amount: it.amount, period: D.fmt(n.date) });
        await reload(); render(); toast('บันทึกว่าจ่ายแล้ว');
        notifyOther(`${S.who} จ่าย ${it.title} แล้ว`, `งวด ${D.thai(n.date)}${it.amount ? ' · ' + money(it.amount) : ''}`);
        break;
      }
      case 'done': {
        const it = byId('items', d.id);
        await S.db.update('items', it.id, { last_done: D.fmt(today()), due_date: null });
        await log({ item_id: it.id, kind: 'done', amount: it.amount });
        await reload(); render(); toast('บันทึกแล้ว นับรอบใหม่ให้แล้ว');
        notifyOther(`${S.who} ทำ ${it.title} แล้ว`, it.every_months ? `รอบถัดไปอีก ${it.every_months} เดือน` : 'เรียบร้อย');
        break;
      }
      case 'deposit': {
        const it = byId('items', d.id);
        const v = Number(prompt('หยอดเงินกี่บาท?', ''));
        if (!v) return;
        await S.db.update('items', it.id, { saved: (Number(it.saved) || 0) + v });
        await log({ item_id: it.id, kind: 'deposit', amount: v });
        await reload(); render(); toast('หยอดแล้ว ' + money(v));
        notifyOther(`${S.who} หยอดเงิน ${it.title}`, money(v));
        break;
      }
      case 'close': {
        const it = byId('items', d.id);
        if (!confirm(`ปิดรายการ "${it.title}"? จะย้ายไปอยู่ส่วน "เสร็จแล้ว" และไม่แจ้งเตือนอีก`)) return;
        await S.db.update('items', it.id, { closed_at: new Date().toISOString() });
        await log({ item_id: it.id, kind: 'closed' });
        await reload(); render(); toast('ปิดรายการแล้ว ✓');
        notifyOther(`${S.who} ปิดรายการ ${it.title} แล้ว`, 'เสร็จเรียบร้อย ✓');
        break;
      }
      case 'reopen': {
        const it = byId('items', d.id);
        await S.db.update('items', it.id, { closed_at: null });
        await log({ item_id: it.id, kind: 'reopened' });
        await reload(); render(); toast('เปิดรายการอีกครั้งแล้ว');
        break;
      }
      case 'delItem': {
        const it = byId('items', d.id);
        if (!confirm(`ลบ "${it.title}"?`)) return;
        await S.db.remove('items', d.id); await reload();
        go(it.place === 'cat' ? '#/cats' : it.room_id ? '#/room/' + it.room_id : '#/floor/' + it.place); break;
      }
      case 'addCat': {
        const name = (prompt('ชื่อแมว?', '') || '').trim();
        if (!name) return;
        const c = await S.db.insert('cats', { name, color: CAT_COLORS[S.data.cats.length % CAT_COLORS.length], info: {} });
        await reload(); go('#/cat/' + c.id); break;
      }
      case 'catWeight': {
        const c = byId('cats', d.id);
        const v = prompt('น้ำหนักวันนี้ (กก.)', c.info?.weight || '');
        if (!v) return;
        await S.db.update('cats', c.id, { info: { ...(c.info || {}), weight: v } });
        await log({ cat_id: c.id, kind: 'weight', note: v + ' กก.' });
        await reload(); render(); toast('บันทึกน้ำหนักแล้ว'); break;
      }
      case 'catVet': {
        const c = byId('cats', d.id);
        const note = prompt('ไปหาหมอเรื่องอะไร / คลินิกไหน', '');
        if (note === null) return;
        const amt = Number(prompt('ค่ารักษา (บาท) ไม่มีเว้นว่างได้', '')) || null;
        await log({ cat_id: c.id, kind: 'vet', note, amount: amt });
        await reload(); render(); toast('บันทึกแล้ว'); break;
      }
      case 'delCat': {
        const c = byId('cats', d.id);
        if (!confirm(`ลบข้อมูล "${c.name}" และรายการของน้องทั้งหมด?`)) return;
        await S.db.remove('cats', c.id); await reload(); go('#/cats'); break;
      }
      case 'enablePush': await enablePush(); break;
      case 'testPush': { const r = await callFn('notify', S.key, { from: S.who, title: 'บ้านเรา: ทดสอบ', body: 'ถ้าเห็นข้อความนี้ แจ้งเตือนใช้ได้แล้ว', all: true }); toast(r && r.sent ? `ส่งแล้ว ${r.sent} เครื่อง` : 'ส่งไม่สำเร็จ เช็กการตั้งค่าฟังก์ชัน'); break; }
      case 'resetKey': if (confirm('เปลี่ยนรหัสบ้านบนเครื่องนี้?')) { localStorage.removeItem(LS.key); S.key = null; S.db = null; render(); } break;
    }
  } catch (err) {
    console.error(err); toast('มีบางอย่างผิดพลาด: ' + (err.message || err));
  }
});

app.addEventListener('input', (e) => {
  if (e.target.dataset.calc && S.form) {
    collectForm();
    const box = document.getElementById('insCalc'); if (box) box.innerHTML = insCalc(S.form);
  }
});

app.addEventListener('change', async (e) => {
  const el = e.target;
  try {
    if (el.id === 'f_where' && S.form) { collectForm(); return; }
    if (el.dataset.calc && S.form) { collectForm(); const box = document.getElementById('insCalc'); if (box) box.innerHTML = insCalc(S.form); return; }
    if (el.id === 'housePhoto' && el.files[0]) {
      toast('กำลังอัปโหลดรูป…');
      const url = await resizeImage(el.files[0], 1100);
      await S.db.setSetting('house_photo', url); await reload(); render(); toast('ใส่รูปบ้านแล้ว');
    }
    if (el.id === 'catPhoto' && el.files[0]) {
      const url = await resizeImage(el.files[0], 600);
      await S.db.update('cats', el.dataset.id, { photo: url }); await reload(); render();
    }
  } catch (err) { console.error(err); toast('อัปโหลดไม่สำเร็จ'); }
});

app.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fm = e.target;
  try {
    if (fm.id === 'setupForm') {
      const err = document.getElementById('setupErr');
      if (!S.who) { err.textContent = 'เลือกก่อนว่าเครื่องนี้เป็นของใคร'; return; }
      const key = DEMO ? 'demo' : document.getElementById('hk').value.trim();
      const db = await openDb(key);
      if (!(await db.check())) { err.textContent = 'รหัสบ้านไม่ถูก ลองใหม่อีกครั้ง'; return; }
      localStorage.setItem(LS.key, key); S.key = key; S.db = db;
      if (DEMO) await seedDemo();
      await reload(); go('#/'); return;
    }
    if (fm.id === 'roomForm') {
      const name = document.getElementById('roomName').value.trim(); if (!name) return;
      const icon = S.ui.roomIcon || 'sofa';
      if (fm.dataset.room) await S.db.update('rooms', fm.dataset.room, { name, icon: S.ui.roomIcon || byId('rooms', fm.dataset.room).icon });
      else await S.db.insert('rooms', { floor: fm.dataset.floor, name, icon, sort: S.data.rooms.filter(r => r.floor === fm.dataset.floor).length + 1 });
      S.ui.addRoom = false; S.ui.editRoom = false; await reload(); render(); toast('บันทึกห้องแล้ว'); return;
    }
    if (fm.id === 'catForm') {
      const c = byId('cats', fm.dataset.id);
      const info = { ...(c.info || {}) };
      fm.querySelectorAll('[data-ck]').forEach(i => { info[i.dataset.ck] = i.value; });
      await S.db.update('cats', c.id, { name: document.getElementById('c_name').value.trim() || c.name, info });
      await reload(); render(); toast('บันทึกข้อมูลน้องแล้ว'); return;
    }
    if (fm.id === 'itemForm') {
      collectForm();
      const f = S.form;
      if (!f.title.trim()) { toast('ใส่ชื่อรายการก่อนนะ'); document.getElementById('f_title').focus(); return; }
      const row = rowFromForm(f);
      let id = f.id;
      if (id) { await S.db.update('items', id, row); await log({ item_id: id, kind: 'edit' }); }
      else { const r = await S.db.insert('items', row); id = r.id; await log({ item_id: id, kind: 'created' }); }
      S.form = null; await reload(); go('#/item/' + id); toast('บันทึกแล้ว');
    }
  } catch (err) { console.error(err); toast('บันทึกไม่สำเร็จ: ' + (err.message || err)); }
});

// keep data fresh when switching back to the app (the other person may have changed something)
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && S.db && !S.form) { try { await reload(); render(); } catch (e) { /* offline */ } }
});

// ---------- demo seed ----------
async function seedDemo() {
  const st = await S.db.all();
  if (st.items.length || st.rooms.length) return;
  const R = {};
  for (const [floor, name, icon] of [['f1', 'ห้องนั่งเล่น', 'sofa'], ['f1', 'ครัว', 'pot'], ['f1', 'ส่วนต่อเติมหลังบ้าน', 'house'], ['f2', 'ห้องนอนใหญ่', 'bed'], ['f2', 'ห้องนอนเล็ก', 'bed'], ['f2', 'ห้องน้ำชั้น 2', 'bath'], ['out', 'รอบบ้าน', 'tree']]) {
    R[name] = (await S.db.insert('rooms', { floor, name, icon })).id;
  }
  const add = (o) => S.db.insert('items', { place: 'house', room_id: null, cat_id: null, remind: [7, 1, 0], extras: [], ...o });
  for (const t of ['ค่าบ้าน', 'ค่าโปะบ้าน', 'ค่าส่วนกลาง', 'ค่าน้ำ', 'ค่าไฟ', 'ค่า wifi']) await add({ type: 'bill', title: t, recur: 'monthly', payer: 'split' });
  await add({ type: 'ins', title: 'ประกันบ้าน อัคคีภัย', provider: 'ธนาคาร', remind: [60, 30, 7] });
  for (const i of [1, 2, 3]) await add({ type: 'ins', title: 'ประกันบ้านโครงการ — ข้อ ' + i, provider: 'โครงการ', remind: [60, 30] });
  for (const t of ['ประกันบิ้วอิน', 'ประกันพื้น', 'ประกันอุปกรณ์ที่แถม']) await add({ type: 'ins', title: t, remind: [60, 30] });
  await add({ type: 'sch', title: 'รถขยะเข้าเก็บ', weekdays: [2, 5], remind: [1], note: 'เอาถังออกหน้าบ้านคืนก่อน' });
  await add({ type: 'ins', place: 'f1', room_id: R['ส่วนต่อเติมหลังบ้าน'], title: 'ประกันต่อเติม', provider: 'ช่างโต้ง', remind: [60, 30] });
  for (const t of ['ประกันติดตั้ง', 'ประกันคอมเพรสเซอร์', 'ประกันสินค้า']) await add({ type: 'ins', place: 'f2', room_id: R['ห้องนอนใหญ่'], title: 'แอร์ — ' + t, remind: [30, 7] });
  await add({ type: 'ins', place: 'out', room_id: R['รอบบ้าน'], title: 'สิทธิ์ฉีดปลวก', due_date: '2027-08-31', remind: [60, 30, 7], note: 'ฉีดฟรีได้ถึง 31 ส.ค. 2570' });
  await add({ type: 'mnt', place: 'out', room_id: R['รอบบ้าน'], title: 'ฉีดปลวก รอบถัดไป', remind: [7, 1], note: 'นัดได้แล้วใส่วันนัด' });
}

// ---------- boot ----------
(async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (S.key && S.who) {
    try { S.db = await openDb(S.key); if (DEMO) await seedDemo(); await reload(); }
    catch (e) { console.error(e); S.db = null; toast('เชื่อมต่อไม่ได้ เช็กอินเทอร์เน็ตหรือรหัสบ้าน'); }
  }
  render();
})();
