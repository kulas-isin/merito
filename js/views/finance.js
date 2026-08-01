/* ═══ 04 報價與收款 ═══ */
const ViewFinance = (function(){

  let showPaid=false;

  function render(el){
    const quotes=U.sortBy(Store.list('quotes'),function(q){return q.date||'';},true);
    const payments=Store.list('payments');
    const unpaid=payments.filter(function(x){ return !x.paidDate; });
    const received=U.sum(payments.filter(function(x){return x.paidDate;}),function(x){return x.amount;});
    const outstanding=U.sum(unpaid,function(x){return x.amount;});
    const overdue=unpaid.filter(function(x){ return x.dueDate && U.daysFromToday(x.dueDate)<0; });
    const quoted=U.sum(quotes.filter(function(q){return q.status==='sent';}),function(q){return q.amount;});
    const won=quotes.filter(function(q){return q.status==='accepted';});
    const closed=quotes.filter(function(q){return q.status==='accepted'||q.status==='rejected';});
    const winRate=closed.length? Math.round(won.length/closed.length*100) : null;

    el.innerHTML=
      '<h2 class="sect">Quotes & Payments</h2>'+
      '<p class="lead">報價出去了沒回覆、里程碑到期沒收到錢 —— 這頁專門盯這兩件事。</p>'+

      '<div class="kpis" style="margin-bottom:20px">'+
        '<div class="kpi"><div class="k">待回覆報價</div><div class="v">'+U.money0(quoted)+'</div>'+
          '<div class="s">'+quotes.filter(function(q){return q.status==='sent';}).length+' 張已送出</div></div>'+
        '<div class="kpi"><div class="k">成交率</div><div class="v">'+(winRate==null?'—':winRate+'<small>%</small>')+'</div>'+
          '<div class="s">'+won.length+' 成交 / '+closed.length+' 已結案</div></div>'+
        '<div class="kpi good"><div class="k">已收</div><div class="v">'+U.money0(received)+'</div>'+
          '<div class="s">共 '+payments.filter(function(x){return x.paidDate;}).length+' 筆</div></div>'+
        '<div class="kpi'+(overdue.length?' warn':'')+'"><div class="k">未收</div><div class="v">'+U.money0(outstanding)+'</div>'+
          '<div class="s">'+(overdue.length? '逾期 '+overdue.length+' 筆 · '+U.money0(U.sum(overdue,function(x){return x.amount;})) : '沒有逾期')+'</div></div>'+
      '</div>'+

      '<div class="row-between"><h3 class="blk" style="margin:0;border:none">報價單</h3>'+
        '<button class="act sm" data-act="new-quote">＋ 新增報價</button></div>'+
      renderQuotes(quotes)+

      '<div class="row-between" style="margin-top:30px"><h3 class="blk" style="margin:0;border:none">收款里程碑</h3>'+
        '<div class="btn-row">'+
          '<button class="act ghost sm" data-act="toggle-paid">'+(showPaid?'隱藏已收':'顯示已收')+'</button>'+
          '<button class="act ghost sm" data-act="export">匯出 CSV</button>'+
          '<button class="act sm" data-act="new-payment">＋ 新增款項</button>'+
        '</div></div>'+
      renderPayments(payments);

    bind(el);
  }

  function renderQuotes(quotes){
    if(!quotes.length) return UI.emptyBox('還沒有報價記錄。');
    return '<div class="table-scroll"><table><thead><tr>'+
      '<th>報價項目</th><th>客戶</th><th>金額</th><th>狀態</th><th>報價日</th><th>有效至</th><th></th>'+
      '</tr></thead><tbody>'+
      quotes.map(function(q){
        const d=U.daysFromToday(q.validUntil);
        const expiring=q.status==='sent' && d!==null && d<=7;
        return '<tr><td><strong>'+U.esc(q.title)+'</strong>'+
            (q.note?'<div class="small muted">'+U.esc(q.note)+'</div>':'')+'</td>'+
          '<td class="small">'+U.esc(Store.clientName(q.clientId))+'</td>'+
          '<td class="num">'+U.money(q.amount)+'</td>'+
          '<td>'+UI.pill(UI.QUOTE_STATUS,q.status)+'</td>'+
          '<td class="small muted nowrap">'+U.dateStr(q.date)+'</td>'+
          '<td class="small nowrap'+(expiring?' neg':' muted')+'">'+U.dateStr(q.validUntil)+
            (expiring? '<div class="small">'+(d<0?'已過期':d+' 天內到期')+'</div>':'')+'</td>'+
          '<td class="tight">'+
            '<button class="linkbtn" data-act="edit-quote" data-id="'+U.esc(q.id)+'">編輯</button>'+
            '<button class="linkbtn" data-act="del-quote" data-id="'+U.esc(q.id)+'">刪除</button>'+
          '</td></tr>';
      }).join('')+'</tbody></table></div>';
  }

  function renderPayments(payments){
    const rows=payments.filter(function(x){ return showPaid || !x.paidDate; });
    if(!rows.length) return UI.emptyBox(showPaid?'還沒有收款記錄。':'沒有未收款項。');
    return '<div class="table-scroll"><table><thead><tr>'+
      '<th>款項</th><th>客戶</th><th>專案</th><th>金額</th><th>到期日</th><th>狀態</th><th></th>'+
      '</tr></thead><tbody>'+
      U.sortBy(rows,function(x){ return (x.paidDate?'9':'0')+(x.dueDate||'9999'); }).map(function(x){
        const d=U.daysFromToday(x.dueDate);
        const late=!x.paidDate && d!==null && d<0;
        return '<tr><td><strong>'+U.esc(x.name)+'</strong></td>'+
          '<td class="small">'+U.esc(Store.clientName(x.clientId))+'</td>'+
          '<td class="small muted">'+U.esc(x.projectId? projectName(x.projectId) : '—')+'</td>'+
          '<td class="num">'+U.money(x.amount)+'</td>'+
          '<td class="small nowrap'+(late?' neg':'')+'">'+U.dateStr(x.dueDate)+
            (!x.paidDate&&d!==null? '<div class="small mono">'+(d<0?'逾期 '+(-d)+' 天':d+' 天後')+'</div>':'')+'</td>'+
          '<td>'+(x.paidDate
            ? '<span class="pill green">已收 '+U.dateStr(x.paidDate)+'</span>'
            : (late? '<span class="pill red">逾期</span>' : '<span class="pill grey">未收</span>'))+'</td>'+
          '<td class="tight">'+
            (x.paidDate
              ? '<button class="linkbtn" data-act="unpay" data-id="'+U.esc(x.id)+'">改回未收</button>'
              : '<button class="linkbtn" data-act="pay" data-id="'+U.esc(x.id)+'">標記已收</button>')+
            '<button class="linkbtn" data-act="edit-payment" data-id="'+U.esc(x.id)+'">編輯</button>'+
            '<button class="linkbtn" data-act="del-payment" data-id="'+U.esc(x.id)+'">刪除</button>'+
          '</td></tr>';
      }).join('')+'</tbody></table></div>';
  }

  function projectName(id){
    const p=Store.get('projects',id);
    return p? p.name : '（已刪除）';
  }

  function bind(el){
    el.querySelector('[data-act="new-quote"]').onclick=function(){ editQuote(null); };
    el.querySelector('[data-act="new-payment"]').onclick=function(){ editPayment(null); };
    el.querySelector('[data-act="toggle-paid"]').onclick=function(){ showPaid=!showPaid; Main.render(); };
    el.querySelector('[data-act="export"]').onclick=exportCSV;

    U.$$('[data-act="edit-quote"]',el).forEach(function(b){
      b.onclick=function(){ editQuote(Store.get('quotes',b.dataset.id)); };
    });
    U.$$('[data-act="del-quote"]',el).forEach(function(b){
      b.onclick=function(){
        const q=Store.get('quotes',b.dataset.id);
        UI.confirm('刪除報價','確定刪除「'+(q?q.title:'')+'」？',function(){
          Store.remove('quotes',b.dataset.id); UI.toast('已刪除');
        });
      };
    });
    U.$$('[data-act="edit-payment"]',el).forEach(function(b){
      b.onclick=function(){ editPayment(Store.get('payments',b.dataset.id)); };
    });
    U.$$('[data-act="del-payment"]',el).forEach(function(b){
      b.onclick=function(){
        const x=Store.get('payments',b.dataset.id);
        UI.confirm('刪除款項','確定刪除「'+(x?x.name:'')+'」？',function(){
          Store.remove('payments',b.dataset.id); UI.toast('已刪除');
        });
      };
    });
    U.$$('[data-act="pay"]',el).forEach(function(b){
      b.onclick=function(){
        const x=Store.get('payments',b.dataset.id);
        Store.upsert('payments',{id:x.id,paidDate:U.today()});
        if(x.clientId) Store.logActivity(x.clientId,'payment','收到款項「'+x.name+'」'+U.money0(x.amount));
        UI.toast('已標記為收款');
      };
    });
    U.$$('[data-act="unpay"]',el).forEach(function(b){
      b.onclick=function(){
        Store.upsert('payments',{id:b.dataset.id,paidDate:''});
        UI.toast('已改回未收');
      };
    });
  }

  function editQuote(q){
    UI.form({
      title:q?'編輯報價':'新增報價',
      submitLabel:q?'儲存':'新增',
      fields:[
        {k:'title',label:'報價項目',value:q&&q.title,required:true,placeholder:'例：官網改版一期'},
        {k:'clientId',label:'客戶',type:'select',options:UI.clientOptions(true),value:q&&q.clientId},
        {k:'amount',label:'金額',type:'number',value:q&&q.amount,placeholder:'120000'},
        {k:'status',label:'狀態',type:'select',options:UI.options(UI.QUOTE_STATUS),value:q?q.status:'draft'},
        {k:'date',label:'報價日',type:'date',value:q?q.date:U.today()},
        {k:'validUntil',label:'有效至',type:'date',value:q&&q.validUntil},
        {k:'note',label:'備註',type:'textarea',value:q&&q.note,full:true,placeholder:'包含／不包含的範圍'}
      ],
      onSubmit:function(v){
        const before=q?q.status:null;
        const rec=Store.upsert('quotes',Object.assign({},v,{id:q?q.id:undefined}));
        if(rec.clientId){
          if(before!==rec.status && rec.status==='accepted')
            Store.logActivity(rec.clientId,'quote','報價「'+rec.title+'」成交 '+U.money0(rec.amount));
          else
            Store.logActivity(rec.clientId,'quote',(q?'更新':'新增')+'報價「'+rec.title+'」');
        }
        UI.toast('已儲存');
      }
    });
  }

  function editPayment(x){
    UI.form({
      title:x?'編輯款項':'新增收款里程碑',
      sub:x?'':'把合約拆成幾期，到期沒收到就會在儀表板亮紅字。',
      submitLabel:x?'儲存':'新增',
      fields:[
        {k:'name',label:'款項名稱',value:x&&x.name,required:true,placeholder:'例：簽約款 30%'},
        {k:'clientId',label:'客戶',type:'select',options:UI.clientOptions(true),value:x&&x.clientId},
        {k:'projectId',label:'專案',type:'select',options:UI.projectOptions(null,true),value:x&&x.projectId},
        {k:'amount',label:'金額',type:'number',value:x&&x.amount,placeholder:'36000'},
        {k:'dueDate',label:'到期日',type:'date',value:x&&x.dueDate},
        {k:'paidDate',label:'實收日（留空 = 未收）',type:'date',value:x&&x.paidDate}
      ],
      onSubmit:function(v){
        Store.upsert('payments',Object.assign({},v,{id:x?x.id:undefined}));
        UI.toast('已儲存');
      }
    });
  }

  function exportCSV(){
    const rows=[['款項','客戶','專案','金額','到期日','實收日','狀態']];
    Store.list('payments').forEach(function(x){
      const d=U.daysFromToday(x.dueDate);
      rows.push([x.name,Store.clientName(x.clientId),x.projectId?projectName(x.projectId):'',
        U.num(x.amount),x.dueDate||'',x.paidDate||'',
        x.paidDate?'已收':((d!==null&&d<0)?'逾期':'未收')]);
    });
    U.download('merito-payments-'+U.today()+'.csv','﻿'+U.toCSV(rows),'text/csv;charset=utf-8');
  }

  return {render:render};
})();
