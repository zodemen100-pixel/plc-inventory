/* categories.js */
let catModalMode='add',catEditTarget=null,catParentId=null,catLevel=1,catDeleteId=null,fullTree=[];

document.addEventListener('DOMContentLoaded',async()=>{await loadCatPage();bindCatEvents()});

async function loadCatPage(){
  fullTree=await CategoryAPI.getTree();
  const all=await CategoryAPI.getAll(true);
  const mats=await MaterialAPI.getAll();
  document.getElementById('statL1').textContent=all.filter(c=>c.level===1).length;
  document.getElementById('statL2').textContent=all.filter(c=>c.level===2).length;
  document.getElementById('statL3').textContent=all.filter(c=>c.level===3).length;
  document.getElementById('statMats').textContent=mats.length;
  renderCatTree(fullTree);
}

function renderCatTree(tree,q=''){
  const el=document.getElementById('catTree');
  if(!tree.length){el.innerHTML='<div class="empty-state"><i class="fas fa-sitemap"></i><p>카테고리가 없습니다. 제조사를 추가하세요.</p></div>';return}
  let filtered=tree;
  if(q){const ql=q.toLowerCase();filtered=tree.map(l1=>{const m1=l1.name.toLowerCase().includes(ql);const ch=l1.children.map(l2=>{const m2=l2.name.toLowerCase().includes(ql);const l3k=l2.children.filter(l3=>l3.name.toLowerCase().includes(ql));if(m2||l3k.length)return{...l2,children:l3k,_open:true};return null}).filter(Boolean);if(m1||ch.length)return{...l1,children:ch,_open:true};return null}).filter(Boolean)}
  el.innerHTML=filtered.map(l1=>buildL1(l1,!!q)).join('');
}

function buildL1(l1,fo=false){
  const l2c=l1.children.length,l3c=l1.children.reduce((s,l2)=>s+l2.children.length,0);
  return`<div class="cat-l1-block ${fo||l1._open?'open':''}" id="l1-${l1.id}">
    <div class="cat-l1-header" onclick="document.getElementById('l1-${l1.id}').classList.toggle('open')">
      <i class="fas fa-industry"></i><span class="cat-name">${esc(l1.name)}</span>
      <span class="cat-count">${l2c}타입 · ${l3c}모델</span>
      <div class="cat-actions" onclick="event.stopPropagation()">
        <button class="cat-btn add" onclick="openCatAdd(2,'${l1.id}','${esc(l1.name)}')" title="타입추가"><i class="fas fa-plus"></i></button>
        <button class="cat-btn edit" onclick="openCatEdit('${l1.id}')" title="편집"><i class="fas fa-pen"></i></button>
        <button class="cat-btn delete" onclick="openCatDelete('${l1.id}','${esc(l1.name)}')" title="삭제"><i class="fas fa-trash"></i></button>
      </div>
      <i class="fas fa-chevron-right chevron" style="margin-left:8px"></i>
    </div>
    <div class="cat-l2-area">
      ${l1.children.length?l1.children.map(l2=>buildL2(l2,l1,fo)).join(''):'<div style="color:#aaa;font-size:.82rem;padding:8px">하위 타입이 없습니다</div>'}
      <button class="add-l2-btn" onclick="openCatAdd(2,'${l1.id}','${esc(l1.name)}')"><i class="fas fa-plus-circle"></i> 타입 추가</button>
    </div>
  </div>`;
}

function buildL2(l2,l1,fo=false){
  return`<div class="cat-l2-block ${fo||l2._open?'open':''}" id="l2-${l2.id}">
    <div class="cat-l2-header" onclick="document.getElementById('l2-${l2.id}').classList.toggle('open')">
      <i class="fas fa-layer-group" style="color:#1565c0;font-size:.85rem"></i>
      <span class="cat-name">${esc(l2.name)}</span>
      <span style="font-size:.73rem;color:#aaa;margin-left:4px">${l2.children.length}개 모델</span>
      <div class="cat-actions" onclick="event.stopPropagation()">
        <button class="cat-btn add" onclick="openCatAdd(3,'${l2.id}','${esc(l1.name)} > ${esc(l2.name)}')" title="모델추가"><i class="fas fa-plus"></i></button>
        <button class="cat-btn edit" onclick="openCatEdit('${l2.id}')" title="편집"><i class="fas fa-pen"></i></button>
        <button class="cat-btn delete" onclick="openCatDelete('${l2.id}','${esc(l2.name)}')" title="삭제"><i class="fas fa-trash"></i></button>
      </div>
      <i class="fas fa-chevron-right chevron"></i>
    </div>
    <div class="cat-l3-area">
      ${l2.children.map(l3=>`<div class="cat-l3-chip"><i class="fas fa-tag" style="color:#2e7d32;font-size:.75rem"></i>${esc(l3.name)}<span style="display:inline-flex;gap:3px;margin-left:4px"><button class="cat-btn edit" style="padding:2px 5px" onclick="openCatEdit('${l3.id}')"><i class="fas fa-pen" style="font-size:.7rem"></i></button><button class="cat-btn delete" style="padding:2px 5px" onclick="openCatDelete('${l3.id}','${esc(l3.name)}')"><i class="fas fa-trash" style="font-size:.7rem"></i></button></span></div>`).join('')}
      <div class="add-chip" onclick="openCatAdd(3,'${l2.id}','${esc(l1.name)} > ${esc(l2.name)}')"><i class="fas fa-plus"></i> 모델 추가</div>
    </div>
  </div>`;
}

function bindCatEvents(){
  document.getElementById('addL1Btn').addEventListener('click',()=>openCatAdd(1,null,null));
  document.getElementById('closeCatModal').addEventListener('click',()=>closeOverlay('catModal'));
  document.getElementById('cancelCatModal').addEventListener('click',()=>closeOverlay('catModal'));
  document.getElementById('saveCatBtn').addEventListener('click',saveCat);
  document.getElementById('catName').addEventListener('keydown',e=>{if(e.key==='Enter')saveCat()});
  document.getElementById('closeCatDeleteModal').addEventListener('click',()=>closeOverlay('catDeleteModal'));
  document.getElementById('cancelCatDelete').addEventListener('click',()=>closeOverlay('catDeleteModal'));
  document.getElementById('confirmCatDelete').addEventListener('click',doDeleteCat);
  document.getElementById('catSearch').addEventListener('input',function(){renderCatTree(fullTree,this.value.trim())});
  bindModalOverlayClose(['catModal','catDeleteModal']);
}

function openCatAdd(level,parentId,parentPath){
  catModalMode='add';catEditTarget=null;catLevel=level;catParentId=parentId;
  const li={1:{l:'레벨 1 — 제조사',i:'fa-industry',c:'level-1',p:'AB, SIEMENS, LS ...'},2:{l:'레벨 2 — 타입',i:'fa-layer-group',c:'level-2',p:'DIGITAL INPUT ...'},3:{l:'레벨 3 — 모델',i:'fa-tag',c:'level-3',p:'1756-IB32 ...'}}[level];
  document.getElementById('catModalTitle').innerHTML='<i class="fas fa-folder-plus"></i> 카테고리 추가';
  document.getElementById('levelIndicator').className=`level-indicator ${li.c}`;
  document.getElementById('levelIndicator').innerHTML=`<i class="fas ${li.i}"></i> ${li.l}`;
  document.getElementById('catName').placeholder=li.p;
  document.getElementById('catName').value='';document.getElementById('catDesc').value='';document.getElementById('catOrder').value='0';
  const pa=document.getElementById('parentPathArea');
  if(parentPath){pa.style.display='block';document.getElementById('parentPathText').textContent=parentPath}else pa.style.display='none';
  openOverlay('catModal');setTimeout(()=>document.getElementById('catName').focus(),100);
}

async function openCatEdit(id){
  const cat=await CategoryAPI.getById(id);if(!cat)return;
  catModalMode='edit';catEditTarget=cat;catLevel=cat.level;catParentId=cat.parent_id;
  const li={1:{l:'레벨 1 — 제조사',i:'fa-industry',c:'level-1'},2:{l:'레벨 2 — 타입',i:'fa-layer-group',c:'level-2'},3:{l:'레벨 3 — 모델',i:'fa-tag',c:'level-3'}}[cat.level];
  document.getElementById('catModalTitle').innerHTML='<i class="fas fa-pen"></i> 카테고리 편집';
  document.getElementById('levelIndicator').className=`level-indicator ${li.c}`;
  document.getElementById('levelIndicator').innerHTML=`<i class="fas ${li.i}"></i> ${li.l}`;
  document.getElementById('catName').value=cat.name||'';document.getElementById('catDesc').value=cat.description||'';document.getElementById('catOrder').value=cat.sort_order??0;
  const pa=document.getElementById('parentPathArea');
  if(cat.parent_id){pa.style.display='block';const p=await CategoryAPI.getById(cat.parent_id);document.getElementById('parentPathText').textContent=p?.name||''}
  else pa.style.display='none';
  openOverlay('catModal');setTimeout(()=>document.getElementById('catName').focus(),100);
}

async function saveCat(){
  const name=document.getElementById('catName').value.trim();
  if(!name){showToast('카테고리명을 입력하세요','warning');return}
  const btn=document.getElementById('saveCatBtn');btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> 저장 중...';
  try{
    await CategoryAPI.save({id:catEditTarget?.id||`cat-${Date.now().toString(36)}`,level:catLevel,parent_id:catParentId||null,name,description:document.getElementById('catDesc').value.trim(),sort_order:parseInt(document.getElementById('catOrder').value)||0});
    showToast(catModalMode==='add'?'카테고리가 추가되었습니다':'카테고리가 수정되었습니다','success');
    closeOverlay('catModal');fullTree=await CategoryAPI.getTree();renderCatTree(fullTree,document.getElementById('catSearch').value);
    await loadCatPage();
  }catch(e){showToast('저장 오류: '+e.message,'error')}
  finally{btn.disabled=false;btn.innerHTML='<i class="fas fa-save"></i> 저장'}
}

function openCatDelete(id,name){catDeleteId=id;document.getElementById('catDeleteText').textContent=`"${name}" 카테고리를 삭제하시겠습니까?`;openOverlay('catDeleteModal')}

async function doDeleteCat(){
  if(!catDeleteId)return;
  const btn=document.getElementById('confirmCatDelete');btn.disabled=true;
  try{await CategoryAPI.delete(catDeleteId);showToast('카테고리가 삭제되었습니다','success');closeOverlay('catDeleteModal');catDeleteId=null;await loadCatPage()}
  catch(e){showToast('삭제 오류: '+e.message,'error')}
  finally{btn.disabled=false}
}
