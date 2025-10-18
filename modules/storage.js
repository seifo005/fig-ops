export class Storage{
  constructor(){
    this.repo = JSON.parse(localStorage.getItem('repo')||'{}');
    this.state = { varieties: [], lots: [], orders: [], customers: [] };
    this.paths = {
      varieties: 'data/varieties.jsonl',
      lots: 'data/lots.jsonl',
      orders: 'data/orders.jsonl',
      customers: 'data/customers.jsonl'
    };
  }
  isConfigured(){ return !!(this.repo.owner && this.repo.name && this.repo.branch); }
  setRepo(cfg){ this.repo = cfg; localStorage.setItem('repo', JSON.stringify(cfg)); }

  async loadAll(){
    try{
      await Promise.all(Object.keys(this.paths).map(k=>this.loadKey(k)));
    }catch(e){ console.warn('Load fallback', e); }
    if(this.state.varieties.length===0){
      this.state.varieties = [{name:'Black Madeira'},{name:'BNR'},{name:'Coll de Dama Gris'},{name:'Local Winter Fig'}];
      this.state.customers = [{id:'CUS-0001', name:'First Customer'}];
    }
  }
  async loadKey(key){
    const url = this.isConfigured() ?
      `https://raw.githubusercontent.com/${this.repo.owner}/${this.repo.name}/${this.repo.branch}/${this.paths[key]}` :
      this.paths[key];
    const res = await fetch(url);
    if(!res.ok) return;
    const txt = await res.text();
    this.state[key] = txt.trim()? txt.trim().split('\n').map(line=>JSON.parse(line)) : [];
  }
  async add(key, obj){
    this.state[key].push(obj);
    await this.saveKey(key);
  }
  getCustomerName(id){ const c=this.state.customers.find(x=>x.id===id); return c?c.name:id; }
  nextId(prefix){
    const nums = [];
    for(const arr of Object.values(this.state)){
      for(const x of arr){ if((x.id||'').startsWith(prefix)){ const n = Number((x.id||'').split('-')[1]); if(!isNaN(n)) nums.push(n); } }
    }
    const n = (nums.length?Math.max(...nums):0) + 1;
    return `${prefix}-${String(n).padStart(4,'0')}`;
  }
  async saveKey(key){
    const jsonl = this.state[key].map(o=>JSON.stringify(o)).join('\n') + '\n';
    localStorage.setItem('cache_'+key, jsonl);
    if(!this.repo.token){ return; }
    const path = this.paths[key];
    const getRes = await fetch(`https://api.github.com/repos/${this.repo.owner}/${this.repo.name}/contents/${path}?ref=${this.repo.branch}`,{
      headers:{Authorization:`Bearer ${this.repo.token}`}
    });
    let sha = undefined;
    if(getRes.ok){ const meta = await getRes.json(); sha = meta.sha; }
    const body = {
      message: `update ${path}`,
      content: btoa(unescape(encodeURIComponent(jsonl))),
      branch: this.repo.branch
    };
    if(sha) body.sha = sha;
    const putRes = await fetch(`https://api.github.com/repos/${this.repo.owner}/${this.repo.name}/contents/${path}`,{
      method:'PUT',
      headers:{'Content-Type':'application/json', Authorization:`Bearer ${this.repo.token}`},
      body: JSON.stringify(body)
    });
    if(!putRes.ok){ console.error('Save failed', await putRes.text()); throw new Error('GitHub save failed'); }
  }
  async syncAll(){
    for(const k of Object.keys(this.paths)){ await this.saveKey(k); }
  }
  async exportZip(){
    const files = {};
    for(const k of Object.keys(this.paths)){
      const txt = this.state[k].map(o=>JSON.stringify(o)).join('\n') + '\n';
      files[this.paths[k]] = txt;
    }
    const data = JSON.stringify(files);
    const blob = new Blob([data],{type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'fig-ops-export.json';
    a.click();
  }
  async importZip(file){
    const text = await file.text();
    try{
      const files = JSON.parse(text);
      for(const [path,txt] of Object.entries(files)){
        const key = Object.keys(this.paths).find(k=>this.paths[k]===path);
        if(key){ this.state[key] = txt.trim()? txt.trim().split('\n').map(l=>JSON.parse(l)) : []; }
      }
      await this.syncAll();
      location.reload();
    }catch(e){ alert('Import failed: ' + e.message); }
  }
}