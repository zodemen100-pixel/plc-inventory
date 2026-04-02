/* handlers.js */
let handlerEditId=null,handlerDeleteId=null;

document.addEventListener('DOMContentLoaded',async()=>{await renderHandlers();bindHandlerEvents()});

async function renderHandlers(){
  const grid=document.getElementById('handlerGrid');
  grid.innerHTML='<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> 로딩 중...</div>';
  const list=await HandlerAPI.getAll();
  document.getElementById('handlerCount').textContent=list.length;
  if(!list.length){grid.innerHTML='<div class="empty-state"><i class="fas fa-users"></i><p>등록된 담당자가 없습니다</p></div>';return}
  grid.innerHTML=list.map(h=>`<div class="handler-card"><div class="handler-avatar">${esc(h.name.slice(0,1))}</div><div class="handler-info"><h4>${esc(h.name)}</h4><p>${esc(h.department||'-')}${h.contact?' · '+esc(h.contact):''}</p></div><div class="handler-actions"><button class="btn btn-sm btn-outline" onclick="openEditHandler('${h.id}')"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-danger" onclick="confirmDeleteHandler('${h.id}','${esc(h.name)}')"><i class="fas fa-trash"></i></button></div></div>`).join('');
}

function bindHandlerEvents(){
  document.getElementById('addHandlerBtn').addEventListener('click',openAddHandler);
  document.getElementById('closeHandlerModal').addEventListener('click',()=>closeOverlay('handlerModal'));
  document.getElementById('cancelHandlerModal').addEventListener('click',()=>closeOverlay('handlerModal'));
  document.getElementById('saveHandlerBtn').addEventListener('click',saveHandler);
  document.getElementById('handlerName').addEventListener('keydown',e=>{if(e.key==='Enter')saveHandler()});
  document.getElementById('closeHandlerDeleteModal').addEventListener('click',()=>closeOverlay('handlerDeleteModal'));
  document.getElementById('cancelHandlerDelete').addEventListener('click',()=>closeOverlay('handlerDeleteModal'));
  document.getElementById('confirmHandlerDelete').addEventListener('click',doDeleteHandler);
  bindModalOverlayClose(['handlerModal','handlerDeleteModal']);
}

function openAddHandler(){
  handlerEditId=null;
  document.getElementById('handlerModalTitle').innerHTML='<i class="fas fa-user-plus"></i> 담당자 추가';
  ['handlerName','handlerDept','handlerContact'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('handlerOrder').value='0';
  openOverlay('handlerModal');setTimeout(()=>document.getElementById('handlerName').focus(),100);
}

async function openEditHandler(id){
  const list=await HandlerAPI.getAll();
  const h=list.find(x=>x.id===id);if(!h)return;
  handlerEditId=id;
  document.getElementById('handlerModalTitle').innerHTML='<i class="fas fa-user-edit"></i> 담당자 수정';
  document.getElementById('handlerName').value=h.name||'';
  document.getElementById('handlerDept').value=h.department||'';
  document.getElementById('handlerContact').value=h.contact||'';
  document.getElementById('handlerOrder').value=h.sort_order??0;
  openOverlay('handlerModal');setTimeout(()=>document.getElementById('handlerName').focus(),100);
}

async function saveHandler(){
  const name=document.getElementById('handlerName').value.trim();
  if(!name){showToast('담당자명을 입력하세요','warning');return}
  const btn=document.getElementById('saveHandlerBtn');btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> 저장 중...';
  try{
    await HandlerAPI.save({id:handlerEditId||uuid(),name,department:document.getElementById('handlerDept').value.trim(),contact:document.getElementById('handlerContact').value.trim(),sort_order:parseInt(document.getElementById('handlerOrder').value)||0,active:true});
    showToast(handlerEditId?'담당자가 수정되었습니다':'담당자가 추가되었습니다','success');
    closeOverlay('handlerModal');await renderHandlers();
  }catch(e){showToast('저장 오류: '+e.message,'error')}
  finally{btn.disabled=false;btn.innerHTML='<i class="fas fa-save"></i> 저장'}
}

function confirmDeleteHandler(id,name){handlerDeleteId=id;document.getElementById('handlerDeleteText').textContent=`"${name}" 담당자를 삭제하시겠습니까?`;openOverlay('handlerDeleteModal')}

async function doDeleteHandler(){
  if(!handlerDeleteId)return;
  const btn=document.getElementById('confirmHandlerDelete');btn.disabled=true;
  try{await HandlerAPI.delete(handlerDeleteId);showToast('담당자가 삭제되었습니다','success');closeOverlay('handlerDeleteModal');handlerDeleteId=null;await renderHandlers()}
  catch(e){showToast('삭제 오류: '+e.message,'error')}
  finally{btn.disabled=false}
}
