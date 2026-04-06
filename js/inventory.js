let _allInv = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadInventory();
  document.getElementById('searchInput')?.addEventListener('input', renderInventory);
  document.getElementById('filterStatus')?.addEventListener('change', renderInventory);
});

async function loadInventory() {
  const tbody = document.getElementById('inventoryBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center"><i class="fas fa-spinner fa-spin"></i></td></tr>';
  try {
    _allInv = await MaterialAPI.getAll();
    renderInventory();
  } catch (e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">오류: ${e.message}</td></tr>`;
  }
}

function renderInventory() {
  const keyword = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('filterStatus')?.value || '';
  const sortBy = document.getElementById('sortBy')?.value || 'name';
  const sortOrder = document.getElementById('sortOrder')?.value || 'asc';
  const tbody = document.getElementById('inventoryBody');
  if (!tbody) return;

  let list = _allInv.filter(m => {
    const matchKw = !keyword ||
      (m.name || '').toLowerCase().includes(keyword) ||
      (m.code || '').toLowerCase().includes(keyword) ||
      (m.category || '').toLowerCase().includes(keyword) ||
      (m.location || '').toLowerCase().includes(keyword);

    const st = getStockStatus(m);
    const matchStatus = !statusFilter || st === statusFilter;
    return matchKw && matchStatus;
  });

  list.sort((a, b) => {
    let av = '';
    let bv = '';

    switch (sortBy) {
      case 'code':
        av = a.code || '';
        bv = b.code || '';
        break;
      case 'category':
        av = a.category || '';
        bv = b.category || '';
        break;
      case 'location':
        av = a.location || '';
        bv = b.location || '';
        break;
      case 'stock':
        av = Number(a.current_stock || 0);
        bv = Number(b.current_stock || 0);
        break;
      case 'min_stock':
        av = Number(a.min_stock || 0);
        bv = Number(b.min_stock || 0);
        break;
      case 'updated':
        av = new Date(a.updated_at || a.created_at || 0).getTime();
        bv = new Date(b.updated_at || b.created_at || 0).getTime();
        break;
      case 'status': {
        const rank = { critical: 0, low: 1, ok: 2 };
        av = rank[getStockStatus(a)] ?? 9;
        bv = rank[getStockStatus(b)] ?? 9;
        break;
      }
      default:
        av = a.name || '';
        bv = b.name || '';
        break;
    }

    let result = 0;
    if (typeof av === 'number' && typeof bv === 'number') {
      result = av - bv;
    } else {
      result = String(av).localeCompare(String(bv), 'ko');
    }

    return sortOrder === 'desc' ? -result : result;
  });

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:40px;color:#aaa">자재가 없습니다</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(m => {
    const st = getStockStatus(m);
    const pct = m.min_stock > 0 ? Math.min(100, Math.round((m.current_stock / m.min_stock) * 100)) : 100;
    const barColor = st === 'ok' ? 'var(--success)' : st === 'low' ? 'var(--warning)' : 'var(--danger)';

    return `<tr>
      <td><code style="font-size:.75rem;background:#f0f2f5;padding:2px 6px;border-radius:4px">${esc(m.code || '-')}</code></td>
      <td><strong>${esc(m.name)}</strong></td>
      <td><span style="font-size:.78rem;color:#666">${esc(m.category || '-')}</span></td>
      <td>${esc(m.location || '-')}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <strong>${m.current_stock ?? 0}</strong>
          <span style="font-size:.75rem;color:#888">${esc(m.unit || 'EA')}</span>
          <div style="flex:1;min-width:60px;background:#e9ecef;border-radius:4px;height:6px">
            <div style="width:${pct}%;background:${barColor};height:6px;border-radius:4px;transition:width .3s"></div>
          </div>
        </div>
      </td>
      <td>${m.min_stock ?? 0} ${esc(m.unit || 'EA')}</td>
      <td>${statusBadgeHTML(st)}</td>
      <td style="font-size:.78rem;color:#888">${fmtDate(m.updated_at || m.created_at)}</td>
    </tr>`;
  }).join('');
}
