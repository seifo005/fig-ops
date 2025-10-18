export class Analytics{
  constructor(store){ this.store = store; }
  kpis30d(){
    const since = Date.now() - 30*24*3600*1000;
    const orders = this.store.state.orders.filter(o=> new Date(o.date).getTime()>=since);
    const delivered = orders.filter(o=>o.delivered).length;
    const returned = orders.filter(o=>o.returned).length;
    const rootLots = this.store.state.lots.filter(l=>l.success>0);
    const avgSuccess = rootLots.length? Math.round(rootLots.reduce((a,b)=>a+b.success,0)/rootLots.length) : 0;
    return {
      orders: orders.length,
      deliverySuccess: orders.length? Math.round(100*delivered/orders.length):0,
      returnRate: orders.length? Math.round(100*returned/orders.length):0,
      rootingSuccess: avgSuccess
    };
  }
  ordersTimeSeries(){
    const map = new Map();
    for(const o of this.store.state.orders){
      map.set(o.date, (map.get(o.date)||0) + 1);
    }
    const entries = [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
    return { labels: entries.map(e=>e[0]), data: entries.map(e=>e[1]) };
  }
  rootingByMethod(){
    const map = new Map();
    for(const l of this.store.state.lots){
      const prev = map.get(l.method) || {count:0, success:0};
      prev.count += 1; prev.success += (l.success||0);
      map.set(l.method, prev);
    }
    const labels=[], data=[];
    for(const [m,vals] of map){ labels.push(m); data.push(Math.round(vals.success/vals.count||0)); }
    return {labels, data};
  }
  ordersByVariety(){
    const map = new Map();
    for(const o of this.store.state.orders){
      map.set(o.variety, (map.get(o.variety)||0) + o.qty);
    }
    const entries = [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
    return { labels: entries.map(e=>e[0]), data: entries.map(e=>e[1]) };
  }
  returnsSeries(){
    const labels=['Delivered','Returned'];
    const delivered=this.store.state.orders.filter(o=>o.delivered).length;
    const returned=this.store.state.orders.filter(o=>o.returned).length;
    return {labels, data:[delivered, returned]};
  }
}