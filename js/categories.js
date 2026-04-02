let _catTree = [];
let _deleteCatId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadCategories();
  bindModalOverlayClose(['catModal', 'catDeleteModal']);
});

async function loadCategories() {
  const wrap = document.getElementById('catTree');
  if (wrap) wrap.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
  try {
    _catTree = await CategoryAPI.getTree(true);
    renderTree();
  } catch (e) {
    if (wrap) wrap.innerHTML = `<p class="text-danger">오류: ${e.message}</p>`;
  }
}

function renderTree() {
  const wrap = document.getElementById('catTree');
  if (!wrap) return;
  const keyword = (document.getElementById('searchInput')?.value || '').toLowerCase();

  let tree = _catTree;
  if (keyword) {
    tree = tree.filter(l1 =>
      l1.name.toLowerCase().includes(keyword) ||
      (l1.children || []).some(l2 =>
        l2.name.toLowerCase().includes(keyword) ||
        (l2.children || []).some(l3 => l3.name.toLowerCase().includes(keyword))
      )
    );
  }

  if (!tree.length) {
    wrap.innerHTML = '<div class="empty-state"><i class="fas fa-sitemap"></i><p>카테고리가 없습니다<br><button class="btn btn-success btn-sm" style="margin-top:12px" onclick="openAddModal(1,null,\'\')"><i class="fas fa-plus"></i> 제조사 추가</button></p></div>';
    return;
  }

  wrap.innerHTML = tree.map(l1 => `
    <div class="cat-l1-block open">
      <div class="cat-l1-header" onclick="this.parentElement.classList.toggle('open')">
        <i class="fas fa-industry"></i>
        <span class="cat-name">${esc(l1.name)}</span>
        <span class="cat-count">${(l1.children || []).length}개 유형</span>
        <div class="cat-actions" onclick="event.stopPropagation()">
          <button class="cat-btn add" onclick="openAddModal(2,'${l1.id}','${esc(l1.name)}')" title="유형 추가"><i class="fas fa-plus"></i></button>
          <button class="cat-btn edit" onclick="openEditModal('${l1.id}')" title="수정"><i class="fas fa-edit"></i></button>
          <button class="cat-btn delete" onclick="openDeleteConfirm('${l1.id}','${esc(l1.name)}')" title="삭제"><i class="fas fa-trash"></i></button>
        </div>
        <i class="fas fa-chevron-right chevron"></i>
      </div>
      <div class="cat-l2-area">
        ${(l1.children || []).map(l2 => `
          <div class="cat-l2-block open">
            <div class="cat-l2-header" onclick="this.parentElement.classList.toggle('open')">
              <i class="fas fa-tag"></i>
              <span class="cat-name">${esc(l2.name)}</span>
              <span class="cat-count" style="font-size:.72rem;color:#888">${(l2.children || []).length}개</span>
              <div class="cat-actions" onclick="event.stopPropagation()">
                <button class="cat-btn add" onclick="openAddModal(3,'${l2.id}','${esc(l1.name)} > ${esc(l2.name)}')" title="모델 추가"><i class="fas fa-plus"></i></button>
                <button class="cat-btn edit" onclick="openEditModal('${l2.id}')" title="수정"><i class="fas fa-edit"></i></button>
                <button class="cat-btn delete" onclick="openDeleteConfirm('${l2.id}','${esc(l2.name)}')" title="삭제"><i class="fas fa-trash"></i></button>
              </div>
              <i class="fas fa-chevron-right chevron"></i>
            </div>
            <div class="cat-l3-area">
              ${(l2.children || []).map(l3 => `
                <span class="cat-l3-chip">
                  ${esc(l3.name)}
                  <span style="display:inline-flex;gap:3px;margin-left:4px">
                    <button class="cat-btn edit" style="padding:2px 4px" onclick="openEditModal('${l3.id}')"><i class="fas fa-edit"></i></button>
                    <button class="cat-btn delete" style="padding:2px 4px" onclick="openDeleteConfirm('${l3.id}','${esc(l3.name)}')"><i class="fas fa-trash"></i></button>
                  </span>
                </span>
              `).join('')}
              <button class="add-chip" onclick="openAddModal(3,'${l2.id}','${esc(l1.name)} > ${esc(l2.name)}')">
                <i class="fas fa-plus"></i> 모델 추가
              </button>
            </div>
          </div>
        `).join('')}
        <button class="add-l2-btn" onclick="openAddModal(2,'${l1.id}','${esc(l1.name)}')">
          <i class="fas fa-plus"></i> 유형 추가
        </button>
      </div>
    </div>
  `).join('');
}

function openAddModal(level, parentId, parentPath) {
  document.getElementById('catId').value = '';
  document.getElementById('catLevel').value = level;
  document.getElementById('catParentId').value = parentId || '';
  document.getElementById('catName').value = '';
  document.getElementById('catDesc').value = '';
  const labels = { 1: '제조사', 2: '유형', 3: '모델' };
  document.getElementById('catModalTitle').innerHTML = `<i class="fas fa-folder-plus"></i> ${labels[level]} 추가`;
  const info = document.getElementById('catParentInfo');
  info.style.display = parentPath ? 'block' : 'none';
  info.textContent = parentPath ? `상위: ${parentPath}` : '';
  openOverlay('catModal');
  setTimeout(() => document.getElementById('catName').focus(), 100);
}

async function openEditModal(id) {
  const all = await CategoryAPI.getAll();
  const cat = all.find(c => c.id === id);
  if (!cat) return showToast('카테고리를 찾을 수 없습니다', 'error');
  document.getElementById('catId').value = cat.id;
  document.getElementById('catLevel').value = cat.level;
  document.getElementById('catParentId').value = cat.parent_id || '';
  document.getElementById('catName').value = cat.name;
  document.getElementById('catDesc').value = cat.description || '';
  const labels = { 1: '제조사', 2: '유형', 3: '모델' };
  document.getElementById('catModalTitle').innerHTML = `<i class="fas fa-edit"></i> ${labels[cat.level]} 수정`;
  document.getElementById('catParentInfo').style.display = 'none';
  openOverlay('catModal');
  setTimeout(() => document.getElementById('catName').focus(), 100);
}

async function saveCat() {
  const name = document.getElementById('catName').value.trim();
  if (!name) return showToast('카테고리명을 입력하세요', 'error');
  const id = document.getElementById('catId').value || uuid();
  const cat = {
    id,
    level: parseInt(document.getElementById('catLevel').value),
    parent_id: document.getElementById('catParentId').value || null,
    name,
    description: document.getElementById('catDesc').value.trim(),
    sort_order: 0
  };
  try {
    await CategoryAPI.save(cat);
    showToast('저장되었습니다', 'success');
    closeOverlay('catModal');
    await loadCategories();
  } catch (e) {
    showToast('저장 실패: ' + e.message, 'error');
  }
}

function openDeleteConfirm(id, name) {
  _deleteCatId = id;
  document.getElementById('catDeleteMsg').textContent = `"${name}" 을(를) 삭제하시겠습니까? 하위 카테고리도 함께 삭제됩니다.`;
  openOverlay('catDeleteModal');
}

async function doDeleteCat() {
  if (!_deleteCatId) return;
  try {
    await CategoryAPI.delete(_deleteCatId);
    showToast('삭제되었습니다', 'success');
    closeOverlay('catDeleteModal');
    await loadCategories();
  } catch (e) {
    showToast('삭제 실패: ' + e.message, 'error');
  }
}
