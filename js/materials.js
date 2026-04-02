/* materials.js */
let currentEditId=null,currentDeleteId=null,currentBarcodeId=null;

document.addEventListener('DOMContentLoaded',async()=>{
  await renderTable();
  await populateCategoryFilter();
  bindEvents();
  checkURL();
});

function bindEvents(){
  document.getElementById('searchInput').addEventListener('input',renderTable);
  document.getElementById('categoryFilter').addEventListener('change',renderTable);
  document.getElementById('statusFilter').addEventListener('change',renderTable);
  document.getElementById('openAddModal').addEventListener('click',openAddModal);
  document.getElementById('closeModal').addEventListener('click',closeMatModal);
  document.getElementById('cancelModal').addEventListener('click',closeMatModal);
  document.getElementById('saveModal').addEventListener('click',saveMaterial);
  document.getElementById('genBarcodeBtn').addEventListener('click',()=>{document.getElementById('matBarcode').value=generateBarcode()});
  document.getElementById('closeBarcodeModal').addEventListener('click',()=>closeOverlay('barcodeModal'));
  document.getElementById('downloadBarcode').addEventListener('click',downloadBarcode);
  document.getElementById('printAllBarcodes').addEventListener('click',openPrintAll);
  document.getElementById('closePrintAllModal').addEventListener('click',()=>closeOverlay('printAllModal'));
  document.getElementById('closeDeleteModal').addEventListener('click',()=>closeOverlay('deleteModal'));
  document.getElementById('cancelDelete').addEventListener('click',()=>closeOverlay('deleteModal'));
  document.getElementById('confirmDelete').addEventListener('click',doDelete);
  document.getElementById('catL1').addEventListener('change',onL1Change);
  document.getElementById('catL2').addEventListener('change',onL2Change);
  document.getElementById('catL3').addEventListener('change',onL3Change);
  bindModalOverlayClose(['materialModal','barcodeModal','printAllModal','deleteModal']);
}

function checkURL(){
  const p=new URLSearchParams(location.search);
  if(p.get('edit'))openEditModal(p.get('edit'));
}

async function populateCategoryFilter(){
  const mats=await MaterialAPI.getAll();
  const cats=[...new Set(mats.map(m=>m.category).filter(Boolean))].sort();
  const sel=document.getElementById('categoryFilter');
  while(sel.options.length>1)sel.remove(1);
  cats.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;sel.appendChild(o)});
}

async function renderTable(){
  const tbody=document.getElementById('materialsTableBody');
  tbody.innerHTML='<tr><td colspan="9" class="text-center" style="padding:20px"><i class="fas fa-spinner fa-spin"></i> 로딩 중...</td></tr>';
  const q=document.getElementById('searchInput').value.toLowerCase();
  const cat=document.getElementById('categoryFilter').value;
  const stat=document.getElementById('statusFilter').value;
  const all=await MaterialAPI.getAll();
  const list=all.filter(m=>{
    const mq=!q||m.name.toLowerCase().includes(q)||m.code.toLowerCase().includes(q)||(m.barcode||'').toLowerCase().includes(q);
    const mc=!cat||m.category===cat;
    const sk=m.current_stock<=0?'critical':m.current_stock<m.min_stock?'low':'normal';
    const ms=!stat||sk===stat;
    return mq&&mc&&ms;
  });
  document.getElementById('materialCount').textContent=list.length;
  if(!list.length){tbody.innerHTML='<tr><td colspan="9" class="text-center" style="padding:30px;color:#aaa">검색 결과 없음</td></tr>';return}
  tbody.innerHTML=list.map(m=>{
    const st=getStockStatus(m);
    return`<tr>
      <td><code style="font-size:.78rem;background:#f0f2f5;padding:2px 7px;border-radius:5px">${esc(m.code)}</code></td>
      <td><strong>${esc(m.name)}</strong>${m.version?`<br><span style="font-size:.73rem;color:#9c27b0"><i class="fas fa-code-branch"></i> ${esc(m.version)}</span>`:''}</td>
      <td><span class="badge badge-secondary" style="font-size:.72rem">${esc(m.category||'-')}</span></td>
      <td><small style="font-family:monospace;font-size:.75rem;color:#666">${esc(m.barcode||'-')}</small></td>
      <td>${esc(m.location||'-')}</td>
      <td><strong>${m.current_stock}</strong> <small>${esc(m.unit||'EA')}</small></td>
      <td>${m.min_stock} <small>${esc(m.unit||'EA')}</small></td>
      <td>${statusBadgeHTML(st)}</td>
      <td><div style="display:flex;gap:4px;flex-wrap:wrap">
        <button class="btn btn-sm" style="background:#e3f2fd;color:#1565c0" onclick="openBarcodeModal('${m.id}')"><i class="fas fa-barcode"></i></button>
        <button class="btn btn-sm btn-outline" onclick="openEditModal('${m.id}')"><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-danger" onclick="confirmDelete('${m.id}')"><i class="fas fa-trash"></i></button>
      </div></td>
    </tr>`;
  }).join('');
}

/* ── 카테고리 드롭다운 ── */
async function initCatSelects(){
  const l1s=await CategoryAPI.getLevel1();
  const sel=document.getElementById('catL1');
  while(sel.options.length>1)sel.remove(1);
  l1s.forEach(c=>{const o=document.createElement('option');o.value=c.name;o.dataset.id=c.id;o.textContent=c.name;sel.appendChild(o)});
  const l2=document.getElementById('catL2'),l3=document.getElementById('catL3');
  l2.innerHTML='<option value="">-- 타입 선택 --</option>';l2.disabled=true;
  l3.innerHTML='<option value="">-- 모델 선택 (선택사항) --</option>';l3.disabled=true;
  document.getElementById('catPreview').style.display='none';
}

async function onL1Change(){
  const sel=document.getElementById('catL1'),chosen=sel.options[sel.selectedIndex];
  const l2=document.getElementById('catL2'),l3=document.getElementById('catL3');
  l2.innerHTML='<option value="">-- 타입 선택 --</option>';l2.disabled=true;
  l3.innerHTML='<option value="">-- 모델 선택 (선택사항) --</option>';l3.disabled=true;
  document.getElementById('matCatL1').value=sel.value;
  document.getElementById('matCatL2').value='';
  document.getElementById('matCatL3').value='';
  updateCatPreview();
  if(!sel.value||!chosen?.dataset.id)return;
  const children=await CategoryAPI.getChildren(chosen.dataset.id);
  children.forEach(c=>{const o=document.createElement('option');o.value=c.name;o.dataset.id=c.id;o.textContent=c.name;l2.appendChild(o)});
  l2.disabled=children.length===0;
}

async function onL2Change(){
  const sel=document.getElementById('catL2'),chosen=sel.options[sel.selectedIndex];
  const l3=document.getElementById('catL3');
  l3.innerHTML='<option value="">-- 모델 선택 (선택사항) --</option>';l3.disabled=true;
  document.getElementById('matCatL2').value=sel.value;
  document.getElementById('matCatL3').value='';
  updateCatPreview();
  if(!sel.value||!chosen?.dataset.id)return;
  const children=await CategoryAPI.getChildren(chosen.dataset.id);
  children.forEach(c=>{const o=document.createElement('option');o.value=c.name;o.dataset.id=c.id;o.textContent=c.name;l3.appendChild(o)});
  l3.disabled=children.length===0;
}

function onL3Change(){
  document.getElementById('matCatL3').value=document.getElementById('catL3').value;
  updateCatPreview();
}

function updateCatPreview(){
  const l1=document.getElementById('matCatL1').value;
  const l2=document.getElementById('matCatL2').value;
  const l3=document.getElementById('matCatL3').value;
  const parts=[l1,l2,l3].filter(Boolean);
  const pv=document.getElementById('catPreview');
  if(parts.length){pv.style.display='block';document.getElementById('catPreviewText').textContent=parts.join(' > ')}
  else pv.style.display='none';
}

/* ── 모달 ── */
async function openAddModal(){
  currentEditId=null;
  document.getElementById('modalTitle').innerHTML='<i class="fas fa-plus-circle"></i> 자재 등록';
  clearForm();
  document.getElementById('matBarcode').value=generateBarcode();
  await initCatSelects();
  openOverlay('materialModal');
}

async function openEditModal(id){
  const mat=await MaterialAPI.getById(id);if(!mat)return;
  currentEditId=id;
  document.getElementById('modalTitle').innerHTML='<i class="fas fa-edit"></i> 자재 수정';
  document.getElementById('editId').value=mat.id;
  document.getElementById('matName').value=mat.name||'';
  document.getElementById('matCode').value=mat.code||'';
  document.getElementById('matUnit').value=mat.unit||'';
  document.getElementById('matLocation').value=mat.location||'';
  document.getElementById('matMinStock').value=mat.min_stock??0;
  document.getElementById('matCurrentStock').value=mat.current_stock??0;
  document.getElementById('matBarcode').value=mat.barcode||'';
  document.getElementById('matVersion').value=mat.version||'';
  document.getElementById('matManufactureDate').value=mat.manufacture_date?.slice(0,10)||'';
  document.getElementById('matManager').value=mat.manager||'';
  document.getElementById('matDesc').value=mat.description||'';
  await initCatSelects();
  if(mat.cat_level1){
    const l1=document.getElementById('catL1');
    for(const o of l1.options){if(o.value===mat.cat_level1){l1.value=mat.cat_level1;break}}
    await onL1Change();
    if(mat.cat_level2){
      const l2=document.getElementById('catL2');
      for(const o of l2.options){if(o.value===mat.cat_level2){l2.value=mat.cat_level2;break}}
      await onL2Change();
      if(mat.cat_level3){
        const l3=document.getElementById('catL3');
        for(const o of l3.options){if(o.value===mat.cat_level3){l3.value=mat.cat_level3;break}}
        onL3Change();
      }
    }
  }
  openOverlay('materialModal');
}

function closeMatModal(){closeOverlay('materialModal');clearForm();currentEditId=null}

function clearForm(){
  ['editId','matName','matCode','matUnit','matLocation','matBarcode','matVersion','matManufactureDate','matManager','matDesc','matCatL1','matCatL2','matCatL3'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});
  document.getElementById('matMinStock').value=0;
  document.getElementById('matCurrentStock').value=0;
  document.getElementById('catPreview').style.display='none';
}

async function saveMaterial(){
  const name=document.getElementById('matName').value.trim();
  const code=document.getElementById('matCode').value.trim();
  if(!name){showToast('자재명을 입력하세요','warning');return}
  if(!code){showToast('자재코드를 입력하세요','warning');return}
  const all=await MaterialAPI.getAll();
  if(all.find(m=>m.code===code&&m.id!==(currentEditId||''))){showToast('중복된 자재코드입니다','error');return}
  const btn=document.getElementById('saveModal');
  btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> 저장 중...';
  try{
    const existing=currentEditId?await MaterialAPI.getById(currentEditId):null;
    const raw=document.getElementById('matBarcode').value.trim()||generateBarcode();
    const safeBC=raw.toUpperCase().replace(/[^A-Z0-9\-\.\_]/g,'').slice(0,30)||generateBarcode();
    const l1=document.getElementById('matCatL1').value;
    const l2=document.getElementById('matCatL2').value;
    const l3=document.getElementById('matCatL3').value;
    await MaterialAPI.save({
      id:currentEditId||uuid(),name,code,
      category:[l1,l2,l3].filter(Boolean).join(' > ')||'미분류',
      cat_level1:l1,cat_level2:l2,cat_level3:l3,
      unit:document.getElementById('matUnit').value.trim()||'EA',
      location:document.getElementById('matLocation').value.trim(),
      min_stock:Number(document.getElementById('matMinStock').value)||0,
      current_stock:Number(document.getElementById('matCurrentStock').value)||0,
      barcode:safeBC,
      version:document.getElementById('matVersion').value.trim(),
      manufacture_date:document.getElementById('matManufactureDate').value||null,
      manager:document.getElementById('matManager').value.trim(),
      description:document.getElementById('matDesc').value.trim(),
      status:'active',
      created_at:existing?.created_at||new Date().toISOString()
    });
    showToast(currentEditId?'자재가 수정되었습니다':'자재가 등록되었습니다','success');
    closeMatModal();await renderTable();await populateCategoryFilter();
  }catch(e){showToast('저장 오류: '+e.message,'error')}
  finally{btn.disabled=false;btn.innerHTML='<i class="fas fa-save"></i> 저장'}
}

function generateBarcode(){
  const code=(document.getElementById('matCode')?.value||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)||'MAT';
  const ver=(document.getElementById('matVersion')?.value||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);
  const date=(document.getElementById('matManufactureDate')?.value||'').replace(/-/g,'').slice(2);
  const sec=String(new Date().getSeconds()).padStart(2,'0');
  return[code,ver,date].filter(Boolean).join('')+'-'+sec;
}

function renderBarcode(selector,val,opts={}){
  const safe=String(val).toUpperCase().replace(/[^A-Z0-9\-\.\_\/\+\% ]/g,'').trim();
  if(!safe)return false;
  try{JsBarcode(selector,safe,{format:'CODE128',width:3,height:100,displayValue:true,fontSize:16,margin:20,background:'#ffffff',lineColor:'#000000',...opts});return true}
  catch(e){console.error('바코드 오류:',e.message);return false}
}

async function openBarcodeModal(id){
  const mat=await MaterialAPI.getById(id);if(!mat)return;
  currentBarcodeId=id;
  document.getElementById('barcodeMaterialName').textContent=mat.name;
  document.getElementById('barcodeMaterialCode').textContent=mat.code;
  document.getElementById('barcodeMaterialLocation').textContent=mat.location||'';
  openOverlay('barcodeModal');
  setTimeout(()=>{if(!renderBarcode('#barcodeCanvas',mat.barcode))showToast('바코드 생성 오류. 바코드 값을 확인하세요','error')},120);
}

function downloadBarcode(){
  const canvas=document.getElementById('barcodeCanvas');if(!canvas)return;
  const mat_=currentBarcodeId;
  const link=document.createElement('a');link.download=`${mat_||'barcode'}.png`;link.href=canvas.toDataURL('image/png');link.click();
}

async function openPrintAll(){
  const mats=await MaterialAPI.getAll();
  const area=document.getElementById('allBarcodeArea');
  area.innerHTML=mats.map(m=>`<div class="barcode-label-item"><canvas id="bc_${m.id}"></canvas><p style="font-weight:700;font-size:.82rem;margin-top:6px">${esc(m.name)}</p><p style="font-size:.72rem;color:#555">${esc(m.code)}</p>${m.location?`<p style="font-size:.68rem;color:#aaa">${esc(m.location)}</p>`:''}</div>`).join('');
  openOverlay('printAllModal');
  setTimeout(()=>mats.forEach(m=>renderBarcode(`#bc_${m.id}`,m.barcode,{width:2,height:60,margin:10,fontSize:11})),150);
}

function confirmDelete(id){
  MaterialAPI.getById(id).then(mat=>{if(!mat)return;currentDeleteId=id;document.getElementById('deleteConfirmText').textContent=`"${mat.name}" 을(를) 삭제하시겠습니까?`;openOverlay('deleteModal')});
}

async function doDelete(){
  if(!currentDeleteId)return;
  const btn=document.getElementById('confirmDelete');btn.disabled=true;
  try{await MaterialAPI.delete(currentDeleteId);showToast('자재가 삭제되었습니다','success');closeOverlay('deleteModal');currentDeleteId=null;await renderTable()}
  catch(e){showToast('삭제 오류: '+e.message,'error')}
  finally{btn.disabled=false}
}
