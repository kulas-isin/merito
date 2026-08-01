/* ═══ 04 需求異動 ═══
   接案最會失血的地方：客戶一句「順便改一下」，做完了沒人記得要收錢。
   這一頁的重點是三件事 —— 當下記下來、產生可以貼給客戶的確認訊息、
   確認之後金額自動併進專案損益。 */
const ViewChanges = (function(){

  let query='';
  let filterStatus='';
  let filterClient='';

  /* 從別頁「＋異動」進來時，直接帶好客戶與專案開表單 */
  function quickAdd(clientId,projectId){
    edit(null,{clientId:clientId,projectId:projectId});
  }

  function render(el){
    const all=Store.list('changes');
    const pending=all.filter(function(c){ return c.status==='pending'; });
    const waiting=all.filter(function(c){ return c.status==='quoted'; });
    const confirmedAmt=U.sum(all.filter(UI.changeCountsAsIncome),function(c){ return c.amount; });
    const absorbedHours=U.sum(all.filter(function(c){ return c.status==='absorbed'; }),function(c){ return c.hours; });

    el.innerHTML=
      '<h2 class="sect">Change Requests</h2>'+
      '<p class="lead">客戶說「順便改一下」的時候，先記這裡。報價、發確認訊息、追狀態都在這頁；'+
      '客戶確認後的金額會自動併進該專案的損益，不用再去改合約金額。</p>'+

      '<div class="kpis" style="margin-bottom:20px">'+
        '<div class="kpi'+(pending.length?' warn':'')+'"><div class="k">待評估</div>'+
          '<div class="v">'+pending.length+'</div><div class="s">還沒報價的新需求</div></div>'+
        '<div class="kpi'+(waiting.length?' warn':'')+'"><div class="k">等客戶確認</div>'+
          '<div class="v">'+waiting.length+'</div>'+
          '<div class="s">'+U.money0(U.sum(waiting,function(c){return c.amount;}))+' 待確認</div></div>'+
        '<div class="kpi good"><div class="k">已確認追加</div>'+
          '<div class="v">'+U.money0(confirmedAmt)+'</div><div class="s">已併入專案損益</div></div>'+
        '<div class="kpi'+(absorbedHours?' warn':'')+'"><div class="k">免費吸收</div>'+
          '<div class="v">'+(absorbedHours||0)+'<small> 小時</small></div>'+
          '<div class="s">沒收到錢的工</div></div>'+
      '</div>'+

      (waiting.length? '<div class="infobox">有 '+waiting.length+' 筆已報價還沒等到客戶回覆。'+
        '超過一週沒回的，用「發確認訊息」再催一次，避免做完才在吵。</div>' : '')+

      '<div class="row-between">'+
        '<div class="btn-row" style="flex:1">'+
          '<input class="search" id="chSearch" placeholder="搜尋異動內容／客戶／專案" value="'+U.esc(query)+'">'+
          '<select id="chStatus" style="font-family:inherit;font-size:14.5px;padding:9px 11px;border:1px solid var(--line);background:#fff;border-radius:2px">'+
            '<option value="">全部狀態</option>'+
            UI.CHANGE_STATUS.map(function(s){
              return '<option value="'+s.v+'"'+(filterStatus===s.v?' selected':'')+'>'+U.esc(s.l)+'</option>';
            }).join('')+
          '</select>'+
          '<select id="chClient" style="font-family:inherit;font-size:14.5px;padding:9px 11px;border:1px solid var(--line);background:#fff;border-radius:2px">'+
            '<option value="">全部客戶</option>'+
            UI.clientOptions().map(function(o){
              return '<option value="'+U.esc(o.v)+'"'+(filterClient===o.v?' selected':'')+'>'+U.esc(o.l)+'</option>';
            }).join('')+
          '</select>'+
        '</div>'+
        '<div class="btn-row">'+
          '<button class="act ghost sm" data-act="report">處理狀態回報</button>'+
          '<button class="act ghost sm" data-act="export">匯出 Excel</button>'+
          '<button class="act" data-act="new">＋ 記一筆異動</button>'+
        '</div>'+
      '</div>'+
      '<div id="changeList"></div>';

    el.querySelector('[data-act="new"]').onclick=function(){ edit(null); };
    el.querySelector('[data-act="export"]').onclick=function(){ exportCSV(filtered()); };
    el.querySelector('[data-act="report"]').onclick=function(){ report(filtered()); };
    const s=el.querySelector('#chSearch');
    s.oninput=function(){ query=s.value; paint(el); };
    el.querySelector('#chStatus').onchange=function(){ filterStatus=this.value; paint(el); };
    el.querySelector('#chClient').onchange=function(){ filterClient=this.value; paint(el); };
    paint(el);
  }

  function filtered(){
    return U.sortBy(Store.list('changes').filter(function(c){
      if(filterStatus && c.status!==filterStatus) return false;
      if(filterClient && c.clientId!==filterClient) return false;
      const proj=Store.get('projects',c.projectId);
      return U.matches([c.title,c.detail,c.requestedBy,c.note,
        Store.clientName(c.clientId),proj?proj.name:''].join(' '),query);
    }),function(c){ return c.date||''; },true);
  }

  function paint(el){
    const box=el.querySelector('#changeList');
    const rows=filtered();
    if(!rows.length){
      box.innerHTML=UI.emptyBox(query||filterStatus||filterClient
        ? '沒有符合的異動。' : '還沒有記錄。下次客戶開口加需求，當下就記一筆。');
      return;
    }
    box.innerHTML='<div class="table-scroll"><table><thead><tr>'+
      '<th>日期</th><th>異動內容</th><th>客戶／專案</th><th>工時</th><th>報價</th><th>狀態</th><th>確認</th><th></th>'+
      '</tr></thead><tbody>'+
      rows.map(function(c){
        const proj=Store.get('projects',c.projectId);
        const st=UI.lookup(UI.CHANGE_STATUS,c.status);
        const waiting=c.status==='quoted';
        const days=waiting? U.daysFromToday(c.date) : null;
        return '<tr>'+
          '<td class="small muted nowrap">'+U.dateStr(c.date)+'</td>'+
          '<td><strong>'+U.esc(c.title)+'</strong>'+
            (c.detail?'<div class="small muted">'+U.esc(c.detail)+'</div>':'')+
            (c.requestedBy?'<div class="small muted">提出：'+U.esc(c.requestedBy)+
              (c.via?'（'+U.esc(c.via)+'）':'')+'</div>':'')+'</td>'+
          '<td class="small">'+U.esc(Store.clientName(c.clientId))+
            (proj?'<div class="muted">'+U.esc(proj.name)+'</div>':'')+'</td>'+
          '<td class="num">'+(U.num(c.hours)||'—')+'</td>'+
          /* 「還沒報價」和「決定不收錢」是兩回事，別混在一起顯示 */
          '<td class="num">'+(U.num(c.amount)? U.money(c.amount)
            : '<span class="muted">'+(c.status==='pending'?'未報價':'不計費')+'</span>')+'</td>'+
          '<td><span class="pill '+st.pill+'">'+U.esc(st.l)+'</span>'+
            (waiting && days!==null && days<-7
              ? '<div class="small neg">已等 '+(-days)+' 天</div>' : '')+'</td>'+
          '<td class="small muted">'+(c.confirmedAt
            ? U.dateStr(c.confirmedAt)+(c.confirmedBy?'<div>'+U.esc(c.confirmedBy)+'</div>':'')
            : '—')+'</td>'+
          '<td class="tight">'+
            '<button class="linkbtn" data-act="msg" data-id="'+U.esc(c.id)+'">發確認訊息</button>'+
            (c.status==='quoted'
              ? '<button class="linkbtn" data-act="ok" data-id="'+U.esc(c.id)+'">標記已確認</button>' : '')+
            '<button class="linkbtn" data-act="edit" data-id="'+U.esc(c.id)+'">編輯</button>'+
            '<button class="linkbtn" data-act="del" data-id="'+U.esc(c.id)+'">刪除</button>'+
          '</td></tr>';
      }).join('')+
      '</tbody><tfoot><tr>'+
        '<th colspan="3">合計 '+rows.length+' 筆</th>'+
        '<th class="num">'+(U.sum(rows,function(c){return c.hours;})||'—')+'</th>'+
        '<th class="num">'+U.money(U.sum(rows,function(c){return c.amount;}))+'</th>'+
        '<th colspan="3"></th>'+
      '</tr></tfoot></table></div>';

    U.$$('[data-act="edit"]',box).forEach(function(b){
      b.onclick=function(){ edit(Store.get('changes',b.dataset.id)); };
    });
    U.$$('[data-act="msg"]',box).forEach(function(b){
      b.onclick=function(){ sendConfirm(Store.get('changes',b.dataset.id)); };
    });
    U.$$('[data-act="ok"]',box).forEach(function(b){
      b.onclick=function(){ markConfirmed(Store.get('changes',b.dataset.id)); };
    });
    U.$$('[data-act="del"]',box).forEach(function(b){
      b.onclick=function(){
        const c=Store.get('changes',b.dataset.id);
        UI.confirm('刪除異動記錄','確定刪除「'+(c?c.title:'')+'」？',function(){
          Store.remove('changes',b.dataset.id); UI.toast('已刪除');
        });
      };
    });
  }

  function edit(c,preset){
    preset=preset||{};
    UI.form({
      title:c?'編輯需求異動':'記一筆需求異動',
      sub:c?'':'趁記憶還新的時候記。誰講的、在哪講的，日後爭議時就是證據。',
      submitLabel:c?'儲存':'記下來',
      fields:[
        {k:'title',label:'異動內容（一句話）',value:c&&c.title,required:true,full:true,
          placeholder:'例：首頁加輪播區塊，要能後台自己換'},
        {k:'clientId',label:'客戶',type:'select',options:UI.clientOptions(true),
          value:c?c.clientId:preset.clientId},
        {k:'projectId',label:'專案',type:'select',options:UI.projectOptions(null,true),
          value:c?c.projectId:preset.projectId},
        {k:'date',label:'提出日期',type:'date',value:c?c.date:U.today()},
        {k:'requestedBy',label:'誰提的',value:c&&c.requestedBy,placeholder:'例：王先生'},
        {k:'via',label:'從哪來的',type:'select',options:UI.CHANGE_VIA,value:c&&c.via},
        {k:'status',label:'處理狀態',type:'select',options:UI.options(UI.CHANGE_STATUS),
          value:c?c.status:'pending'},
        {k:'hours',label:'預估追加工時',type:'number',value:c&&c.hours,placeholder:'8'},
        {k:'amount',label:'報價金額（留空 = 不計費）',type:'number',value:c&&c.amount,placeholder:'8000'},
        {k:'impact',label:'對時程的影響',value:c&&c.impact,full:true,placeholder:'例：驗收日往後推一週'},
        {k:'detail',label:'細節說明',type:'textarea',value:c&&c.detail,full:true,
          placeholder:'對方原話、範圍到哪為止、不包含什麼'},
        {k:'note',label:'內部備註（不會出現在給客戶的訊息裡）',type:'textarea',rows:2,
          value:c&&c.note,full:true,placeholder:'例：這已經是第四次改首頁了'}
      ],
      onSubmit:function(v){
        const rec=Store.upsert('changes',Object.assign({},v,{id:c?c.id:undefined}));
        if(rec.clientId){
          Store.logActivity(rec.clientId,'change',
            (c?'更新':'新增')+'需求異動「'+rec.title+'」'+
            (U.num(rec.amount)?'（報價 '+U.money0(rec.amount)+'）':'（不計費）'));
        }
        UI.toast('已儲存');
        if(!c && !preset.skipPrompt && rec.status==='pending')
          setTimeout(function(){ UI.toast('記得報價後發確認訊息給客戶'); },600);
      }
    });
  }

  /* 產生確認訊息；如果還沒報價，順手把狀態推進到「已報價待確認」 */
  function sendConfirm(c){
    if(!c) return;
    UI.textModal('確認訊息 — '+c.title,
      '複製後貼給客戶。對方回一句「確認」就有依據了。',
      UI.confirmText(c));
    if(c.status==='pending'){
      Store.upsert('changes',{id:c.id,status:'quoted'});
      UI.toast('狀態已改為「已報價待確認」');
    }
  }

  function markConfirmed(c){
    if(!c) return;
    UI.form({
      title:'標記客戶已確認',
      sub:'記下是誰、在哪裡確認的。這是之後請款的依據。',
      submitLabel:'確認',
      fields:[
        {k:'confirmedAt',label:'確認日期',type:'date',value:U.today(),required:true},
        {k:'confirmedBy',label:'誰確認的',value:c.requestedBy||'',placeholder:'例：王先生'},
        {k:'confirmVia',label:'在哪裡確認的',type:'select',options:UI.CHANGE_VIA,value:c.via||'LINE'}
      ],
      onSubmit:function(v){
        Store.upsert('changes',Object.assign({id:c.id,status:'confirmed'},v));
        if(c.clientId) Store.logActivity(c.clientId,'change',
          '客戶確認異動「'+c.title+'」'+(U.num(c.amount)?'，追加 '+U.money0(c.amount):''));
        UI.toast(U.num(c.amount)? '已確認，金額已併入專案損益' : '已確認');
      }
    });
  }

  function report(rows){
    if(!rows.length){ UI.toast('目前的篩選條件下沒有資料',true); return; }
    /* 篩選只選一個客戶時，標題帶上客戶名，貼給客戶比較清楚 */
    const names={};
    rows.forEach(function(c){ names[Store.clientName(c.clientId)]=true; });
    const keys=Object.keys(names);
    UI.textModal('處理狀態回報',
      '依狀態分組，可直接貼進 LINE、Email 或週報。',
      UI.statusReport(rows,keys.length===1?keys[0]:''));
  }

  function exportCSV(rows){
    const head=['日期','異動內容','客戶','專案','誰提的','管道','狀態','預估工時','報價金額',
      '對時程影響','確認日期','確認人','確認管道','細節','內部備註','建立者'];
    const body=rows.map(function(c){
      const p=Store.get('projects',c.projectId);
      return [c.date||'',c.title||'',Store.clientName(c.clientId),p?p.name:'',
        c.requestedBy||'',c.via||'',UI.lookup(UI.CHANGE_STATUS,c.status).l,
        U.num(c.hours)||'',U.num(c.amount)||'',c.impact||'',
        c.confirmedAt||'',c.confirmedBy||'',c.confirmVia||'',
        c.detail||'',c.note||'',c.updatedBy||''];
    });
    /* 開頭的 BOM 是給 Excel 認 UTF-8 用的，沒有的話中文會變亂碼。
       檔名一律用英數：Chromium 遇到非 ASCII 檔名會整個丟掉，
       下載下來會變成沒有副檔名的 "download"，Excel 就認不出來了。 */
    U.download('merito-changes-'+U.today()+'.csv','﻿'+U.toCSV([head].concat(body)),
      'text/csv;charset=utf-8');
    UI.toast('已匯出 '+rows.length+' 筆，可直接用 Excel 開');
  }

  /* 給客戶檔案頁用：只匯出這個客戶的異動 */
  function exportFor(clientId){
    const rows=U.sortBy(Store.ofClient('changes',clientId),function(c){return c.date||'';},true);
    if(!rows.length){ UI.toast('這個客戶還沒有異動記錄',true); return; }
    exportCSV(rows);
  }

  return {render:render,quickAdd:quickAdd,edit:edit,exportFor:exportFor};
})();
