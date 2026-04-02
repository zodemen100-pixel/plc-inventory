let _allTx = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadTransactions();
  document.getElementById('searchInput')?.addEventListener('input', renderTx);
  document.getElementById('filterType')?.addEventListener('change', renderTx);
  document.getElementById('filterDateFrom')?.addEventListener('change', renderTx);
  document.getElementById('filterDateTo')?.addEventListener('change', renderTx);
});

async function loadTransactions() {
  const tbody = document.getElementById('transactionsBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i></td></tr>';
  try {
    _allTx = await TransactionAPI.getAll();
    renderTx();
  } catch (e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">오류: ${e.message}</td></tr>`;
  }
}

function renderTx() {
  const keyword = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const typeFilter = document.getElementById('filterType')?.value || '';
  const dateFrom = document.getElementById('filterDateFrom')?.value || '';
  const dateTo = document.getElementById('filterDateTo')?.value || '';
  const tbody = document.getElementById('transactionsBody');
  if (!tbody) return;

  let list = _allTx.filter(t => {
    const matchKw = !keyword ||
      (t.material_name || '').toLowerCase().includes(keyword) ||
      (t.handler || '').toLowerCase().includes(keyword);
    const matchType = !typeFilter || t.type === typeFilter;
    const txDate = t.transaction_date ? t.transaction_date.slice(0, 10) : '';
    const matchFrom = !dateFrom || txDate >= dateFrom;
    const matchTo = !dateTo || txDate <= dateTo;
    return matchKw && matchType && matchFrom && matchTo;
  });

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:40px;color:#aaa">입출고 이력이 없습니다</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(t => `
    <tr>
      <td style="font-size:.82rem;color:#666">${fmtDateTime(t.transaction_date)}</td>
      <td><strong>${esc(t.material_name || '-')}</strong></td>
      <td><span class="type-${t.type}">${t.type === 'in' ? '입고' : '출고'}</span></td>
      <td><strong style="color:${t.type === 'in' ? 'var(--success)' : 'var(--warning)'}">${t.type === 'in' ? '+' : '-'}${t.quantity}</strong></td>
      <td>${esc(t.handler || '-')}</td>
      <td style="font-size:.82rem;color:#888">${esc(t.note || '-')}</td>
    </tr>
  `).join('');
}
