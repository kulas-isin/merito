/* ═══ 01 客戶主檔 ═══ */
const ViewClients = (function(){

  let currentId=null;   /* null = 列表，有值 = 檔案頁 */
  let query='';
  let filterStatus='';

  function open(id){ currentId=id; Main.go('clients'); }

  function render(el){
    if(currentId && Store.get('clients',currentId)) renderDetail(el,Store.get('clients',currentId));
    else { currentId=null; renderList(el); }
  }

  /* ───────── 列表 ───────── */
  function renderList(el){
    el.innerHTML=
      '<h2 class="sect">Clients</h2>'+
      '<p class="lead">每個客戶一份檔案：聯絡人、決策鏈、評估歷史、專案、收款、踩過的雷，全部串在一起。</p>'+
      '<div class="row-between">'+
        '<div class="btn-row" style="flex:1">'+
          '<input class="search" id="cSearch" placeholder="搜尋客戶／產業／標籤／備註" value="'+U.esc(query)+'">'+
          '<select id="cStatus" style="font-family:inherit;font-size:14.5px;padding:9px 11px;border:1px solid var(--line);background:#fff;border-radius:2px">'+
            '<option value="">全部狀態</option>'+
            UI.CLIENT_STATUS.map(function(s){
              return '<option value="'+s.v+'"'+(filterStatus===s.v?' selected':'')+'>'+U.esc(s.l)+'</option>';
            }).join('')+
          '</select>'+
        '</div>'+
        '<div class="btn-row">'+
          '<button class="act ghost sm" data-act="export-clients">匯出 CSV</button>'+
          '<button class="act" data-act="new-client">＋ 新增客戶</button>'+
        '</div>'+
      '</div>'+
      '<div id="clientList"></div>';

    el.querySelector('[data-act="new-client"]').onclick=function(){ editClient(null); };
    el.querySelector('[data-act="export-clients"]').onclick=exportCSV;
    const s=el.querySelector('#cSearch');
    s.oninput=function(){ query=s.value; paintList(el); };
    el.querySelector('#cStatus').onchange=function(){ filterStatus=this.value; paintList(el); };
    paintList(el);
  }

  function filtered(){
    return Store.list('clients').filter(function(c){
      if(filterStatus && c.status!==filterStatus) return false;
      const hay=[c.name,c.industry,c.source,c.owner,c.note,(c.tags||[]).join(' ')].join(' ');
      return U.matches(hay,query);
    });
  }

  function paintList(el){
    const box=el.querySelector('#clientList');
    const rows=U.sortBy(filtered(),function(c){return c.name;});
    if(!rows.length){ box.innerHTML=UI.emptyBox('沒有符合的客戶。'); return; }

    box.innerHTML='<div class="table-scroll"><table><thead><tr>'+
      '<th>客戶</th><th>狀態</th><th>最近評估</th><th>合約</th><th>損益</th><th>未收</th><th>負責人</th>'+
      '</tr></thead><tbody>'+
      rows.map(function(c){
        const s=Store.clientSummary(c.id);
        const a=s.latestAssessment;
        let assessCell='<span class="muted small">未評估</span>';
        if(a){
          const v=UI.verdictOf(a.total);
          assessCell='<span class="num">'+a.total+'</span>/'+UI.MAX_SCORE+
            ' <span class="pill '+v.pill+'">'+U.esc(v.label.split(' · ')[0])+'</span>';
        }
        const marginCell=s.contracted>0&&s.cost>0
          ? '<span class="num '+(s.margin<0?'neg':'pos')+'">'+U.money0(s.margin)+'</span>'
          : '<span class="muted">—</span>';
        return '<tr class="clickable" data-id="'+U.esc(c.id)+'">'+
          '<td><strong>'+U.esc(c.name)+'</strong>'+
            (c.industry?'<div class="small muted">'+U.esc(c.industry)+'</div>':'')+'</td>'+
          '<td>'+UI.pill(UI.CLIENT_STATUS,c.status)+'</td>'+
          '<td class="nowrap">'+assessCell+'</td>'+
          '<td class="num">'+U.money(s.contracted)+'</td>'+
          '<td>'+marginCell+'</td>'+
          '<td class="num'+(s.overdueAmount>0?' neg':'')+'">'+U.money(s.outstanding)+
            (s.overdueAmount>0?'<div class="small neg">逾期 '+U.money0(s.overdueAmount)+'</div>':'')+'</td>'+
          '<td class="small muted">'+U.esc(c.owner||'—')+'</td>'+
        '</tr>';
      }).join('')+'</tbody></table></div>';

    U.$$('tr.clickable',box).forEach(function(tr){
      tr.onclick=function(){ open(tr.dataset.id); };
    });
  }

  function exportCSV(){
    const rows=[['客戶','狀態','產業','來源','負責人','標籤','最近評估','合約總額','投入成本','損益','已收','未收','備註']];
    U.sortBy(Store.list('clients'),function(c){return c.name;}).forEach(function(c){
      const s=Store.clientSummary(c.id);
      rows.push([c.name,UI.lookup(UI.CLIENT_STATUS,c.status).l,c.industry||'',c.source||'',c.owner||'',
        (c.tags||[]).join(' '),s.latestAssessment?s.latestAssessment.total+'/'+UI.MAX_SCORE:'',
        s.contracted,s.cost,s.margin,s.received,s.outstanding,c.note||'']);
    });
    U.download('merito-clients-'+U.today()+'.csv','﻿'+U.toCSV(rows),'text/csv;charset=utf-8');
  }

  /* ───────── 新增／編輯客戶 ───────── */
  function editClient(c,afterSave){
    UI.form({
      title:c?'編輯客戶':'新增客戶',
      sub:c?'':'先建檔，之後的評估、專案、收款都可以掛在這個客戶下。',
      submitLabel:c?'儲存':'建立',
      fields:[
        {k:'name',label:'客戶／公司名稱',value:c&&c.name,required:true,placeholder:'例：讚美之泉'},
        {k:'status',label:'狀態',type:'select',options:UI.options(UI.CLIENT_STATUS),value:c?c.status:'lead'},
        {k:'industry',label:'產業',value:c&&c.industry,placeholder:'例：宗教非營利／電商'},
        {k:'source',label:'來源',value:c&&c.source,placeholder:'例：朋友介紹、官網詢問'},
        {k:'owner',label:'我方負責人',type:'select',options:UI.memberOptions(true),value:c&&c.owner},
        {k:'tags',label:'標籤',type:'tags',value:c&&c.tags,placeholder:'空白或逗號分隔，例：長期 高風險'},
        {k:'note',label:'備註',type:'textarea',value:c&&c.note,full:true,
          placeholder:'合作背景、特殊約定、要小心的地方'}
      ],
      onSubmit:function(v){
        const rec=Store.upsert('clients',Object.assign({},v,{id:c?c.id:undefined}));
        Store.logActivity(rec.id,'client',c?'資料更新':'建立客戶檔案');
        UI.toast(c?'已更新':'已新增客戶');
        if(afterSave) afterSave(rec);
      }
    });
  }

  /* ───────── 客戶檔案頁 ───────── */
  function renderDetail(el,c){
    const s=Store.clientSummary(c.id);
    const contacts=Store.ofClient('contacts',c.id);
    const quotes=U.sortBy(Store.ofClient('quotes',c.id),function(q){return q.date||'';},true);
    const lessons=U.sortBy(Store.ofClient('lessons',c.id),function(l){return l.date||'';},true);
    const acts=U.sortBy(Store.ofClient('activities',c.id),function(a){return a.at||'';},true).slice(0,15);

    el.innerHTML=
      '<button class="linkbtn" data-act="back">← 回客戶列表</button>'+
      '<div class="detail-head">'+
        '<div>'+
          '<h2>'+U.esc(c.name)+' '+UI.pill(UI.CLIENT_STATUS,c.status)+'</h2>'+
          '<div class="detail-meta">'+
            [c.industry,c.source&&('來源：'+c.source),c.owner&&('負責人：'+c.owner)]
              .filter(Boolean).map(U.esc).join(' · ')+
          '</div>'+
          '<div>'+(c.tags||[]).map(function(t){return '<span class="tag">'+U.esc(t)+'</span>';}).join('')+'</div>'+
        '</div>'+
        '<div class="btn-row">'+
          '<button class="act ghost sm" data-act="edit">編輯</button>'+
          '<button class="act ghost sm danger" data-act="del">刪除</button>'+
        '</div>'+
      '</div>'+
      (c.note?'<div class="infobox">'+U.escLines(c.note)+'</div>':'')+

      '<div class="mini-grid">'+
        mini('合約總額',U.money(s.contracted))+
        mini('投入成本',U.money(s.cost))+
        mini('損益',(s.contracted>0&&s.cost>0)
          ? '<span class="'+(s.margin<0?'neg':'pos')+'">'+U.money0(s.margin)+'</span>' : '—')+
        mini('已收 / 未收',U.money(s.received)+' / '+U.money(s.outstanding))+
        mini('最近評估',s.latestAssessment
          ? s.latestAssessment.total+'/'+UI.MAX_SCORE : '<span class="muted" style="font-size:15px">未評估</span>')+
      '</div>'+

      (s.overdue.length? '<div class="warnbox">有 '+s.overdue.length+' 筆逾期未收，合計 '+
        U.money0(s.overdueAmount)+'。最舊一筆到期日 '+
        U.dateStr(U.sortBy(s.overdue,function(x){return x.dueDate||'';})[0].dueDate)+'。</div>' : '')+

      /* 聯絡人 */
      '<h3 class="blk">聯絡人與決策鏈</h3>'+
      (contacts.length? contacts.map(function(ct){
        return '<div class="contact"><div>'+
          '<div class="cn">'+U.esc(ct.name)+(ct.decider==='yes'?' <span class="pill amber">可拍板</span>':'')+'</div>'+
          '<div class="cr">'+U.esc(ct.role||'—')+'</div>'+
          '<div class="cd">'+[ct.phone,ct.email].filter(Boolean).map(U.esc).join(' · ')+'</div>'+
          (ct.note?'<div class="cd">'+U.escLines(ct.note)+'</div>':'')+
        '</div><div class="btn-row">'+
          '<button class="linkbtn" data-act="edit-contact" data-id="'+U.esc(ct.id)+'">編輯</button>'+
          '<button class="linkbtn" data-act="del-contact" data-id="'+U.esc(ct.id)+'">刪除</button>'+
        '</div></div>';
      }).join('') : UI.emptyBox('還沒有聯絡人。決策鏈寫清楚，需求反覆時才知道要找誰。'))+
      '<div class="btn-row" style="margin-top:10px"><button class="act ghost sm" data-act="new-contact">＋ 新增聯絡人</button></div>'+

      /* 評估歷史 */
      '<h3 class="blk">評估歷史</h3>'+
      (s.assessments.length?
        '<div class="table-scroll"><table><thead><tr><th>日期</th><th>分數</th><th>判定</th><th>紅旗</th><th>評估人</th><th></th></tr></thead><tbody>'+
        s.assessments.map(function(a){
          const v=UI.verdictOf(a.total);
          return '<tr><td class="nowrap small">'+U.dateStr(a.date)+'</td>'+
            '<td class="num">'+a.total+'/'+UI.MAX_SCORE+'</td>'+
            '<td><span class="pill '+v.pill+'">'+U.esc(v.label)+'</span></td>'+
            '<td class="small" style="color:var(--seal)">'+U.esc((a.flags||[]).join('、')||'—')+'</td>'+
            '<td class="small muted">'+U.esc(a.by||'—')+'</td>'+
            '<td class="tight"><button class="linkbtn" data-act="del-assess" data-id="'+U.esc(a.id)+'">刪除</button></td></tr>';
        }).join('')+'</tbody></table></div>'
        : UI.emptyBox('還沒評估過這個客戶。'))+
      '<div class="btn-row" style="margin-top:10px"><button class="act ghost sm" data-act="go-assess">前往評估</button></div>'+

      /* 專案 */
      '<h3 class="blk">專案</h3>'+
      (s.projects.length?
        '<div class="table-scroll"><table><thead><tr><th>專案</th><th>階段</th><th>合約</th><th>成本</th><th>損益</th></tr></thead><tbody>'+
        s.projects.map(function(p){
          const e=Store.projectEconomics(p);
          return '<tr><td><strong>'+U.esc(p.name)+'</strong>'+
              (p.note?'<div class="small muted">'+U.esc(p.note)+'</div>':'')+'</td>'+
            '<td>'+UI.pill(UI.STAGES,p.stage)+'</td>'+
            '<td class="num">'+U.money(e.amount)+'</td>'+
            '<td class="num">'+U.money(e.cost)+'</td>'+
            '<td class="num '+(e.margin<0?'neg':'pos')+'">'+(e.hasBoth?U.money0(e.margin)+'（'+e.pct+'%）':'—')+'</td></tr>';
        }).join('')+'</tbody></table></div>'
        : UI.emptyBox('還沒有專案。'))+

      /* 需求異動 */
      '<h3 class="blk">需求異動</h3>'+
      (s.changes.length?
        '<div class="table-scroll"><table><thead><tr><th>日期</th><th>異動內容</th><th>工時</th><th>報價</th><th>狀態</th><th>確認</th></tr></thead><tbody>'+
        s.changes.map(function(ch){
          const st=UI.lookup(UI.CHANGE_STATUS,ch.status);
          return '<tr><td class="small muted nowrap">'+U.dateStr(ch.date)+'</td>'+
            '<td><strong>'+U.esc(ch.title)+'</strong>'+
              (ch.requestedBy?'<div class="small muted">'+U.esc(ch.requestedBy)+
                (ch.via?'（'+U.esc(ch.via)+'）':'')+'</div>':'')+'</td>'+
            '<td class="num">'+(U.num(ch.hours)||'—')+'</td>'+
            '<td class="num">'+(U.num(ch.amount)?U.money(ch.amount)
              :'<span class="muted">'+(ch.status==='pending'?'未報價':'不計費')+'</span>')+'</td>'+
            '<td><span class="pill '+st.pill+'">'+U.esc(st.l)+'</span></td>'+
            '<td class="small muted">'+(ch.confirmedAt?U.dateStr(ch.confirmedAt):'—')+'</td></tr>';
        }).join('')+'</tbody></table></div>'
        : UI.emptyBox('還沒有需求異動記錄。'))+
      '<div class="btn-row" style="margin-top:10px">'+
        '<button class="act ghost sm" data-act="new-change">＋ 記一筆異動</button>'+
        (s.changes.length? '<button class="act ghost sm" data-act="change-report">處理狀態回報</button>'+
          '<button class="act ghost sm" data-act="change-export">匯出 Excel</button>' : '')+
      '</div>'+
      (s.pendingChanges.length? '<div class="warnbox" style="margin-top:12px">有 '+
        s.pendingChanges.length+' 筆異動還沒結案（待評估或等客戶確認）。'+
        '做之前先確認，不然做完很難收錢。</div>' : '')+

      /* 報價與收款 */
      '<h3 class="blk">報價與收款</h3>'+
      (quotes.length?
        '<div class="table-scroll"><table><thead><tr><th>報價</th><th>金額</th><th>狀態</th><th>日期</th></tr></thead><tbody>'+
        quotes.map(function(q){
          return '<tr><td>'+U.esc(q.title)+'</td><td class="num">'+U.money(q.amount)+'</td>'+
            '<td>'+UI.pill(UI.QUOTE_STATUS,q.status)+'</td>'+
            '<td class="small muted nowrap">'+U.dateStr(q.date)+'</td></tr>';
        }).join('')+'</tbody></table></div>' : '')+
      (s.payments.length?
        '<div class="table-scroll" style="margin-top:12px"><table><thead><tr><th>款項</th><th>金額</th><th>到期</th><th>狀態</th></tr></thead><tbody>'+
        U.sortBy(s.payments,function(x){return x.dueDate||'';}).map(function(x){
          const d=U.daysFromToday(x.dueDate);
          const late=!x.paidDate && d!==null && d<0;
          return '<tr><td>'+U.esc(x.name)+'</td><td class="num">'+U.money(x.amount)+'</td>'+
            '<td class="small nowrap'+(late?' neg':'')+'">'+U.dateStr(x.dueDate)+'</td>'+
            '<td>'+(x.paidDate?'<span class="pill green">已收 '+U.dateStr(x.paidDate)+'</span>'
              :(late?'<span class="pill red">逾期 '+(-d)+' 天</span>':'<span class="pill grey">未收</span>'))+'</td></tr>';
        }).join('')+'</tbody></table></div>' : '')+
      (!quotes.length && !s.payments.length? UI.emptyBox('還沒有報價或收款記錄。') : '')+

      /* 經驗 */
      '<h3 class="blk">這個客戶的經驗</h3>'+
      (lessons.length? '<div class="lessons">'+lessons.map(function(l){
        return '<div class="lesson">'+
          '<div class="ctype">'+U.esc(l.type||'')+'　'+U.dateStr(l.date)+'</div>'+
          '<div class="block"><div class="bl">踩到的雷</div><div class="bt">'+(U.escLines(l.trap)||'—')+'</div></div>'+
          '<div class="block"><div class="bl">教訓／下次怎麼辦</div><div class="bt">'+(U.escLines(l.lesson)||'—')+'</div></div>'+
        '</div>';
      }).join('')+'</div>' : UI.emptyBox('還沒有記錄。'))+

      /* 動態 */
      '<h3 class="blk">動態記錄</h3>'+
      '<div class="btn-row" style="margin-bottom:10px">'+
        '<input class="search" id="actText" placeholder="記一筆：今天談了什麼、答應了什麼">'+
        '<button class="act sm" data-act="add-act">記錄</button>'+
      '</div>'+
      (acts.length? '<div class="feed">'+acts.map(function(a){
        return '<div class="item"><span class="when">'+U.esc(U.ago(a.at))+'</span> · '+U.escLines(a.text)+
          (a.updatedBy?' <span class="muted small">— '+U.esc(a.updatedBy)+'</span>':'')+'</div>';
      }).join('')+'</div>' : UI.emptyBox('還沒有動態。'));

    bindDetail(el,c);
  }

  function mini(k,v){
    return '<div class="mini"><div class="k">'+U.esc(k)+'</div><div class="v">'+v+'</div></div>';
  }

  function bindDetail(el,c){
    el.querySelector('[data-act="back"]').onclick=function(){ currentId=null; Main.render(); };
    el.querySelector('[data-act="edit"]').onclick=function(){ editClient(c); };
    el.querySelector('[data-act="del"]').onclick=function(){
      UI.confirm('刪除客戶','將刪除「'+c.name+'」的客戶檔案。相關的專案、收款、評估不會一併刪除，但會失去歸屬。確定嗎？',function(){
        Store.remove('clients',c.id);
        currentId=null;
        UI.toast('已刪除客戶');
      });
    };
    el.querySelector('[data-act="new-contact"]').onclick=function(){ editContact(null,c.id); };
    el.querySelector('[data-act="go-assess"]').onclick=function(){
      ViewAssess.startFor(c.id);
    };
    el.querySelector('[data-act="new-change"]').onclick=function(){
      ViewChanges.quickAdd(c.id,'');
    };
    const chRep=el.querySelector('[data-act="change-report"]');
    if(chRep) chRep.onclick=function(){
      UI.textModal('處理狀態回報 — '+c.name,'可直接貼進 LINE、Email 或週報。',
        UI.statusReport(Store.ofClient('changes',c.id),c.name));
    };
    const chExp=el.querySelector('[data-act="change-export"]');
    if(chExp) chExp.onclick=function(){ ViewChanges.exportFor(c.id); };
    U.$$('[data-act="edit-contact"]',el).forEach(function(b){
      b.onclick=function(){ editContact(Store.get('contacts',b.dataset.id),c.id); };
    });
    U.$$('[data-act="del-contact"]',el).forEach(function(b){
      b.onclick=function(){
        const ct=Store.get('contacts',b.dataset.id);
        UI.confirm('刪除聯絡人','確定刪除「'+(ct?ct.name:'')+'」？',function(){
          Store.remove('contacts',b.dataset.id); UI.toast('已刪除');
        });
      };
    });
    U.$$('[data-act="del-assess"]',el).forEach(function(b){
      b.onclick=function(){
        UI.confirm('刪除評估記錄','刪除後就看不到這次的分數與紅旗了。確定嗎？',function(){
          Store.remove('assessments',b.dataset.id); UI.toast('已刪除');
        });
      };
    });
    const input=el.querySelector('#actText');
    el.querySelector('[data-act="add-act"]').onclick=function(){
      const t=input.value.trim();
      if(!t){ input.focus(); return; }
      Store.upsert('activities',{clientId:c.id,kind:'note',text:t,at:U.nowISO()});
      UI.toast('已記錄');
    };
    input.onkeydown=function(e){ if(e.key==='Enter') el.querySelector('[data-act="add-act"]').click(); };
  }

  function editContact(ct,clientId){
    UI.form({
      title:ct?'編輯聯絡人':'新增聯絡人',
      submitLabel:ct?'儲存':'新增',
      fields:[
        {k:'name',label:'姓名',value:ct&&ct.name,required:true},
        {k:'role',label:'職稱／角色',value:ct&&ct.role,placeholder:'例：專案窗口、資訊主管'},
        {k:'decider',label:'能否拍板',type:'select',value:ct?ct.decider:'no',
          options:[{v:'no',l:'不能拍板（要往上報）'},{v:'yes',l:'可以拍板'}]},
        {k:'phone',label:'電話',value:ct&&ct.phone},
        {k:'email',label:'Email',value:ct&&ct.email},
        {k:'note',label:'備註',type:'textarea',value:ct&&ct.note,full:true,
          placeholder:'溝通習慣、地雷、偏好'}
      ],
      onSubmit:function(v){
        Store.upsert('contacts',Object.assign({clientId:clientId},v,{id:ct?ct.id:undefined}));
        Store.logActivity(clientId,'contact',(ct?'更新':'新增')+'聯絡人 '+v.name);
        UI.toast('已儲存');
      }
    });
  }

  return {render:render,open:open,editClient:editClient};
})();
