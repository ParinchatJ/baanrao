// Shared date logic for บ้านเรา (used by the app and the daily-reminders function).
// All dates are 'YYYY-MM-DD' strings handled as UTC dates. "Today" is Bangkok time.

export const MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const DAY = 86400000;

export function parse(s) {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function fmt(d) {
  return d ? d.toISOString().slice(0, 10) : null;
}
export function todayBKK(now = Date.now()) {
  const t = new Date(now + 7 * 3600000);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}
function dim(y, m) { return new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); }
export function clampDate(y, m, day) {
  const yy = y + Math.floor(m / 12), mm = ((m % 12) + 12) % 12;
  return new Date(Date.UTC(yy, mm, Math.min(day, dim(yy, mm))));
}
export function addDays(d, n) { return new Date(d.getTime() + n * DAY); }
export function addMonths(d, n) { return clampDate(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()); }
export function addPeriod(d, n, unit) {
  if (unit === 'd') return addDays(d, n);
  if (unit === 'm') return addMonths(d, n);
  return addMonths(d, n * 12);
}
export function daysBetween(a, b) { return Math.round((b - a) / DAY); }

export function insEnd(it) {
  const s = parse(it.start_date);
  if (!s || !it.dur_n) return parse(it.due_date);
  return addDays(addPeriod(s, Number(it.dur_n), it.dur_unit || 'y'), -1);
}

// Returns { date: Date|null, overdue: bool, label: string } — the next date that needs attention.
export function nextDue(it, today = todayBKK()) {
  const t = it.type;
  let date = null;
  if (t === 'bill') {
    const last = parse(it.last_done);
    if (it.recur === 'monthly' && it.due_day) {
      if (last) date = clampDate(last.getUTCFullYear(), last.getUTCMonth() + 1, it.due_day);
      else {
        date = clampDate(today.getUTCFullYear(), today.getUTCMonth(), it.due_day);
        if (date < today) date = clampDate(today.getUTCFullYear(), today.getUTCMonth() + 1, it.due_day);
      }
    } else if (it.recur === 'yearly' && it.due_date) {
      const base = parse(it.due_date);
      if (last) date = clampDate(last.getUTCFullYear() + 1, base.getUTCMonth(), base.getUTCDate());
      else {
        date = clampDate(today.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate());
        if (date < today) date = clampDate(today.getUTCFullYear() + 1, base.getUTCMonth(), base.getUTCDate());
      }
    } else if (it.due_date) {
      date = last ? null : parse(it.due_date);
    }
  } else if (t === 'ins') {
    date = insEnd(it);
  } else if (t === 'mnt') {
    const last = parse(it.last_done), appt = parse(it.due_date);
    if (appt && (!last || appt > last)) date = appt;
    else if (last && it.every_months) date = addMonths(last, Number(it.every_months));
  } else if (t === 'sav') {
    date = parse(it.due_date);
  } else if (t === 'sch') {
    const wd = it.weekdays || [];
    for (let i = 0; i < 7 && wd.length; i++) {
      const d = addDays(today, i);
      if (wd.includes(d.getUTCDay())) { date = d; break; }
    }
  }
  const left = date ? daysBetween(today, date) : null;
  return { date, left, overdue: left !== null && left < 0 && t !== 'ins', expired: t === 'ins' && left !== null && left < 0 };
}

export function thai(d) {
  return d ? `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}` : '—';
}
export function thaiShort(d) {
  return d ? `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${String(d.getUTCFullYear() + 543).slice(2)}` : '—';
}
export function leftText(n, t) {
  if (n === null || n === undefined) return 'ยังไม่กำหนด';
  if (n < 0) return t === 'ins' ? `หมดแล้ว ${-n} วัน` : `เลยมา ${-n} วัน`;
  if (n === 0) return 'วันนี้';
  if (n === 1) return 'พรุ่งนี้';
  if (n > 400) return `อีก ${Math.floor(n / 365)} ปี ${Math.floor((n % 365) / 30)} เดือน`;
  if (n > 60) return `อีก ${Math.round(n / 30)} เดือน`;
  return `อีก ${n} วัน`;
}

// Should the daily job remind about this item today?
export function shouldRemind(it, today = todayBKK()) {
  const n = nextDue(it, today);
  if (n.left === null) return false;
  const rem = it.remind && it.remind.length ? it.remind : [7, 1, 0];
  if (rem.includes(n.left)) return true;
  if (n.overdue && [1, 3, 7, 14].includes(-n.left)) return true;
  return false;
}

// For a bill: what share each person pays this period.
export function billShare(it, date) {
  const a = Number(it.amount) || 0;
  if (it.payer === 'pojo') return { pojo: a, mojo: 0 };
  if (it.payer === 'mojo') return { pojo: 0, mojo: a };
  if (it.payer === 'alt') return (date && date.getUTCMonth() % 2 === 0) ? { pojo: a, mojo: 0 } : { pojo: 0, mojo: a };
  return { pojo: a / 2, mojo: a / 2 };
}
