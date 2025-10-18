// Storage — local-first with optional GitHub sync (varieties only for Step 1)
export class Storage{
  constructor(){
    this.repo = JSON.parse(localStorage.getItem('repo')||'{}');
    this.paths = { varieties: 'data/varieties.jsonl' };
    this.state = { varieties: [] };
  }
  isConfigured(){ return !!(this.repo.owner && this.repo.name && this.repo.branch); }
  setRepo(cfg){ this.repo = cfg; localStorage.setItem('repo', JSON.stringify(cfg)); }

  nextId(prefix='VAR'){
    const nums = this.state.varieties
      .map(v => (v.id||'').startsWith(prefix) ? Number((v.id||'').split('-')[1]) : 0);
    const n = (nums.length ? Math.max(...nums) : 0) + 1;
    return `${prefix}-${String(n).padStart(4,'0')}`;
  }

  async loadAll(){
    try{ await this.loadKey('varieties'); }catch(e){ console.warn('loadAll fallback', e); }
    if(this.state.varieties.length === 0){
      this.state.varieties = [
        { id: 'VAR-0001', name: 'Black Madeira', category: 'grail', default_price: 75, status: 'active', tags:['rich','late'], description:'Intense flavor; later ripening.'},
        { id: 'VAR-0002', name: 'BNR', category: 'premium', default_price: 55, status: 'active', tags:['productive'], description:'Productive; collector favorite.'}
      ];
      await this.saveKey('varieties');
    }
  }

  async loadKey(key){
    const path = this.paths[key];
    if(!this.isConfigured()){
      const res = await fetch(path, { cache:'no-store' }).catch(()=>null);
      if(res && res.ok){
        const txt = await res.text();
        this.state[key] = this.parseJsonl(txt);
      } else {
        this.state[key] = [];
      }
      return;
    }

    const rawUrl = `https://raw.githubusercontent.com/${this.repo.owner}/${this.repo.name}/${this.repo.branch}/${path}`;
    try{
      const res = await fetch(rawUrl, { cache:'no-store' });
      if(res.ok){
        const txt = await res.text();
        this.state[key] = this.parseJsonl(txt);
        return;
      }
    }catch(_){}

    if(this.repo.token){
      const apiUrl = `https://api.github.com/repos/${this.repo.owner}/${this.repo.name}/contents/${path}?ref=${this.repo.branch}`;
      const apiRes = await fetch(apiUrl, { headers: { Authorization: `Bearer ${this.repo.token}` }});
      if(apiRes.ok){
        const meta = await apiRes.json();
        const decoded = atob(meta.content.replace(/\n/g,''));
        this.state[key] = this.parseJsonl(decoded);
        return;
      }
    }

    if(!Array.isArray(this.state[key])) this.state[key] = [];
  }

  parseJsonl(txt){
    if(!txt || !txt.trim()) return [];
    return txt.trim().split('\n').map(line => JSON.parse(line));
  }

  async saveKey(key){
    const jsonl = (this.state[key]||[]).map(o=>JSON.stringify(o)).join('\n') + '\n';
    localStorage.setItem('cache_'+key, jsonl);
    if(!this.repo.token || !this.isConfigured()) return;

    const path = this.paths[key];
    let sha;
    const getRes = await fetch(`https://api.github.com/repos/${this.repo.owner}/${this.repo.name}/contents/${path}?ref=${this.repo.branch}`,{
      headers:{ Authorization:`Bearer ${this.repo.token}` }
    });
    if(getRes.ok){ const meta = await getRes.json(); sha = meta.sha; }

    const body = { message: `update ${path}`, content: btoa(unescape(encodeURIComponent(jsonl))), branch: this.repo.branch };
    if(sha) body.sha = sha;

    const putRes = await fetch(`https://api.github.com/repos/${this.repo.owner}/${this.repo.name}/contents/${path}`,{
      method:'PUT', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${this.repo.token}` }, body: JSON.stringify(body)
    });
    if(!putRes.ok){ console.error('GitHub save failed', await putRes.text()); throw new Error('GitHub save failed'); }
  }

  async upsertVariety(v){
    if(!v.id) v.id = this.nextId();
    const idx = this.state.varieties.findIndex(x => x.id === v.id);
    if(idx >= 0) this.state.varieties[idx] = v; else this.state.varieties.push(v);
    await this.saveKey('varieties');
  }
  async deleteVariety(id){
    this.state.varieties = this.state.varieties.filter(v => v.id !== id);
    await this.saveKey('varieties');
  }
}
