// modules/varieties.js
export function initVarietiesUI(store){
  const tableBody = document.querySelector('#varietiesTable tbody');
  const nameEl   = document.getElementById('v_name');
  const catEl    = document.getElementById('v_category');
  const priceEl  = document.getElementById('v_price');
  const statusEl = document.getElementById('v_status');
  const tagsEl   = document.getElementById('v_tags');
  const descEl   = document.getElementById('v_desc');
  const saveBtn  = document.getElementById('saveVarietyBtn');
  const resetBtn = document.getElementById('resetFormBtn');
  const editHint = document.getElementById('editHint');
  const editingId= document.getElementById('editingId');

  let currentId = null;

  function render(){
    const rows = (store.state.varieties || []).map(v => {
      const price = Number(v.default_price ?? 0).toFixed(2);
      const tags = (v.tags||[]).join(', ');
      return `<tr>
        <td>${v.id||''}</td>
        <td>${escapeHtml(v.name||'')}</td>
        <td>${escapeHtml(v.category||'')}</td>
        <td>${price}</td>
        <td>${escapeHtml(v.status||'')}</td>
        <td>${escapeHtml(tags)}</td>
        <td>
          <button data-act="edit" data-id="${v.id}">Edit</button>
          <button data-act="del" data-id="${v.id}" class="ghost">Delete</button>
        </td>
      </tr>`;
    }).join('');
    if (tableBody) tableBody.innerHTML = rows;
  }

  function resetForm(){
    currentId = null;
    if (nameEl)   nameEl.value = '';
    if (catEl)    catEl.value = 'workhorse';
    if (priceEl)  priceEl.value = '';
    if (statusEl) statusEl.value = 'active';
    if (tagsEl)   tagsEl.value = '';
    if (descEl)   descEl.value = '';
    if (editHint) editHint.hidden = true;
    if (editingId) editingId.textContent = '';
  }

  function loadToForm(v){
    currentId = v.id;
    if (nameEl)   nameEl.value = v.name||'';
    if (catEl)    catEl.value = v.category||'workhorse';
    if (priceEl)  priceEl.value = v.default_price ?? '';
    if (statusEl) statusEl.value = v.status||'active';
    if (tagsEl)   tagsEl.value = (v.tags||[]).join(', ');
    if (descEl)   descEl.value = v.description||'';
    if (editHint) editHint.hidden = false;
    if (editingId) editingId.textContent = v.id;
  }

  async function saveVariety(){
    try{
      const now = new Date().toISOString();
      const v = {
        id: currentId,
        name: (nameEl?.value || '').trim(),
        category: catEl?.value || 'workhorse',
        default_price: Number(priceEl?.value || 0),
        status: statusEl?.value || 'active',
        tags: (tagsEl?.value || '').split(',').map(t=>t.trim()).filter(Boolean),
        description: (descEl?.value || '').trim(),
        updated_at: now
      };
      if (!v.id) v.created_at = now;

      if (!v.name) { alert('Name is required.'); nameEl?.focus(); return; }
      await store.upsertVariety(v);
      resetForm(); render();
      const dbg = document.getElementById('debug'); if (dbg) dbg.textContent = 'Saved: ' + (v.id || '(new)');
    }catch(err){
      console.error('Save variety failed:', err);
      alert('Save failed: ' + (err?.message || err));
    }
  }

  if (saveBtn) saveBtn.addEventListener('click', (e)=>{ e.preventDefault(); saveVariety(); });
  if (resetBtn) resetBtn.addEventListener('click', (e)=>{ e.preventDefault(); resetForm(); });

  document.addEventListener('click', (e)=>{
    const target = e.target.closest('[data-action="save-variety"]');
    if (target) { e.preventDefault(); saveVariety(); }
  });

  if (tableBody) tableBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button'); if(!btn) return;
    const id = btn.dataset.id; const act = btn.dataset.act;
    const found = (store.state.varieties||[]).find(x=>x.id===id);
    if (act==='edit' && found){ loadToForm(found); }
    if (act==='del'){
      if (confirm('Delete this variety?')){
        try{ await store.deleteVariety(id); render(); }
        catch(err){ console.error('Delete failed:', err); alert('Delete failed: ' + (err?.message||err)); }
      }
    }
  });

  render();
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#039;'}[m]));
}
