// modules/storage.js — local-first + safe GitHub sync (merge + guard)
export class Storage{
  constructor(){
    this.repo  = JSON.parse(localStorage.getItem('repo')||'{}');
    this.paths = { varieties: 'data/varieties.jsonl', lots: 'data/lots.jsonl' };
    this.state = { varieties: [], lots: [] };
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

  parseJsonl(txt){
    if(!txt || !String(txt).trim()) return [];
    return txt.trim().split('\n').map(line => JSON.parse(line));
  }
  toJsonl(arr){ return (arr||[]).map(o=>JSON.stringify(o)).join('\n') + '\n'; }

  async loadAll(){
    try { await this.loadKey('varieties'); } catch(e){ this.state.varieties = this._getCache('varieties') || []; }
    try { await this.loadKey('lots'); } catch(e){ this.state.lots = this._getCache('lots') || []; }

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

    try{
      const r = await fetch(path, { cache:'no-store' });
      if (r.ok){
        const txt = await r.text();
        const arr = this.parseJsonl(txt);
        this.state[key] = arr;
        this._setCache(key, this.toJsonl(arr));
        return;
      }
    }catch(_){}

    const remote = await this._getRemoteText(path);
    if (remote !== null){
      const arr = this.parseJsonl(remote);
      this.state[key] = arr;
      this._setCache(key, this.toJsonl(arr));
      return;
    }

    const cached = this._getCache(key);
    this.state[key] = Array.isArray(cached) ? cached : [];
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
    this._setCache(key, jsonl);

    if(!this.isConfigured() || !this.repo.token) return;

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

      const putRes = await fetch(
        `https://api.github.com/repos/${this.repo.owner}/${this.repo.name}/contents/${path}`,
        { method:'PUT', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${this.repo.token}` }, body: JSON.stringify(body) }
      );
      return putRes;
    };

    let sha = await getSha();
    let res = await putWithSha(sha);
    if (res.status == 409){
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

    for (const v of remoteArr) byId.set(v.id, v);
    for (const v of localArr){
      const old = byId.get(v.id);
      if (!old || stamp(v) >= stamp(old)) byId.set(v.id, v);
    }

    const merged = [...byId.values()].sort((a,b)=>(a.id||'').localeCompare(b.id||''));
    this.state[key] = merged;
    await this.saveKey(key);
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
  async deleteLot(id){
    this.state.lots = (this.state.lots||[]).filter(x => x.id !== id);
    await this.saveKey('lots');
  }
}
