const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const pad2 = (n) => String(n).padStart(2, '0');
const dateToIsoLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseIsoLocal = (iso) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return new Date(iso);
  const [y, m, day] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, day);
};
function requireAuth() {
  if (localStorage.getItem('pulse_auth') !== '1') {
    localStorage.removeItem('pulse_user');
    window.location.replace('login.html');
    return false;
  }
  return true;
}
if (!requireAuth()) throw new Error('unauthorized');
const ACCOUNTS_KEY = 'pulse_accounts';
const ADMIN_ONLY_EMAIL = 'alessandro@pulse.local';
const $ = (id) => document.getElementById(id);

const hasSupabase = Boolean(window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY);
const sb = hasSupabase ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null;

async function syncAccountsFromSupabase() {
  if (!sb) return;
  const { data } = await sb.from('app_users').select('id,name,email,password,is_admin,is_blocked,created_at');
  if (!data) return;
  state.accounts = data.map(u => ({ id: u.id, name: u.name, email: u.email, password: u.password, isAdmin: !!u.is_admin, isBlocked: !!u.is_blocked, createdAt: u.created_at }));
}

async function upsertAccountToSupabase(acc) {
  if (!sb) return;
  await sb.from('app_users').upsert({ name: acc.name, email: acc.email, password: acc.password, is_admin: !!acc.isAdmin, is_blocked: !!acc.isBlocked }, { onConflict: 'email' });
}

async function deleteAccountFromSupabase(email) {
  if (!sb) return;
  await sb.from('app_users').delete().eq('email', email);
}
const REMOTE_KEYS = [
  'pulse_txs',
  'pulse_goals',
  'pulse_budgets',
  'pulse_ach',
  'pulse_xp',
  'pulse_streak',
  'pulse_compare_month',
  'pulse_calendar_month',
  'pulse_closure_month',
  'pulse_month_closures',
  'pulse_ignored_recurring',
];

function applyRemotePayloadToState(payload) {
  if (!payload || typeof payload !== 'object') return;
  if (payload.pulse_txs) state.txs = JSON.parse(payload.pulse_txs || '[]');
  if (payload.pulse_goals) state.goals = JSON.parse(payload.pulse_goals || '[]');
  if (payload.pulse_budgets) state.budgets = JSON.parse(payload.pulse_budgets || '[]');
  if (payload.pulse_ach) state.achievements = JSON.parse(payload.pulse_ach || '[]');
  if (payload.pulse_xp !== undefined) state.xp = Number(payload.pulse_xp || 0);
  if (payload.pulse_streak !== undefined) state.streak = Number(payload.pulse_streak || 0);
  if (payload.pulse_compare_month) state.compareMonth = payload.pulse_compare_month;
  if (payload.pulse_calendar_month) state.calendarMonth = payload.pulse_calendar_month;
  if (payload.pulse_closure_month) state.closureMonth = payload.pulse_closure_month;
  if (payload.pulse_month_closures) state.closures = JSON.parse(payload.pulse_month_closures || '{}');
  if (payload.pulse_ignored_recurring) state.ignoredRecurring = JSON.parse(payload.pulse_ignored_recurring || '[]');
}

async function hydrateStateFromSupabase() {
  if (!sb) return;
  const userEmail = (localStorage.getItem('pulse_user') || '').toLowerCase();
  if (!userEmail) return;
  const { data } = await sb
    .from('app_user_state')
    .select('payload')
    .eq('user_email', userEmail)
    .maybeSingle();
  if (!data || !data.payload) return;
  const payload = data.payload;
  for (const k of REMOTE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(payload, k)) {
      localStorage.setItem(k, String(payload[k]));
    }
  }
  applyRemotePayloadToState(payload);
}
const todayIso = () => dateToIsoLocal(new Date());
const monthKey = (d) => {
  if (typeof d === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(d)) return d.slice(0, 7);
  return dateToIsoLocal(new Date(d)).slice(0, 7);
};
const setRailCollapsed = (collapsed) => {
  const rail = $('leftRail');
  const btn = $('railToggle');
  rail.classList.toggle('collapsed', collapsed);
  btn.textContent = collapsed ? '›' : 'Recolher';
  localStorage.setItem('pulse_left_rail_collapsed', collapsed ? '1' : '0');
};
const setPage = (page) => {
  const me = currentAccount();
  const adminOnly = Boolean(me && me.isAdmin && me.email === ADMIN_ONLY_EMAIL);
  const safePage = adminOnly && page !== 'users' ? 'users' : page;
  $('dashboardPage').classList.toggle('hidden', safePage !== 'dashboard');
  $('movementsPage').classList.toggle('hidden', safePage !== 'movements');
  $('planningPage').classList.toggle('hidden', safePage !== 'planning');
  if ($('usersPage')) $('usersPage').classList.toggle('hidden', safePage !== 'users');
};

const state = {
  txs: JSON.parse(localStorage.getItem('pulse_txs') || '[]'),
  goals: JSON.parse(localStorage.getItem('pulse_goals') || '[]'),
  budgets: JSON.parse(localStorage.getItem('pulse_budgets') || '[]'),
  achievements: JSON.parse(localStorage.getItem('pulse_ach') || '[]'),
  currentType: 'entrada',
  xp: Number(localStorage.getItem('pulse_xp') || 0),
  streak: Number(localStorage.getItem('pulse_streak') || 0),
  compareMonth: localStorage.getItem('pulse_compare_month') || monthKey(todayIso()),
  calendarMonth: localStorage.getItem('pulse_calendar_month') || monthKey(todayIso()),
  closureMonth: localStorage.getItem('pulse_closure_month') || monthKey(todayIso()),
  closures: JSON.parse(localStorage.getItem('pulse_month_closures') || '{}'),
  ignoredRecurring: JSON.parse(localStorage.getItem('pulse_ignored_recurring') || '[]'),
  installmentMode: false,
  historyExpanded: false,
  accounts: JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]'),
};
if (!state.txs.length) state.txs = [];

function ensureAccounts() {
  if (!state.accounts.some(a => a.email === 'alessandro@pulse.local')) {
    state.accounts.push({ id: crypto.randomUUID(), name: 'Alessandro', email: 'alessandro@pulse.local', password: 'FINANCA2026', isAdmin: true, isBlocked: false, createdAt: new Date().toISOString() });
  }
}

function currentAccount() {
  const email = (localStorage.getItem('pulse_user') || '').toLowerCase();
  return state.accounts.find(a => a.email === email) || null;
}

function save() {
  localStorage.setItem('pulse_txs', JSON.stringify(state.txs));
  localStorage.setItem('pulse_goals', JSON.stringify(state.goals));
  localStorage.setItem('pulse_budgets', JSON.stringify(state.budgets));
  localStorage.setItem('pulse_ach', JSON.stringify(state.achievements));
  localStorage.setItem('pulse_xp', state.xp);
  localStorage.setItem('pulse_streak', state.streak);
  localStorage.setItem('pulse_compare_month', state.compareMonth);
  localStorage.setItem('pulse_calendar_month', state.calendarMonth);
  localStorage.setItem('pulse_closure_month', state.closureMonth);
  localStorage.setItem('pulse_month_closures', JSON.stringify(state.closures));
  localStorage.setItem('pulse_ignored_recurring', JSON.stringify(state.ignoredRecurring));
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(state.accounts));
  window.dispatchEvent(new Event('pulse:state-changed'));
  if (typeof window.pulseSyncNow === 'function') {
    window.pulseSyncNow();
  }
}

function summary() {
  const entradas = state.txs.filter(t => t.type === 'entrada').reduce((a, t) => a + t.amount, 0);
  const saidas = state.txs.filter(t => t.type === 'saida').reduce((a, t) => a + t.amount, 0);
  return { entradas, saidas, saldo: entradas - saidas, eficiencia: saidas === 0 ? (entradas > 0 ? 100 : 0) : (entradas / saidas * 100) };
}

function monthSummaryByKey(key) {
  const tx = state.txs.filter(t => monthKey(t.date) === key);
  const entradas = tx.filter(t => t.type === 'entrada').reduce((a, t) => a + t.amount, 0);
  const saidas = tx.filter(t => t.type === 'saida').reduce((a, t) => a + t.amount, 0);
  return { entradas, saidas, saldo: entradas - saidas };
}

function prevMonth(key) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() - 1);
  return dateToIsoLocal(d).slice(0, 7);
}

function nextMonthDate(isoDate, addMonths) {
  const d = parseIsoLocal(isoDate);
  d.setMonth(d.getMonth() + addMonths);
  return dateToIsoLocal(d);
}

function summarizeMonth(key) {
  const tx = state.txs.filter(t => monthKey(t.date) === key);
  const entradas = tx.filter(t => t.type === 'entrada').reduce((a, t) => a + t.amount, 0);
  const saidas = tx.filter(t => t.type === 'saida').reduce((a, t) => a + t.amount, 0);
  return { entradas, saidas, saldo: entradas - saidas, count: tx.length };
}

function detectRecurringExpenses() {
  const out = [];
  const map = new Map();
  state.txs
    .filter(t => t.type === 'saida')
    .forEach(t => {
      const key = `${t.description.toLowerCase()}|${Number(t.amount).toFixed(2)}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    });
  map.forEach((items, key) => {
    const months = new Set(items.map(i => monthKey(i.date)));
    if (months.size >= 3 && !state.ignoredRecurring.includes(key)) {
      const sample = items[0];
      out.push({
        key,
        description: sample.description,
        amount: sample.amount,
        occurrences: items.length,
        months: months.size,
      });
    }
  });
  return out.sort((a, b) => b.months - a.months);
}

function renderBudgetAlerts() {
  const m = monthKey(todayIso());
  const alerts = [];
  state.budgets.forEach(b => {
    const spent = state.txs
      .filter(t => t.type === 'saida' && t.category.toLowerCase() === b.category.toLowerCase() && monthKey(t.date) === m)
      .reduce((a, t) => a + t.amount, 0);
    if (spent > b.limit) alerts.push(`${b.category}: ${money.format(spent)} de ${money.format(b.limit)}`);
  });
  $('budgetAlertText').textContent = alerts.length
    ? `Orçamento estourado em: ${alerts.join(' | ')}`
    : 'Sem alertas de orçamento no momento.';
}

function renderProjection() {
  const now = new Date();
  const key = monthKey(todayIso());
  const monthData = summarizeMonth(key);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const passed = now.getDate();
  const projectedEntradas = passed ? (monthData.entradas / passed) * daysInMonth : 0;
  const projectedSaidas = passed ? (monthData.saidas / passed) * daysInMonth : 0;
  const projectedSaldo = projectedEntradas - projectedSaidas;
  $('monthProjectionText').textContent = `Projeção até fim do mês: entradas ${money.format(projectedEntradas)}, saídas ${money.format(projectedSaidas)}, saldo ${money.format(projectedSaldo)}.`;
}

function renderScore() {
  const s = summary();
  const m = monthKey(todayIso());
  const activeBudgets = state.budgets.length;
  let score = 100;
  if (s.saldo < 0) score -= 30;
  if (s.saidas > s.entradas) score -= 20;
  if (activeBudgets > 0) {
    let exceeded = 0;
    state.budgets.forEach(b => {
      const spent = state.txs
        .filter(t => t.type === 'saida' && t.category.toLowerCase() === b.category.toLowerCase() && monthKey(t.date) === m)
        .reduce((a, t) => a + t.amount, 0);
      if (spent > b.limit) exceeded += 1;
    });
    score -= exceeded * 10;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  $('financeScore').textContent = `${score}/100`;
  $('financeScoreHint').textContent = score >= 80 ? 'Ótimo controle financeiro.' : score >= 60 ? 'Bom, mas com pontos de atenção.' : 'Risco financeiro elevado no mês.';
}

function renderClosureSummary() {
  const key = state.closureMonth;
  $('closureMonth').value = key;
  const saved = state.closures[key];
  if (!saved) {
    $('monthSummaryText').textContent = 'Sem fechamento salvo para este mês.';
    return;
  }
  $('monthSummaryText').textContent = `Fechado em ${new Date(saved.closedAt).toLocaleDateString('pt-BR')}: entradas ${money.format(saved.entradas)}, saídas ${money.format(saved.saidas)}, saldo ${money.format(saved.saldo)} (${saved.count} transações).`;
}

function renderRecurring() {
  const list = $('recurringList');
  const items = detectRecurringExpenses();
  list.innerHTML = '';
  if (!items.length) {
    list.innerHTML = '<p class="legend">Nenhum gasto recorrente detectado.</p>';
    return;
  }
  items.forEach(r => {
    const el = document.createElement('div');
    el.className = 'goal-item';
    el.innerHTML = `<div class="goal-head"><strong>${r.description}</strong><button class="ghost small rec-ignore" data-key="${r.key}">Ignorar</button></div><p class="legend">${money.format(r.amount)} • ${r.months} meses (${r.occurrences} lançamentos)</p>`;
    list.appendChild(el);
  });
  document.querySelectorAll('.rec-ignore').forEach(b => b.onclick = () => {
    state.ignoredRecurring.push(b.dataset.key);
    renderAll();
  });
}

function closeCurrentMonth() {
  const key = monthKey(todayIso());
  const data = summarizeMonth(key);
  state.closures[key] = { ...data, closedAt: new Date().toISOString() };
  state.closureMonth = key;
  alert(`Mês ${key} fechado com sucesso.`);
  setPage('dashboard');
  const target = $('monthSummaryText');
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  renderAll();
}


function drawChart() {
  const c = $('chart');
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  const currentMonth = monthKey(todayIso());
  const [yy, mm] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(yy, mm, 0).getDate();
  const p = 34;
  const plotW = c.width - p * 2;
  const plotH = c.height - p * 2;

  const entradas = [];
  const saidas = [];
  const saldoAcc = [];
  let acc = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const dtx = state.txs.filter(t => parseIsoLocal(t.date).getDate() === day && monthKey(t.date) === currentMonth);
    const ent = dtx.filter(t => t.type === 'entrada').reduce((a, t) => a + t.amount, 0);
    const sai = dtx.filter(t => t.type === 'saida').reduce((a, t) => a + t.amount, 0);
    acc += ent - sai;
    entradas.push(ent);
    saidas.push(sai);
    saldoAcc.push(acc);
  }

  const maxBar = Math.max(1, ...entradas, ...saidas);
  const minLine = Math.min(0, ...saldoAcc);
  const maxLine = Math.max(1, ...saldoAcc);

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = p + (plotH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(p, y);
    ctx.lineTo(c.width - p, y);
    ctx.stroke();
  }

  const stepX = plotW / daysInMonth;
  const barW = Math.max(2, stepX * 0.3);

  for (let i = 0; i < daysInMonth; i++) {
    const xMid = p + i * stepX + stepX / 2;
    const entH = (entradas[i] / maxBar) * (plotH * 0.35);
    const saiH = (saidas[i] / maxBar) * (plotH * 0.35);
    const baseY = p + plotH;

    if (entH > 0) {
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(xMid - barW - 1, baseY - entH, barW, entH);
    }
    if (saiH > 0) {
      ctx.fillStyle = '#f87171';
      ctx.fillRect(xMid + 1, baseY - saiH, barW, saiH);
    }
  }

  ctx.strokeStyle = '#b8922e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  saldoAcc.forEach((v, i) => {
    const x = p + i * stepX + stepX / 2;
    const y = p + (1 - (v - minLine) / (maxLine - minLine || 1)) * (plotH * 0.6);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function filteredTxs() {
  const q = $('searchTx').value.trim().toLowerCase();
  const type = $('filterType').value;
  const cat = $('filterCategory').value.trim().toLowerCase();
  const from = $('filterFrom').value;
  const to = $('filterTo').value;
  return [...state.txs].reverse().filter(t => {
    if (q && !t.description.toLowerCase().includes(q)) return false;
    if (type && t.type !== type) return false;
    if (cat && !t.category.toLowerCase().includes(cat)) return false;
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    return true;
  });
}

function renderTable() {
  const body = $('txBody');
  const moreWrap = $('historyMoreWrap');
  const moreBtn = $('historyMoreBtn');
  const all = filteredTxs();
  const visible = state.historyExpanded ? all : all.slice(0, 3);
  body.innerHTML = '';
  visible.forEach(tx => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${tx.description}<br><small>${tx.category}${tx.installment ? ` • ${tx.installment}` : ''}</small></td><td>${parseIsoLocal(tx.date).toLocaleDateString('pt-BR')}</td><td style="font-weight:700;color:${tx.type === 'saida' ? '#fb7185' : '#34d399'}">${tx.type === 'saida' ? '-' : '+'} ${money.format(tx.amount)}</td><td><button class="ghost small del" data-id="${tx.id}" title="Excluir">X</button></td>`;
    body.appendChild(tr);
  });
  moreWrap.classList.toggle('hidden', all.length <= 3);
  moreBtn.textContent = state.historyExpanded ? 'Ver menos' : 'Ver mais';
  document.querySelectorAll('.del').forEach(b => b.onclick = () => { state.txs = state.txs.filter(t => t.id !== b.dataset.id); renderAll(); });
}

function renderGoals() { const list = $('goalsList'); list.innerHTML = ''; $('goalsCount').textContent = state.goals.length; $('goalsDone').textContent = state.goals.filter(g => g.current >= g.target).length; if (!state.goals.length) { list.innerHTML = '<p class="legend">Nenhuma meta criada.</p>'; return; } state.goals.forEach(g => { const pr = Math.max(0, Math.min(100, g.current / g.target * 100)); const el = document.createElement('div'); el.className = 'goal-item'; el.innerHTML = `<div class="goal-head"><strong>${g.name}</strong><div class="row"><button class="ghost small add" data-id="${g.id}">+ aporte</button><button class="ghost small goal-del" data-id="${g.id}">Excluir</button></div></div><p class="legend">${money.format(g.current)} de ${money.format(g.target)} (${pr.toFixed(1)}%)</p><div class="progress"><i style="width:${pr}%"></i></div>`; list.appendChild(el); }); document.querySelectorAll('.goal-del').forEach(b => b.onclick = () => { state.goals = state.goals.filter(g => g.id !== b.dataset.id); renderAll(); }); document.querySelectorAll('.add').forEach(b => b.onclick = () => { const v = Number(prompt('Valor do aporte (R$):', '100') || 0); if (v > 0) { const g = state.goals.find(x => x.id === b.dataset.id); g.current += v; state.xp += 12; renderAll(); } }); }
function renderBudgets() { const box = $('budgetList'); box.innerHTML = ''; if (!state.budgets.length) { box.innerHTML = '<p class="legend">Sem orçamentos.</p>'; return; } const m = monthKey(todayIso()); state.budgets.forEach(b => { const spent = state.txs.filter(t => t.type === 'saida' && t.category.toLowerCase() === b.category.toLowerCase() && monthKey(t.date) === m).reduce((a, t) => a + t.amount, 0); const pr = Math.min(100, spent / b.limit * 100); const el = document.createElement('div'); el.className = 'goal-item'; el.innerHTML = `<div class="goal-head"><strong>${b.category}</strong><button class="ghost small bdel" data-id="${b.id}">Excluir</button></div><p class="legend">${money.format(spent)} de ${money.format(b.limit)} (${pr.toFixed(1)}%)</p><div class="progress"><i style="width:${pr}%"></i></div>`; box.appendChild(el); }); document.querySelectorAll('.bdel').forEach(b => b.onclick = () => { state.budgets = state.budgets.filter(x => x.id !== b.dataset.id); renderAll(); }); }
function renderCalendar() {
  const cal = $('calendar');
  const monthInput = $('calendarMonth');
  const m = state.calendarMonth || monthKey(todayIso());
  monthInput.value = m;
  cal.innerHTML = '';
  const [year, month] = m.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${m}-${String(d).padStart(2, '0')}`;
    const ent = state.txs.filter(t => t.date === date && t.type === 'entrada').reduce((a, t) => a + t.amount, 0);
    const sai = state.txs.filter(t => t.date === date && t.type === 'saida').reduce((a, t) => a + t.amount, 0);
    const div = document.createElement('div');
    div.className = 'cal-day';
    div.innerHTML = `<b>${String(d).padStart(2, '0')}</b><small>+${ent.toFixed(2).replace('.', ',')} / -${sai.toFixed(2).replace('.', ',')}</small>`;
    if (sai > ent) div.classList.add('bad');
    else if (ent > 0 || sai > 0) div.classList.add('good');
    cal.appendChild(div);
  }
}
function renderObjective() { const open = state.goals.filter(g => g.current < g.target).sort((a, b) => (b.target - b.current) - (a.target - a.current))[0]; $('objectiveText').textContent = open ? `Modo objetivo: foco em "${open.name}". Falta ${money.format(open.target - open.current)}.` : 'Crie uma meta para ativar o modo objetivo.'; }

function renderCompare() {
  const selected = state.compareMonth;
  const prev = prevMonth(selected);
  const nowSum = monthSummaryByKey(selected);
  const prevSum = monthSummaryByKey(prev);

  $('compareMonth').value = selected;
  $('cmpEntradas').textContent = `${money.format(nowSum.entradas)} (${(prevSum.entradas ? ((nowSum.entradas - prevSum.entradas) / prevSum.entradas) * 100 : 0).toFixed(1)}%)`;
  $('cmpSaidas').textContent = `${money.format(nowSum.saidas)} (${(prevSum.saidas ? ((nowSum.saidas - prevSum.saidas) / prevSum.saidas) * 100 : 0).toFixed(1)}%)`;
  $('cmpSaldo').textContent = `${money.format(nowSum.saldo)} vs ${money.format(prevSum.saldo)}`;
  const varSaldo = prevSum.saldo === 0 ? 0 : ((nowSum.saldo - prevSum.saldo) / Math.abs(prevSum.saldo)) * 100;
  $('cmpVariacao').textContent = `${varSaldo.toFixed(1)}%`;
}

function exportCsv() { const rows = ['tipo,descricao,categoria,valor,data']; state.txs.forEach(t => rows.push(`${t.type},"${t.description}","${t.category}",${t.amount},${t.date}`)); const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'transacoes.csv'; a.click(); URL.revokeObjectURL(a.href); }
function importCsv(file) { const r = new FileReader(); r.onload = () => { const text = String(r.result || '').trim(); const lines = text.split(/\r?\n/).slice(1); lines.forEach(line => { const parts = line.match(/("[^"]*"|[^,]+)/g); if (!parts || parts.length < 5) return; const type = parts[0].replaceAll('"', '').trim().toLowerCase(); const description = parts[1].replaceAll('"', '').trim(); const category = parts[2].replaceAll('"', '').trim() || 'Geral'; const amount = Number(parts[3].replace(',', '.')); const date = parts[4].replaceAll('"', '').trim(); if ((type === 'entrada' || type === 'saida') && description && amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date)) state.txs.push({ id: crypto.randomUUID(), type, description, category, amount, date }); }); renderAll(); }; r.readAsText(file); }
function backupJson() { const data = { txs: state.txs, goals: state.goals, budgets: state.budgets, xp: state.xp, streak: state.streak, achievements: state.achievements }; const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pulse-backup.json'; a.click(); URL.revokeObjectURL(a.href); }
function restoreJson(file) { const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result); state.txs = d.txs || []; state.goals = d.goals || []; state.budgets = d.budgets || []; state.xp = d.xp || 0; state.streak = d.streak || 0; state.achievements = d.achievements || []; renderAll(); } catch { alert('Backup inválido'); } }; r.readAsText(file); }


function renderUsers() {
  const body = $('usersBody');
  const menuLink = $('usersMenuLink');
  if (!body || !menuLink) return;

  const me = currentAccount();
  const isAdmin = Boolean(me && me.isAdmin);
  const adminOnly = Boolean(me && me.isAdmin && me.email === ADMIN_ONLY_EMAIL);

  menuLink.classList.toggle('hidden', !isAdmin);
  document.querySelectorAll('.rail-btn[data-page="users"]').forEach((btn) => {
    btn.classList.toggle('hidden', !isAdmin);
  });
  document.querySelectorAll('.item[data-page="dashboard"], .item[data-page="movements"], .item[data-page="planning"]').forEach((el) => {
    el.classList.toggle('hidden', adminOnly);
  });
  document.querySelectorAll('.rail-btn[data-page="dashboard"], .rail-btn[data-page="movements"], .rail-btn[data-page="planning"]').forEach((el) => {
    el.classList.toggle('hidden', adminOnly);
  });
  const closeMonthBtn = $('closeMonthBtn');
  if (closeMonthBtn) closeMonthBtn.classList.toggle('hidden', adminOnly);

  if (!isAdmin) {
    if (!$('usersPage').classList.contains('hidden')) setPage('dashboard');
    return;
  }
  if (adminOnly) setPage('users');

  body.innerHTML = '';
  state.accounts.forEach((acc) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${acc.name}</td><td>${acc.email}</td><td>${acc.isAdmin ? 'Admin' : 'Usuário'}${acc.isBlocked ? ' • Bloqueado' : ''}</td><td>${acc.email === 'alessandro@pulse.local' ? '' : `<div class="user-actions"><button class="ghost small ureset" data-id="${acc.id}">Resetar senha</button><button class="ghost small ublock" data-id="${acc.id}">${acc.isBlocked ? 'Desbloquear' : 'Bloquear'}</button><button class="ghost small udel danger" data-id="${acc.id}">Excluir</button></div>`}</td>`;
    body.appendChild(tr);
  });

  document.querySelectorAll('.ureset').forEach((btn) => {
    btn.onclick = () => {
      const acc = state.accounts.find((a) => a.id === btn.dataset.id);
      if (!acc) return;
      const np = prompt('Nova senha (mín. 6):');
      if (!np || np.length < 6) return;
      acc.password = np;
      upsertAccountToSupabase(acc);
      renderAll();
    };
  });

  document.querySelectorAll('.ublock').forEach((btn) => {
    btn.onclick = () => {
      const acc = state.accounts.find((a) => a.id === btn.dataset.id);
      if (!acc) return;
      acc.isBlocked = !acc.isBlocked;
      upsertAccountToSupabase(acc);
      renderAll();
    };
  });

  document.querySelectorAll('.udel').forEach((btn) => {
    btn.onclick = () => {
      const target = state.accounts.find((a) => a.id === btn.dataset.id);
      state.accounts = state.accounts.filter((a) => a.id !== btn.dataset.id);
      if (target) deleteAccountFromSupabase(target.email);
      renderAll();
    };
  });
}
function renderAll() {
  const s = summary();
  $('saldo').textContent = money.format(s.saldo);
  $('entradas').textContent = money.format(s.entradas);
  $('saidas').textContent = money.format(s.saidas);
  $('eficiencia').textContent = `${s.eficiencia.toFixed(1)}%`;
  $('insightText').textContent = s.saidas > s.entradas ? 'Atenção: saídas acima das entradas.' : 'Fluxo financeiro sob controle.';
  $('userEmail').textContent = localStorage.getItem('pulse_user') || 'Usuario';
  renderTable();
  renderGoals();
  renderBudgets();
  renderCalendar();
  renderObjective();
  renderCompare();
  renderBudgetAlerts();
  renderProjection();
  renderScore();
  renderClosureSummary();
  renderRecurring();
  renderUsers();
  drawChart();
  save();
}

document.querySelectorAll('[data-page]').forEach(link => link.onclick = () => {
  document.querySelectorAll('[data-page]').forEach(i => i.classList.remove('active'));
  link.classList.add('active');
  const page = link.dataset.page;
  setPage(page);
  const railMain = document.querySelector(`.rail-btn[data-page="${page}"]`);
  if (railMain) {
    document.querySelectorAll('.rail-btn').forEach(i => i.classList.remove('active'));
    railMain.classList.add('active');
  }
});
document.querySelectorAll('.type').forEach(btn => btn.onclick = () => { state.currentType = btn.dataset.type; document.querySelectorAll('.type').forEach(t => t.classList.remove('active')); btn.classList.add('active'); });
$('compareMonth').addEventListener('change', (e) => { state.compareMonth = e.target.value || monthKey(todayIso()); renderCompare(); save(); });
$('calendarMonth').addEventListener('change', (e) => {
  state.calendarMonth = e.target.value || monthKey(todayIso());
  renderCalendar();
  save();
});
$('closureMonth').addEventListener('change', (e) => {
  state.closureMonth = e.target.value || monthKey(todayIso());
  renderClosureSummary();
  save();
});

const updateInstallmentUI = () => {
  const btn = $('parcelToggle');
  const wrap = $('installmentsWrap');
  btn.classList.toggle('active', state.installmentMode);
  btn.textContent = `Parcelar: ${state.installmentMode ? 'Ativado' : 'Desativado'}`;
  wrap.classList.toggle('hidden', !state.installmentMode);
};

$('txForm').onsubmit = (e) => {
  e.preventDefault();
  const description = $('desc').value.trim();
  const amount = Number($('amount').value);
  const category = $('category').value.trim() || 'Geral';
  const installments = state.installmentMode ? Math.max(2, Number($('installments').value) || 2) : 1;
  if (!description || amount <= 0) return;

  if (installments > 1) {
    const totalCents = Math.round(amount * 100);
    const baseCents = Math.floor(totalCents / installments);
    const remainder = totalCents % installments;
    for (let i = 0; i < installments; i++) {
      const d = parseIsoLocal(todayIso());
      d.setMonth(d.getMonth() + i);
      const partCents = baseCents + (i < remainder ? 1 : 0);
      const part = partCents / 100;
      state.txs.push({
        id: crypto.randomUUID(),
        type: state.currentType,
        description,
        amount: part,
        category,
        date: dateToIsoLocal(d),
        installment: `${i + 1}/${installments}`,
      });
    }
  } else {
    state.txs.push({ id: crypto.randomUUID(), type: state.currentType, description, amount, category, date: todayIso() });
  }

  state.xp += 8;
  state.streak += 1;
  e.target.reset();
  $('category').value = 'Geral';
  $('installments').value = '2';
  state.installmentMode = false;
  updateInstallmentUI();
  renderAll();
};
$('goalForm').onsubmit = (e) => { e.preventDefault(); const name = $('goalName').value.trim(); const target = Number($('goalTarget').value); const current = Number($('goalCurrent').value); if (!name || target <= 0 || current < 0) return; state.goals.push({ id: crypto.randomUUID(), name, target, current }); renderAll(); e.target.reset(); $('goalCurrent').value = '0'; };
$('budgetForm').onsubmit = (e) => { e.preventDefault(); const category = $('budgetCategory').value.trim(); const limit = Number($('budgetLimit').value); if (!category || limit <= 0) return; const found = state.budgets.find(b => b.category.toLowerCase() === category.toLowerCase()); if (found) found.limit = limit; else state.budgets.push({ id: crypto.randomUUID(), category, limit }); renderAll(); e.target.reset(); };
$('autoGoal').onclick = () => { const month = monthKey(todayIso()); const entradas = state.txs.filter(t => t.type === 'entrada' && monthKey(t.date) === month).reduce((a, t) => a + t.amount, 0); const saidas = state.txs.filter(t => t.type === 'saida' && monthKey(t.date) === month).reduce((a, t) => a + t.amount, 0); const target = Math.max(200, (entradas - saidas) * 0.3 || 300); state.goals.push({ id: crypto.randomUUID(), name: `Reserva ${month}`, target: Number(target.toFixed(2)), current: 0 }); renderAll(); };
if ($('userForm')) $('userForm').onsubmit = (e) => { e.preventDefault(); const me = currentAccount(); if (!me || !me.isAdmin) return; const name = $('userName').value.trim(); const email = $('userEmail').value.trim().toLowerCase(); const password = $('userPassword').value; if (!name || !email || password.length < 6) return; if (state.accounts.some(a => a.email === email)) { alert('Já existe usuário com esse e-mail.'); return; } const newAcc = { id: crypto.randomUUID(), name, email, password, isAdmin: false, isBlocked: false, createdAt: new Date().toISOString() }; state.accounts.push(newAcc); upsertAccountToSupabase(newAcc); e.target.reset(); renderAll(); };
['searchTx', 'filterType', 'filterCategory', 'filterFrom', 'filterTo'].forEach(id => $(id).addEventListener('input', renderTable));
$('clearAll').onclick = () => { if (confirm('Limpar todas as transações?')) { state.txs = []; state.xp = 0; state.streak = 0; renderAll(); } };
const doLogout = () => { localStorage.removeItem('pulse_auth'); localStorage.removeItem('pulse_user'); window.location.replace('login.html'); };
if ($('logoutBtn')) $('logoutBtn').onclick = doLogout;
if ($('railLogoutBtn')) $('railLogoutBtn').onclick = doLogout;
if ($('railLogoutTextBtn')) $('railLogoutTextBtn').onclick = doLogout;
$('railToggle').onclick = () => setRailCollapsed(!$('leftRail').classList.contains('collapsed'));
$('closeMonthBtn').addEventListener('click', (e) => { e.preventDefault(); closeCurrentMonth(); });
$('historyMoreBtn').onclick = () => { state.historyExpanded = !state.historyExpanded; renderTable(); };
$('parcelToggle').onclick = () => {
  state.installmentMode = !state.installmentMode;
  updateInstallmentUI();
};
document.querySelectorAll('.rail-btn').forEach(btn => btn.onclick = () => {
  if (!btn.dataset.page) return;
  const page = btn.dataset.page || 'dashboard';
  document.querySelectorAll('[data-page]').forEach(i => i.classList.remove('active'));
  document.querySelectorAll(`[data-page="${page}"]`).forEach(i => i.classList.add('active'));
  setPage(page);
  document.querySelectorAll('.rail-btn').forEach(i => i.classList.remove('active'));
  btn.classList.add('active');
  const targetId = btn.dataset.target;
  const target = targetId ? $(targetId) : null;
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

async function initApp() {
  ensureAccounts();
  await syncAccountsFromSupabase();
  await hydrateStateFromSupabase();
  const railState = localStorage.getItem('pulse_left_rail_collapsed');
  setRailCollapsed(railState === null ? false : railState === '1');
  setPage('dashboard');
  updateInstallmentUI();
  renderAll();
}
initApp();






window.addEventListener('pageshow', () => { requireAuth(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) requireAuth(); });
window.addEventListener('popstate', () => { requireAuth(); });




document.addEventListener('click', (e) => {
  const target = e.target && e.target.closest ? e.target.closest('#railLogoutTextBtn, #railLogoutBtn') : null;
  if (!target) return;
  e.preventDefault();
  localStorage.removeItem('pulse_auth');
  localStorage.removeItem('pulse_user');
  window.location.replace('login.html');
});



