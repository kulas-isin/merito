/* ═══ 03 專案追蹤 ═══ */
const ViewProjects = (function(){

  let query='';
  let filterStage='';

  function render(el){
    el.innerHTML=
      '<h2 class="sect">Project Tracker</h2>'+
      '<p class="lead">追蹤每個案子的合約、投入與損益。損益為負代表虧本，一眼看出哪些案子在燒錢。工時 × 時薪成本就是實際投入。</p>'+
      '<div class="row-between">'+
        '<div class="btn-row" style="flex:1">'+
          '<input class="search" id="pSearch" placeholder="搜尋專案／客戶／註記" value="'+U.esc(query)+'">'+
          '<select id="pStage" style="font-family:inherit;font-size:14.5px;padding:9px 11px;border:1px solid var(--line);background:#fff;border-radius:2px">'+
            '<option value="">全部階段</option>'+
            UI.STAGES.map(function(s){
              return '<option value="'+s.v+'"'+(filterStage===s.v?' selected':'')+'>'+U.esc(s.l)+'</option>';
            }).join('')+
          '</select>'+
        '</div>'+
        '<div class="btn-row">'+
          '<button class="act ghost sm" data-act="export">匯出 CSV</button>'+
          '<button class="act" data-act="new">＋ 新增專案</button>'+
        '</div>'+
      '</div>'+
      '<div id="projList"></div>';

    el.querySelector('[data-act="new"]').onclick=function(){ edit(null); };
    el.querySelector('[data-act="export"]').onclick=exportCSV;
    const s=el.querySelector('#pSearch');
    s.oninput=function(){ query=s.value; paint(el); };
    el.querySelector('#pStage').onchange=function(){ filterStage=this.value; paint(el); };
    paint(el);
  }

  function filtered(){
    return Store.list('projects').filter(function(p){
      if(filterStage && p.stage!==filterStage) return false;
      return U.matches([p.name,Store.clientName(p.clientId),p.note,p.owner].join(' '),query);
    });
  }

  function paint(el){
    const box=el.querySelector('#projList');
    const rows=filtered();
    if(!rows.length){ box.innerHTML=UI.emptyBox('沒有符合的專案。可用「＋ 新增專案」建立。'); return; }

    const totals=rows.reduce(function(a,p){
      const e=Store.projectEconomics(p);
      a.amount+=e.effective; a.cost+=e.cost; a.hours+=U.num(p.hours);
      return a;
    },{amount:0,cost:0,hours:0});

    box.innerHTML='<div class="table-scroll"><table><thead><tr>'+
      '<th>專案</th><th>客戶</th><th>階段</th><th>合約</th><th>工時</th><th>時薪</th><th>成本</th><th>損益</th><th>負責人</th><th></th>'+
      '</tr></thead><tbody>'+
      U.sortBy(rows,function(p){return Store.projectEconomics(p).margin;}).map(function(p){
        const e=Store.projectEconomics(p);
        return '<tr>'+
          '<td><strong>'+U.esc(p.name)+'</strong>'+
            (p.note?'<div class="small muted">'+U.esc(p.note)+'</div>':'')+'</td>'+
          '<td class="small">'+U.esc(Store.clientName(p.clientId))+'</td>'+
          '<td>'+UI.pill(UI.STAGES,p.stage)+'</td>'+
          '<td class="num">'+U.money(e.effective)+
            (e.added? '<div class="small muted">原 '+U.money0(e.amount)+' ＋異動 '+U.money0(e.added)+'</div>':'')+'</td>'+
          '<td class="num">'+(U.num(p.hours)?U.num(p.hours).toLocaleString():'—')+'</td>'+
          '<td class="num">'+U.money(p.rate)+'</td>'+
          '<td class="num">'+U.money(e.cost)+'</td>'+
          '<td class="num '+(e.margin<0?'neg':'pos')+'">'+
            (e.hasBoth? U.money0(e.margin)+'<div class="small">'+(e.pct>0?'+':'')+e.pct+'%</div>' : '—')+'</td>'+
          '<td class="small muted">'+U.esc(p.owner||'—')+'</td>'+
          '<td class="tight">'+
            '<button class="linkbtn" data-act="change" data-id="'+U.esc(p.id)+'">＋異動</button>'+
            '<button class="linkbtn" data-act="hours" data-id="'+U.esc(p.id)+'">記工時</button>'+
            '<button class="linkbtn" data-act="edit" data-id="'+U.esc(p.id)+'">編輯</button>'+
            '<button class="linkbtn" data-act="del" data-id="'+U.esc(p.id)+'">刪除</button>'+
          '</td></tr>';
      }).join('')+
      '</tbody><tfoot><tr>'+
        '<th colspan="3">合計 '+rows.length+' 案</th>'+
        '<th class="num">'+U.money(totals.amount)+'</th>'+
        '<th class="num">'+(totals.hours?totals.hours.toLocaleString():'—')+'</th><th></th>'+
        '<th class="num">'+U.money(totals.cost)+'</th>'+
        '<th class="num '+(totals.amount-totals.cost<0?'neg':'pos')+'">'+U.money0(totals.amount-totals.cost)+'</th>'+
        '<th colspan="2"></th>'+
      '</tr></tfoot></table></div>';

    U.$$('[data-act="edit"]',box).forEach(function(b){
      b.onclick=function(){ edit(Store.get('projects',b.dataset.id)); };
    });
    U.$$('[data-act="change"]',box).forEach(function(b){
      b.onclick=function(){
        const p=Store.get('projects',b.dataset.id);
        ViewChanges.quickAdd(p.clientId,p.id);
      };
    });
    U.$$('[data-act="hours"]',box).forEach(function(b){
      b.onclick=function(){ addHours(Store.get('projects',b.dataset.id)); };
    });
    U.$$('[data-act="del"]',box).forEach(function(b){
      b.onclick=function(){
        const p=Store.get('projects',b.dataset.id);
        UI.confirm('刪除專案','確定刪除「'+(p?p.name:'')+'」？相關收款不會一併刪除。',function(){
          Store.remove('projects',b.dataset.id); UI.toast('已刪除');
        });
      };
    });
  }

  function edit(p){
    UI.form({
      title:p?'編輯專案':'新增專案',
      sub:p?'':'合約金額與工時、時薪都填了才算得出損益。',
      submitLabel:p?'儲存':'新增',
      fields:[
        {k:'name',label:'專案名稱',value:p&&p.name,required:true,placeholder:'例：官網改版'},
        {k:'clientId',label:'客戶',type:'select',options:UI.clientOptions(true),value:p&&p.clientId},
        {k:'stage',label:'階段',type:'select',options:UI.options(UI.STAGES),value:p?p.stage:'dev'},
        {k:'owner',label:'負責人',type:'select',options:UI.memberOptions(true),value:p&&p.owner},
        {k:'amount',label:'合約金額',type:'number',value:p&&p.amount,placeholder:'120000'},
        {k:'startDate',label:'開始日',type:'date',value:p?p.startDate:U.today()},
        {k:'hours',label:'已投入工時',type:'number',value:p&&p.hours,placeholder:'1133.5'},
        {k:'rate',label:'時薪成本',type:'number',value:p&&p.rate,placeholder:'500'},
        {k:'note',label:'註記／待報價風險',type:'textarea',value:p&&p.note,full:true,
          placeholder:'例：要 code 想接手；新需求待報價'}
      ],
      onSubmit:function(v){
        const rec=Store.upsert('projects',Object.assign({},v,{id:p?p.id:undefined}));
        if(rec.clientId) Store.logActivity(rec.clientId,'project',(p?'更新':'新增')+'專案 '+rec.name);
        UI.toast('已儲存');
      }
    });
  }

  /* 累加工時：比每次手改總數快，也不容易改錯 */
  function addHours(p){
    if(!p) return;
    UI.form({
      title:'記工時 — '+p.name,
      sub:'目前累計 '+U.num(p.hours).toLocaleString()+' 小時。填入這次新增的時數，會直接累加。',
      submitLabel:'累加',
      fields:[
        {k:'add',label:'新增工時',type:'number',required:true,placeholder:'8'},
        {k:'memo',label:'做了什麼',value:'',placeholder:'例：修驗收回報的 12 個問題'}
      ],
      onSubmit:function(v){
        const add=U.num(v.add);
        if(!add){ UI.toast('請填有效時數',true); return false; }
        const now=U.num(p.hours)+add;
        Store.upsert('projects',{id:p.id,hours:now});
        if(p.clientId) Store.logActivity(p.clientId,'hours','['+p.name+'] 記錄 '+add+' 小時'+(v.memo?'：'+v.memo:'')+'（累計 '+now+'）');
        UI.toast('已累加至 '+now+' 小時');
      }
    });
  }

  function exportCSV(){
    const rows=[['專案','客戶','階段','原合約金額','已確認異動','合約含異動','工時','時薪','投入成本','損益','毛利率%','負責人','開始日','註記']];
    Store.list('projects').forEach(function(p){
      const e=Store.projectEconomics(p);
      rows.push([p.name,Store.clientName(p.clientId),UI.lookup(UI.STAGES,p.stage).l,
        e.amount,e.added,e.effective,U.num(p.hours),U.num(p.rate),e.cost,e.margin,
        e.pct==null?'':e.pct,p.owner||'',p.startDate||'',p.note||'']);
    });
    U.download('merito-projects-'+U.today()+'.csv','﻿'+U.toCSV(rows),'text/csv;charset=utf-8');
  }

  return {render:render};
})();
