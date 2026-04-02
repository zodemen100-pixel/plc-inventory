let _deleteHandlerId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadHandlers();
  bindModalOverlayClose(['handlerModal', 'deleteModal']);
});

async function loadHandlers() {
  const grid = document.getElementById('handlerGrid');
  if (grid) grid.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
  try {
    const list = await HandlerAPI.getAll();
    renderHandlers(list);
  } catch (e) {
    if (grid) grid.innerHTML = `<p class="text-danger">오류: ${e.message}</p>`;
  }
}

function renderHandlers(list) {
  const grid = document.getElementById('handlerGrid');
  if (!grid) return;
  if (!list.length) {
    grid.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>등록된 담당자가 없습니다</p></div>';
    return;
  }
  grid.innerHTML = list.map(h => `
    <div class="handler-card">
      <div class="handler-avatar">${esc(h.name.charAt(0))}</div>
      <div class="handler-info">
        <h4>${esc(h.name)}</h4>
        <p>${esc(h.department || '부서 없음')}${h.contact ? ' · ' + esc(h.contact) : ''}</p>
      </div>
      <div class="handler-actions">
        <button class="btn btn-outline btn-sm" onclick="openEditModal('${h.id}')"><i class="fas fa-edit"></i></button>
        <button class="btn btn-danger btn-sm" onclick="openDeleteModal('${h.id}','${esc(h.name)}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

function openAddModal() {
  document.getElementById('handlerId').value = '';
  document.getElementById('handlerName').value = '';
  document.getElementById('handlerDept').value = '';
  document.getElementById('handlerContact').value = '';
  document.getElementById('handlerModalTitle').innerHTML = '<i class="fas fa-user-plus"></i> 담당자 추가';
  openOverlay('handlerModal');
  setTimeout(() => document.getElementById('handlerName').focus(), 100);
}

async function openEditModal(id) {
  const all = await HandlerAPI.getAll();
  const h = all.find(x => x.id === id);
  if (!h) return showToast('담당자를 찾을 수 없습니다', 'error');
  document.getElementById('handlerId').value = h.id;
  document.getElementById('handlerName').value = h.name;
  document.getElementById('handlerDept').value = h.department || '';
  document.getElementById('handlerContact').value = h.contact || '';
  document.getElementById('handlerModalTitle').innerHTML = '<i class="fas fa-edit"></i> 담당자 수정';
  openOverlay('handlerModal');
}

async function saveHandler() {
  const name = document.getElementById('handlerName').value.trim();
  if (!name) return showToast('이름을 입력하세요', 'error');
  const id = document.getElementById('handlerId').value || uuid();
  const h = {
    id,
    name,
    department: document.getElementById('handlerDept').value.trim(),
    contact: document.getElementById('handlerContact').value.trim(),
    sort_order: 0,
    active: true
  };
  try {
    await HandlerAPI.save(h);
    showToast('저장되었습니다', 'success');
    closeOverlay('handlerModal');
    await loadHandlers();
  } catch (e) {
    showToast('저장 실패: ' + e.message, 'error');
  }
}

function openDeleteModal(id, name) {
  _deleteHandlerId = id;
  document.getElementById('deleteMsg').textContent = `"${name}" 담당자를 삭제하시겠습니까?`;
  openOverlay('deleteModal');
}

async function confirmDelete() {
  if (!_deleteHandlerId) return;
  try {
    await HandlerAPI.delete(_deleteHandlerId);
    showToast('삭제되었습니다', 'success');
    closeOverlay('deleteModal');
    await loadHandlers();
  } catch (e) {
    showToast('삭제 실패: ' + e.message, 'error');
  }
}
