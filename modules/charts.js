export class Charts{
  init(){ this._charts = {}; }
  _make(id, cfg){
    if(this._charts[id]){ this._charts[id].destroy(); }
    const ctx = document.getElementById(id).getContext('2d');
    this._charts[id] = new Chart(ctx, cfg);
  }
  orders(ts){
    this._make('ordersChart', { type:'line',
      data:{ labels: ts.labels, datasets:[{ label:'Orders', data: ts.data }]},
      options:{ responsive:true, maintainAspectRatio:false }
    });
  }
  rooting(d){
    this._make('rootingChart', { type:'bar',
      data:{ labels:d.labels, datasets:[{ label:'Avg Success %', data:d.data }]},
      options:{ responsive:true, maintainAspectRatio:false, scales:{y:{beginAtZero:true,max:100}} }
    });
  }
  varieties(d){
    this._make('varietiesChart', { type:'bar',
      data:{ labels:d.labels, datasets:[{ label:'Qty Ordered', data:d.data }]},
      options:{ responsive:true, maintainAspectRatio:false }
    });
  }
  returns(d){
    this._make('returnsChart', { type:'doughnut',
      data:{ labels:d.labels, datasets:[{ data:d.data }]},
      options:{ responsive:true, maintainAspectRatio:false }
    });
  }
}