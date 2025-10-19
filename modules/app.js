// modules/app.js
import { Storage } from './storage.js';
import { initVarietiesUI } from './varieties.js';
import { initLotsUI } from './lots.js';

function wireTabs(){
  const tabs = document.querySelectorAll('nav.tabs button');
  const sections = document.querySelectorAll('main .tab');
  tabs.forEach(btn=>btn.addEventListener('click',()=>{
    tabs.forEach(b=>b.classList.remove('active')); btn.classList.add('active');
    sections.forEach(s=>s.hidden = s.id !== btn.dataset.tab);
  }));
}

function debug(msg){
  const el = document.getElementById('debug');
  if (el) el.textContent = msg;
  console.log('[FigOps]', msg);
}

async function boot(){
  try{
    wireTabs();
    debug('Booting…');

    const store = new Storage();
    await store.loadAll();
    debug('Store loaded.');

    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.textContent = store.isConfigured() ? 'ready' : 'offline';

    initVarietiesUI(store);
    initLotsUI(store);
    debug('UIs ready.');

    const ow = document.getElementById('gh_owner');
    const rp = document.getElementById('gh_repo');
    const br = document.getElementById('gh_branch');
    const tk = document.getElementById('gh_token');

    if (ow && store.repo.owner) ow.value = store.repo.owner;
    if (rp && store.repo.name) rp.value = store.repo.name;
    if (br && store.repo.branch) br.value = store.repo.branch;
    if (tk && store.repo.token) tk.value = store.repo.token;

    const saveRepoBtn = document.getElementById('saveRepoBtn');
    if (saveRepoBtn) saveRepoBtn.onclick = () => {
      store.setRepo({ owner: ow.value.trim(), name: rp.value.trim(), branch: br.value.trim(), token: tk.value.trim() });
      if (statusEl) statusEl.textContent = store.isConfigured() ? 'ready' : 'offline';
      alert('Saved.');
    };

    const syncBtn = document.getElementById('syncBtn');
    if (syncBtn) syncBtn.onclick = async () => {
      debug('Syncing…');
      await store.syncKey('varieties');
      await store.syncKey('lots');
      if (statusEl) statusEl.textContent = 'synced';
      alert('Synced (merged local+remote).');
      debug('Synced.');
    };

    const reloadBtn = document.getElementById('reloadBtn');
    if (reloadBtn) reloadBtn.onclick = async () => {
      await store.loadKey('varieties');
      await store.loadKey('lots');
      alert('Reloaded (if configured).');
      window.location.reload();
    };

    if ('serviceWorker' in navigator) { try { await navigator.serviceWorker.register('sw.js'); } catch(_) {} }
    debug('Ready.');
  } catch(err){
    debug('Boot error: ' + (err?.message || err));
    console.error(err);
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
