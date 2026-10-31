// Data layer: Supabase when configured, otherwise a local demo store in this browser.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const DEMO = !SUPABASE_URL || SUPABASE_URL.includes('XXXX');
const TABLES = ['rooms', 'cats', 'items', 'logs', 'settings'];

function uuid() {
  return (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now());
}

function localDb() {
  const K = 'baanrao-demo';
  const load = () => { try { return JSON.parse(localStorage.getItem(K)) || null; } catch (e) { return null; } };
  const save = (d) => { try { localStorage.setItem(K, JSON.stringify(d)); } catch (e) { /* storage full or blocked */ } };
  let d = load();
  if (!d) { d = { rooms: [], cats: [], items: [], logs: [], settings: [] }; save(d); }
  return {
    async check() { return true; },
    async all() { return JSON.parse(JSON.stringify(d)); },
    async insert(t, row) {
      const r = { id: uuid(), created_at: new Date().toISOString(), ...row };
      if (t === 'logs') r.at = new Date().toISOString();
      d[t].push(r); save(d); return r;
    },
    async update(t, id, patch) { const r = d[t].find(x => x.id === id); Object.assign(r, patch); save(d); return r; },
    async remove(t, id) {
      d[t] = d[t].filter(x => x.id !== id);
      if (t === 'items') d.logs = d.logs.filter(l => l.item_id !== id);
      if (t === 'cats') { d.items = d.items.filter(i => i.cat_id !== id); d.logs = d.logs.filter(l => l.cat_id !== id); }
      if (t === 'rooms') d.items.forEach(i => { if (i.room_id === id) i.room_id = null; });
      save(d);
    },
    async setSetting(key, value) {
      const r = d.settings.find(s => s.key === key);
      if (r) r.value = value; else d.settings.push({ key, value });
      save(d);
    },
    async saveSub() { /* no push in demo */ },
    seed(rows) { Object.assign(d, rows); save(d); },
  };
}

async function supaDb(houseKey) {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { 'x-house-key': houseKey } },
    auth: { persistSession: false },
  });
  const ok = ({ data, error }) => { if (error) throw error; return data; };
  return {
    async check() {
      const { data, error } = await sb.rpc('house_ok');
      if (error) throw error;
      return data === true;
    },
    async all() {
      const out = {};
      await Promise.all(TABLES.map(async t => {
        let q = sb.from(t).select('*');
        if (t === 'logs') q = q.order('at', { ascending: false }).limit(400);
        out[t] = ok(await q);
      }));
      return out;
    },
    async insert(t, row) { return ok(await sb.from(t).insert(row).select().single()); },
    async update(t, id, patch) { return ok(await sb.from(t).update(patch).eq('id', id).select().single()); },
    async remove(t, id) { ok(await sb.from(t).delete().eq('id', id)); },
    async setSetting(key, value) { ok(await sb.from('settings').upsert({ key, value })); },
    async saveSub(sub, who) { ok(await sb.from('push_subs').upsert({ endpoint: sub.endpoint, sub, who })); },
  };
}

export async function openDb(houseKey) {
  return DEMO ? localDb() : supaDb(houseKey);
}

export async function callFn(name, houseKey, body) {
  if (DEMO) return { ok: false, demo: true };
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-house-key': houseKey, apikey: SUPABASE_KEY },
    body: JSON.stringify(body),
  });
  return r.json().catch(() => ({ ok: r.ok }));
}
