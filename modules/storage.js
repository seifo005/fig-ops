// modules/storage.js — local-first + safe GitHub sync (merge + guard)
export class Storage{
  constructor(){
    this.repo  = JSON.parse(localStorage.getItem('repo')||'{}');
this.paths = { varieties: 'data/varieties.jsonl', lots: 'data/lots.jsonl',
               customers: 'data/customers.jsonl', orders: 'data/orders.jsonl' };
this.state = { varieties: [], lots: [], customers: [], orders: [] };

  }

  isConfigured(){ return !!(this.repo.owner && this.repo.name && this.repo.branch); }
  setRepo(cfg){ this.repo = cfg; localStorage.setItem('repo', JSON.stringify(cfg)); }

  _cacheKey(key){ return 'cache_'+key; }
  _setCache(key, jsonl){ localStorage.setItem(this._cacheKey(key), jsonl); }
  _getCache(key){ return this.parseJsonl(localStorage.getItem(this._cacheKey(key))); }

  nextId(prefix='VAR'){
    const nums = (this.state.varieties||[])
      .map(v => (v.id||'').startsWith(prefix) ? Number((v.id||'').split('-')[1]) : 0)
      .filter(n => !Number.isNaN(n));
    const n = (nums.length ? Math.max(...nums) : 0) + 1;
    return `${prefix}-${String(n).padStart(4,'0')}`;
  }
  nextLotId(prefix='LOT'){
    const nums = (this.state.lots||[])
      .map(v => (v.id||'').startsWith(prefix) ? Number((v.id||'').split('-')[1]) : 0)
      .filter(n => !Number.isNaN(n));
    const n = (nums.length ? Math.max(...nums) : 0) + 1;
    return `${prefix}-${String(n).padStart(4,'0')}`;
  }

 nextCustomerId(prefix='CUS'){
  const nums = (this.state.customers||[]).map(v => Number((v.id||'').split('-')[1])||0);
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${String(n).padStart(4,'0')}`;
}
nextOrderId(prefix='ORD'){
  const nums = (this.state.orders||[]).map(v => Number((v.id||'').split('-')[1])||0);
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${String(n).padStart(4,'0')}`;
} 

  parseJsonl(txt){
    if(!txt || !String(txt).trim()) return [];
    return txt.trim().split('\n').map(line => JSON.parse(line));
  }
  toJsonl(arr){ return (arr||[]).map(o=>JSON.stringify(o)).join('\n') + '\n'; }

  async loadAll(){
    try { await this.loadKey('varieties'); } catch(e){ this.state.varieties = this._getCache('varieties') || []; }
    try { await this.loadKey('lots'); } catch(e){ this.state.lots = this._getCache('lots') || []; }
    try { await this.loadKey('customers'); } catch(e){ this.state.customers = this._getCache('customers') || []; }
try { await this.loadKey('orders'); }    catch(e){ this.state.orders    = this._getCache('orders') || []; }

    
    if(this.state.varieties.length === 0){
      const now = new Date().toISOString();
      this.state.varieties = [
        { id: 'VAR-0001', name: 'Black Madeira', category: 'grail', default_price: 75, status: 'active', tags:['rich','late'], description:'Intense flavor; later ripening.', created_at:now },
        { id: 'VAR-0002', name: 'BNR',           category: 'premium', default_price: 55, status: 'active', tags:['productive'], description:'Productive; collector favorite.', created_at:now }
      ];
      await this.saveKey('varieties');
    }
    if(this.state.lots.length === 0){
      await this.saveKey('lots');
    }
  }

  async loadKey(key){
  const path = this.paths[key];

  // 1) Start with local cache (last saved in your browser)
  const cachedArr = this._getCache(key) || [];
  let merged = Array.isArray(cachedArr) ? [...cachedArr] : [];

  // Helper to merge two arrays of records by id (tie -> prefer local)
  const mergeById = (localArr, remoteArr) => {
    const byId = new Map();
    const ts = v => new Date(v?.updated_at || v?.created_at || 0).getTime() || 0;

    for (const r of (remoteArr || [])) byId.set(r.id, r);
    for (const l of (localArr  || [])) {
      const old = byId.get(l.id);
      if (!old) { byId.set(l.id, l); continue; }
      const tl = ts(l), tr = ts(old);
      if (tl >= tr) byId.set(l.id, l);  // local wins on newer or tie
    }
    return [...byId.values()].sort((a,b)=>(a.id||'').localeCompare(b.id||''));
  };

  // 2) Try remote (raw file on your site or via GitHub API)
  const tryRelative = async () => {
    try {
      const r = await fetch(path, { cache: 'no-store' });
      if (r.ok) return await r.text();
    } catch(_) {}
    return null;
  };
  const tryRemote = async () => {
    // prefer raw (fast) then API (token/private)
    const raw = await tryRelative();
    if (raw !== null) return raw;
    return await this._getRemoteText(path);
  };

  const remoteTxt = await tryRemote();
  if (remoteTxt !== null) {
    const remoteArr = this.parseJsonl(remoteTxt);
    merged = mergeById(cachedArr, remoteArr);
  }

  // 3) Persist merged to state + cache (so next refresh keeps your edits)
  this.state[key] = merged;
  this._setCache(key, this.toJsonl(merged));
}

  async _getRemoteText(path){
    if (this.isConfigured()){
      try{
        const rawUrl = `https://raw.githubusercontent.com/${this.repo.owner}/${this.repo.name}/${this.repo.branch}/${path}`;
        const r = await fetch(rawUrl, { cache:'no-store' });
        if (r.ok) return await r.text();
      }catch(_){}
    }
    if (this.isConfigured() && this.repo.token){
      try{
        const apiUrl = `https://api.github.com/repos/${this.repo.owner}/${this.repo.name}/contents/${path}?ref=${this.repo.branch}`;
        const r = await fetch(apiUrl, { headers:{ Authorization:`Bearer ${this.repo.token}` }});
        if (r.ok){
          const meta = await r.json();
          return atob((meta.content||'').replace(/\n/g,''));
        }
      }catch(_){}
    }
    return null;
  }

  async saveKey(key){
    const arr = this.state[key] || [];
    const jsonl = this.toJsonl(arr);
    this._setCache(key, jsonl); // always cache first

    if(!this.isConfigured() || !this.repo.token) return; // local-only mode

    if (key === 'varieties' && arr.length === 0){
      console.warn('[Guard] Refusing to overwrite remote with empty varieties.');
      return;
    }

    const path = this.paths[key];

    const getSha = async () => {
      const r = await fetch(
        `https://api.github.com/repos/${this.repo.owner}/${this.repo.name}/contents/${path}?ref=${this.repo.branch}`,
        { headers:{ Authorization:`Bearer ${this.repo.token}` } }
      );
      if (!r.ok) return undefined;
      const meta = await r.json();
      return meta.sha;
    };

    const putWithSha = async (sha) => {
      const body = {
        message: `update ${path}`,
        content: btoa(unescape(encodeURIComponent(jsonl))),
        branch: this.repo.branch
      };
      if (sha) body.sha = sha;

      return fetch(
        `https://api.github.com/repos/${this.repo.owner}/${this.repo.name}/contents/${path}`,
        { method:'PUT', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${this.repo.token}` }, body: JSON.stringify(body) }
      );
    };

    let sha = await getSha();
    let res = await putWithSha(sha);
    if (res.status === 409){ // conflict → refresh sha and retry once
      console.warn('[FigOps] 409 conflict — refetching sha and retrying…');
      sha = await getSha();
      res = await putWithSha(sha);
    }
    if (!res.ok){
      const t = await res.text().catch(()=>'(no body)');
      console.error('GitHub save failed', res.status, t);
      throw new Error('GitHub save failed');
    }
  }

  async syncKey(key){
    const path = this.paths[key];
    const remoteTxt = await this._getRemoteText(path);
    const remoteArr = remoteTxt ? this.parseJsonl(remoteTxt) : [];
    const localArr  = this.state[key] || [];

    const byId = new Map();
    const stamp = v => new Date(v.updated_at||v.created_at||0).getTime() || 0;

    // seed with remote
    for (const r of remoteArr) byId.set(r.id, r);

    // merge local (newer wins; tie → keep local)
    for (const l of localArr){
      const old = byId.get(l.id);
      if (!old) { byId.set(l.id, l); continue; }
      const sl = stamp(l), sr = stamp(old);
      if (sl >= sr) byId.set(l.id, l);
    }

    const merged = [...byId.values()].sort((a,b)=>(a.id||'').localeCompare(b.id||''));
    this.state[key] = merged;

    try { await this.saveKey(key); }
    catch(err){ console.warn('saveKey failed (kept local state & cache):', err); }
  }

  async upsertVariety(v){
    if(!v.id) v.id = this.nextId();
    const a = this.state.varieties || [];
    const i = a.findIndex(x => x.id === v.id);
    if(i >= 0) a[i] = v; else a.push(v);
    this.state.varieties = a;
    await this.saveKey('varieties');
  }
  async deleteVariety(id){
    this.state.varieties = (this.state.varieties||[]).filter(v => v.id !== id);
    await this.saveKey('varieties');
  }

  computeLotSuccess(l){
    const t = Number(l.qty_total||0), r = Number(l.qty_rooted||0);
    if (t<=0) return 0;
    return Math.round((r*100)/t);
  }
  async upsertLot(l){
    if(!l.id) l.id = this.nextLotId();
    const a = this.state.lots || [];
    const i = a.findIndex(x => x.id === l.id);
    if(i >= 0) a[i] = l; else a.push(l);
    this.state.lots = a;
    await this.saveKey('lots');
  }
async upsertCustomer(c){
  if(!c.id) c.id = this.nextCustomerId();
  const a = this.state.customers || [];
  const i = a.findIndex(x => x.id === c.id);
  if(i >= 0) a[i] = c; else a.push(c);
  this.state.customers = a;
  await this.saveKey('customers');
}
async deleteCustomer(id){
  this.state.customers = (this.state.customers||[]).filter(x => x.id !== id);
  await this.saveKey('customers');
}

  orderTotal(o){
  return (o.items||[]).reduce((s,it)=> s + Number(it.qty||0)*Number(it.price||0), 0);
}
async upsertOrder(o){
  if(!o.id) o.id = this.nextOrderId();
  o.total = this.orderTotal(o);
  const a = this.state.orders || [];
  const i = a.findIndex(x => x.id === o.id);
  if(i >= 0) a[i] = o; else a.push(o);
  this.state.orders = a;
  await this.saveKey('orders');
}
async deleteOrder(id){
  this.state.orders = (this.state.orders||[]).filter(x => x.id !== id);
  await this.saveKey('orders');
}
  
  async deleteLot(id){
    this.state.lots = (this.state.lots||[]).filter(x => x.id !== id);
    await this.saveKey('lots');
  }

  // How many saplings are available to sell for a variety.
// rooted = sum of rooted pieces across all lots for that variety
// reserved = quantities already used in orders with statuses that "reserve" stock
// (confirmed, paid, shipped). Draft & cancelled do NOT reserve.
availableFor(varietyId, excludeOrderId = null){
  const rooted = (this.state.lots||[])
    .filter(l => l.variety_id === varietyId)
    .reduce((s,l) => s + Number(l.qty_rooted||0), 0);

  const reserveStatuses = new Set(['confirmed','paid','shipped']);
  const reserved = (this.state.orders||[])
    .filter(o => o.id !== excludeOrderId && reserveStatuses.has((o.status||'').toLowerCase()))
    .reduce((sum, o) => sum + (o.items||[])
      .filter(it => it.variety_id === varietyId)
      .reduce((s,it) => s + Number(it.qty||0), 0), 0);

  return Math.max(rooted - reserved, 0);
}
  
}
