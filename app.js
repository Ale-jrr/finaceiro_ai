const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
if (localStorage.getItem('pulse_auth') !== '1') location.href = 'login.html';
const $ = (id) => document.getElementById(id);
const todayIso = () => new Date().toISOString().slice(0, 10);
const monthKey = (d) => new Date(d).toISOString().slice(0, 7);

const state = {
  txs: JSON.parse(localStorage.getItem('pulse_txs') || '[]'),
  goals: JSON.parse(localStorage.getItem('pulse_goals') || '[]'),
  budgets: JSON.parse(localStorage.getItem('pulse_budgets') || '[]'),
  achievements: JSON.parse(localStorage.getItem('pulse_ach') || '[]'),
  currentType: 'entrada',
  xp: Number(localStorage.getItem('pulse_xp') || 0),
  streak: Number(localStorage.getItem('pulse_streak') || 0),
};
if (!state.txs.length) state.txs.push({ id: crypto.randomUUID(), type: 'entrada', description: 'Receita inicial', amount: 300, category: 'Geral', date: todayIso() });

function save() {
  localStorage.setItem('pulse_txs', JSON.stringify(state.txs));
  localStorage.setItem('pulse_goals', JSON.stringify(state.goals));
  localStorage.setItem('pulse_budgets', JSON.stringify(state.budgets));
  localStorage.setItem('pulse_ach', JSON.stringify(state.achievements));
  localStorage.setItem('pulse_xp', state.xp);
  localStorage.setItem('pulse_streak', state.streak);
}

function summary() {
  const entradas = state.txs.filter(t => t.type === 'entrada').reduce((a, t) => a + t.amount, 0);
  const saidas = state.txs.filter(t => t.type === 'saida').reduce((a, t) => a + t.amount, 0);
  return { entradas, saidas, saldo: entradas - saidas, eficiencia: saidas === 0 ? (entradas > 0 ? 100 : 0) : (entradas / saidas * 100) };
}

function monthlySummary(shift = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + shift);
  const key = d.toISOString().slice(0, 7);
  const tx = state.txs.filter(t => monthKey(t.date) === key);
  const entradas = tx.filter(t => t.type === 'entrada').reduce((a, t) => a + t.amount, 0);
  const saidas = tx.filter(t => t.type === 'saida').reduce((a, t) => a + t.amount, 0);
  return { entradas, saidas, saldo: entradas - saidas };
}

function drawChart() {
  const c = $('chart');
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  const points = [];
  let acc = 0;
  for (let day = 1; day <= 30; day++) {
    const dtx = state.txs.filter(t => new Date(t.date).getDate() === day && monthKey(t.date) === monthKey(todayIso()));
    acc += dtx.reduce((a, t) => a + (t.type === 'entrada' ? t.amount : -t.amount), 0);
    points.push(acc);
  }
  const min = Math.min(0, ...points), max = Math.max(100, ...points), p = 34;
  ctx.strokeStyle = '#2c4475';
  for (let i = 0; i <= 4; i++) {
    const y = p + ((c.height - p * 2) / 4) * i;
    ctx.beginPath(); ctx.moveTo(p, y); ctx.lineTo(c.width - p, y); ctx.stroke();
  }
  ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 3; ctx.beginPath();
  points.forEach((v, i) => {
    const x = p + i / (points.length - 1) * (c.width - p * 2);
    const y = p + (1 - (v - min) / (max - min || 1)) * (c.height - p * 2);
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
  body.innerHTML = '';
  filteredTxs().slice(0, 100).forEach(tx => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${tx.description}<br><small>${tx.category}${tx.installment ? ` • ${tx.installment}` : ''}</small></td><td>${new Date(tx.date).toLocaleDateString('pt-BR')}</td><td style="font-weight:700;color:${tx.type === 'saida' ? '#fb7185' : '#34d399'}">${tx.type === 'saida' ? '-' : '+'} ${money.format(tx.amount)}</td><td><button class="ghost small del" data-id="${tx.id}">Excluir</button></td>`;
    body.appendChild(tr);
  });
  document.querySelectorAll('.del').forEach(b => b.onclick = () => { state.txs = state.txs.filter(t => t.id !== b.dataset.id); renderAll(); });
}

function renderGoals() {
  const list = $('goalsList'); list.innerHTML = '';
  $('goalsCount').textContent = state.goals.length;
  $('goalsDone').textContent = state.goals.filter(g => g.current >= g.target).length;
  if (!state.goals.length) { list.innerHTML = '<p class="legend">Nenhuma meta criada.</p>'; return; }
  state.goals.forEach(g => {
    const pr = Math.max(0, Math.min(100, g.current / g.target * 100));
    const el = document.createElement('div'); el.className = 'goal-item';
    el.innerHTML = `<div class="goal-head"><strong>${g.name}</strong><div class="row"><button class="ghost small add" data-id="${g.id}">+ aporte</button><button class="ghost small goal-del" data-id="${g.id}">Excluir</button></div></div><p class="legend">${money.format(g.current)} de ${money.format(g.target)} (${pr.toFixed(1)}%)</p><div class="progress"><i style="width:${pr}%"></i></div>`;
    list.appendChild(el);
  });
  document.querySelectorAll('.goal-del').forEach(b => b.onclick = () => { state.goals = state.goals.filter(g => g.id !== b.dataset.id); renderAll(); });
  document.querySelectorAll('.add').forEach(b => b.onclick = () => { const v = Number(prompt('Valor do aporte (R$):', '100') || 0); if (v > 0) { const g = state.goals.find(x => x.id === b.dataset.id); g.current += v; state.xp += 12; renderAll(); } });
}

function renderBudgets() {
  const box = $('budgetList'); box.innerHTML = '';
  if (!state.budgets.length) { box.innerHTML = '<p class="legend">Sem orçamentos.</p>'; return; }
  const m = monthKey(todayIso());
  state.budgets.forEach(b => {
    const spent = state.txs.filter(t => t.type === 'saida' && t.category.toLowerCase() === b.category.toLowerCase() && monthKey(t.date) === m).reduce((a, t) => a + t.amount, 0);
    const pr = Math.min(100, spent / b.limit * 100);
    const el = document.createElement('div'); el.className = 'goal-item';
    el.innerHTML = `<div class="goal-head"><strong>${b.category}</strong><button class="ghost small bdel" data-id="${b.id}">Excluir</button></div><p class="legend">${money.format(spent)} de ${money.format(b.limit)} (${pr.toFixed(1)}%)</p><div class="progress"><i style="width:${pr}%"></i></div>`;
    box.appendChild(el);
  });
  document.querySelectorAll('.bdel').forEach(b => b.onclick = () => { state.budgets = state.budgets.filter(x => x.id !== b.dataset.id); renderAll(); });
}

function renderCalendar() {
  const cal = $('calendar'); cal.innerHTML = '';
  const m = monthKey(todayIso());
  for (let d = 1; d <= 31; d++) {
    const date = `${m}-${String(d).padStart(2, '0')}`;
    const ent = state.txs.filter(t => t.date === date && t.type === 'entrada').reduce((a, t) => a + t.amount, 0);
    const sai = state.txs.filter(t => t.date === date && t.type === 'saida').reduce((a, t) => a + t.amount, 0);
    const div = document.createElement('div'); div.className = 'cal-day';
    div.innerHTML = `<b>${String(d).padStart(2, '0')}</b><small>+${ent.toFixed(0)} / -${sai.toFixed(0)}</small>`;
    if (sai > ent) div.classList.add('bad'); else if (ent > 0 || sai > 0) div.classList.add('good');
    cal.appendChild(div);
  }
}

function renderObjective() {
  const open = state.goals.filter(g => g.current < g.target).sort((a, b) => (b.target - b.current) - (a.target - a.current))[0];
  $('objectiveText').textContent = open ? `Modo objetivo: foco em "${open.name}". Falta ${money.format(open.target - open.current)}.` : 'Crie uma meta para ativar o modo objetivo.';
}

function renderCompare() {
  const now = monthlySummary(0);
  const prev = monthlySummary(-1);
  $('cmpEntradas').textContent = `${money.format(now.entradas)} (${((prev.entradas ? ((now.entradas - prev.entradas) / prev.entradas) : 0) * 100).toFixed(1)}%)`;
  $('cmpSaidas').textContent = `${money.format(now.saidas)} (${((prev.saidas ? ((now.saidas - prev.saidas) / prev.saidas) : 0) * 100).toFixed(1)}%)`;
  $('cmpSaldo').textContent = `${money.format(now.saldo)} vs ${money.format(prev.saldo)}`;
  const varSaldo = prev.saldo === 0 ? 0 : ((now.saldo - prev.saldo) / Math.abs(prev.saldo)) * 100;
  $('cmpVariacao').textContent = `${varSaldo.toFixed(1)}%`;
}

function exportCsv() {
  const rows = ['tipo,descricao,categoria,valor,data'];
  state.txs.forEach(t => rows.push(`${t.type},"${t.description}","${t.category}",${t.amount},${t.date}`));
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'transacoes.csv'; a.click(); URL.revokeObjectURL(a.href);
}

function importCsv(file) {
  const r = new FileReader();
  r.onload = () => {
    const text = String(r.result || '').trim();
    const lines = text.split(/\r?\n/).slice(1);
    lines.forEach(line => {
      const parts = line.match(/("[^"]*"|[^,]+)/g);
      if (!parts || parts.length < 5) return;
      const type = parts[0].replaceAll('"', '').trim().toLowerCase();
      const description = parts[1].replaceAll('"', '').trim();
      const category = parts[2].replaceAll('"', '').trim() || 'Geral';
      const amount = Number(parts[3].replace(',', '.'));
      const date = parts[4].replaceAll('"', '').trim();
      if ((type === 'entrada' || type === 'saida') && description && amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        state.txs.push({ id: crypto.randomUUID(), type, description, category, amount, date });
      }
    });
    renderAll();
  };
  r.readAsText(file);
}

function backupJson() {
  const data = { txs: state.txs, goals: state.goals, budgets: state.budgets, xp: state.xp, streak: state.streak, achievements: state.achievements };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pulse-backup.json'; a.click(); URL.revokeObjectURL(a.href);
}

function restoreJson(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      state.txs = d.txs || [];
      state.goals = d.goals || [];
      state.budgets = d.budgets || [];
      state.xp = d.xp || 0;
      state.streak = d.streak || 0;
      state.achievements = d.achievements || [];
      renderAll();
    } catch { alert('Backup inválido'); }
  };
  r.readAsText(file);
}

function renderAll() {
  const s = summary();
  $('saldo').textContent = money.format(s.saldo);
  $('entradas').textContent = money.format(s.entradas);
  $('saidas').textContent = money.format(s.saidas);
  $('eficiencia').textContent = `${s.eficiencia.toFixed(1)}%`;
  $('insightText').textContent = s.saidas > s.entradas ? 'Atenção: saídas acima das entradas.' : 'Fluxo financeiro sob controle.';
  const level = Math.floor(Math.sqrt(state.xp / 100)) + 1;
  $('userEmail').textContent = localStorage.getItem('pulse_user') || 'Usuario';
  renderTable();
  renderGoals();
  renderBudgets();
  renderCalendar();
  renderObjective();
  renderCompare();
  drawChart();
  save();
}

document.querySelectorAll('[data-page]').forEach(link => link.onclick = () => {
  document.querySelectorAll('[data-page]').forEach(i => i.classList.remove('active'));
  link.classList.add('active');
  const page = link.dataset.page;
  $('dashboardPage').classList.toggle('hidden', page !== 'dashboard');
  $('planningPage').classList.toggle('hidden', page !== 'planning');
});

document.querySelectorAll('.type').forEach(btn => btn.onclick = () => {
  state.currentType = btn.dataset.type;
  document.querySelectorAll('.type').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
});

$('txForm').onsubmit = (e) => {
  e.preventDefault();
  const description = $('desc').value.trim();
  const amount = Number($('amount').value);
  const category = $('category').value.trim() || 'Geral';
  const installments = Math.max(1, Number($('installments').value) || 1);
  if (!description || amount <= 0) return;
  if (installments > 1 && state.currentType === 'saida') {
    const each = Number((amount / installments).toFixed(2));
    for (let i = 0; i < installments; i++) {
      const d = new Date(); d.setMonth(d.getMonth() + i);
      state.txs.push({ id: crypto.randomUUID(), type: 'saida', description, amount: each, category, date: d.toISOString().slice(0, 10), installment: `${i + 1}/${installments}` });
    }
  } else {
    state.txs.push({ id: crypto.randomUUID(), type: state.currentType, description, amount, category, date: todayIso() });
  }
  state.xp += 8;
  state.streak += 1;
  e.target.reset();
  $('category').value = 'Geral';
  $('installments').value = '1';
  renderAll();
};

$('goalForm').onsubmit = (e) => {
  e.preventDefault();
  const name = $('goalName').value.trim();
  const target = Number($('goalTarget').value);
  const current = Number($('goalCurrent').value);
  if (!name || target <= 0 || current < 0) return;
  state.goals.push({ id: crypto.randomUUID(), name, target, current });
  renderAll();
  e.target.reset();
  $('goalCurrent').value = '0';
};

$('budgetForm').onsubmit = (e) => {
  e.preventDefault();
  const category = $('budgetCategory').value.trim();
  const limit = Number($('budgetLimit').value);
  if (!category || limit <= 0) return;
  const found = state.budgets.find(b => b.category.toLowerCase() === category.toLowerCase());
  if (found) found.limit = limit; else state.budgets.push({ id: crypto.randomUUID(), category, limit });
  renderAll();
  e.target.reset();
};

$('autoGoal').onclick = () => {
  const month = monthKey(todayIso());
  const entradas = state.txs.filter(t => t.type === 'entrada' && monthKey(t.date) === month).reduce((a, t) => a + t.amount, 0);
  const saidas = state.txs.filter(t => t.type === 'saida' && monthKey(t.date) === month).reduce((a, t) => a + t.amount, 0);
  const target = Math.max(200, (entradas - saidas) * 0.3 || 300);
  state.goals.push({ id: crypto.randomUUID(), name: `Reserva ${month}`, target: Number(target.toFixed(2)), current: 0 });
  renderAll();
};

['searchTx', 'filterType', 'filterCategory', 'filterFrom', 'filterTo'].forEach(id => $(id).addEventListener('input', renderTable));
$('insightBtn').onclick = renderAll;
$('clearAll').onclick = () => { if (confirm('Limpar todas as transações?')) { state.txs = []; state.xp = 0; state.streak = 0; renderAll(); } };
$('exportCsv').onclick = exportCsv;
$('importCsv').onchange = (e) => { const f = e.target.files[0]; if (f) importCsv(f); e.target.value = ''; };
$('backupBtn').onclick = backupJson;
$('restoreFile').onchange = (e) => { const f = e.target.files[0]; if (f) restoreJson(f); };
$('logoutBtn').onclick = () => { localStorage.removeItem('pulse_auth'); location.href = 'login.html'; };

renderAll();

