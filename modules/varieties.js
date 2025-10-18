export function initVarietiesUI(store){
  const tableBody = document.querySelector('#varietiesTable tbody');
  const nameEl = document.getElementById('v_name');
  const catEl = document.getElementById('v_category');
  const priceEl = document.getElementById('v_price');
  const statusEl = document.getElementById('v_status');
  const tagsEl = document.getElementById('v_tags');
  const descEl = document.getElementById('v_desc');
  const saveBtn = document.getElementById('saveVarietyBtn');
  const resetBtn = document.getElementById('resetFormBtn');
  const editHint = document.getElementById('editHint');
  const editingId = document.getElementById('editingId');

  let currentId = null;

  function render(){
    tableBody.innerHTML = store.state.varieties.map(v => {
      const price = (v.default_price ?? 0).toFixed(2);
      const tags = (v.tags||[]).join(', ');
      return `<tr>
        <td>${v.id}</td>
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
  }

  function resetForm(){
    currentId = null;
    nameEl.value = '';
    catEl.value = 'workhorse';
    priceEl.value = '';
    statusEl.value = 'active';
    tagsEl.value = '';
    descEl.value = '';
    editHint.hidden = true;
    editingId.textContent = '';
  }

  function loadToForm(v){
    currentId = v.id;
    nameEl.value = v.name||'';
    catEl.value = v.category||'workhorse';
    priceEl.value = v.default_price ?? '';
    statusEl.value = v.status||'active';
    tagsEl.value = (v.tags||[]).join(', ');
    descEl.value = v.description||'';
    editHint.hidden = false;
    editingId.textContent = v.id;
  }

  saveBtn.onclick = async () => {
    const v = {
      id: currentId,
      name: nameEl.value.trim(),
      category: catEl.value,
      default_price: Number(priceEl.value||0),
      status: statusEl.value,
      tags: tagsEl.value.split(',').map(t=>t.trim()).filter(Boolean),
      description: descEl.value.trim()
    };
    if(!v.name){ alert('Name is required.'); return; }
    await store.upsertVariety(v);
    resetForm(); render();
  };

  resetBtn.onclick = resetForm;

  tableBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button'); if(!btn) return;
    const id = btn.dataset.id; const act = btn.dataset.act;
    const found = store.state.varieties.find(x=>x.id===id);
    if(act==='edit' && found){ loadToForm(found); }
    if(act==='del'){
      if(confirm('Delete this variety?')){ await store.deleteVariety(id); render(); }
    }
  });

  render();
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
