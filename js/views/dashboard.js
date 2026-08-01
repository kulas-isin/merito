/* ═══ 00 儀表板 ═══ */
const ViewDashboard = (function(){

  function render(el){
    const clients=Store.list('clients');
    const projects=Store.list('projects');
    const payments=Store.list('payments');
    const quotes=Store.list('quotes');

    const active=clients.filter(function(c){ return c.status==='active'; });
    const running=projects.filter(function(p){ return p.stage!=='done'; });

    const contracted=U.sum(projects,function(p){return p.amount;});
    const cost=U.sum(projects,function(p){return U.num(p.hours)*U.num(p.rate);});
    const margin=contracted-cost;
    const marginPct=contracted>0? Math.round(margin/contracted*100) : null;

    const unpaid=payments.filter(function(x){ return !x.paidDate; });
    const received=U.sum(payments.filter(function(x){return x.paidDate;}),function(x){return x.amount;});
    const outstanding=U.sum(unpaid,function(x){return x.amount;});
    const overdue=unpaid.filter(function(x){ return x.dueDate && U.daysFromToday(x.dueDate)<0; });
    const overdueAmt=U.sum(overdue,function(x){return x.amount;});

    const openQuotes=quotes.filter(function(q){ return q.status==='sent'; });

    const changes=Store.list('changes');
    const chPending=changes.filter(function(c){ return c.status==='pending'; });
    const chWaiting=changes.filter(function(c){ return c.status==='quoted'; });
    const chAbsorbed=U.sum(changes.filter(function(c){ return c.status==='absorbed'; }),
      function(c){ return c.hours; });

    /* 燒錢中的專案：有合約也有投入、且已經虧 */
    const bleeding=U.sortBy(projects.map(function(p){
      return Object.assign({p:p},Store.projectEconomics(p));
    }).filter(function(x){ return x.hasBoth && x.margin<0; }),function(x){return x.margin;});

    /* 高風險客戶：最近一次評估 < 18 */
    const risky=clients.map(function(c){
      const a=U.sortBy(Store.ofClient('assessments',c.id),function(x){return x.date||'';},true)[0];
      return a? {c:c,a:a} : null;
    }).filter(function(x){ return x && x.a.total<18; });

    el.innerHTML=
      '<h2 class="sect">Dashboard</h2>'+
      '<p class="lead">全公司客戶與案子的體檢表。哪些在燒錢、哪些錢沒收到、哪些客戶該提防，都在這一頁。</p>'+

      '<div class="kpis">'+
        kpi('客戶',clients.length,'合作中 '+active.length+' · 潛在 '+clients.filter(function(c){return c.status==='lead';}).length)+
        kpi('進行中專案',running.length,'總專案 '+projects.length)+
        kpi('合約總額',U.money0(contracted),'投入成本 '+U.money0(cost))+
        kpi('整體損益',(margin>=0?'+':'')+U.money0(margin),
            marginPct==null?'尚無資料':'毛利率 '+marginPct+'%',margin<0?'warn':'good')+
        kpi('未收款',U.money0(outstanding),'已收 '+U.money0(received))+
        kpi('逾期未收',U.money0(overdueAmt),overdue.length+' 筆逾期',overdueAmt>0?'warn':'')+
      '</div>'+

      (openQuotes.length? '<div class="infobox">有 '+openQuotes.length+' 張報價單已送出還沒回覆，合計 '+
        U.money0(U.sum(openQuotes,function(q){return q.amount;}))+' — 記得追。</div>' : '')+

      (chPending.length||chWaiting.length||chAbsorbed
        ? '<div class="infobox">需求異動：'+
          [chPending.length? chPending.length+' 筆待評估報價':'',
           chWaiting.length? chWaiting.length+' 筆等客戶確認（'+
             U.money0(U.sum(chWaiting,function(c){return c.amount;}))+'）':'',
           chAbsorbed? '已免費吸收 '+chAbsorbed+' 小時':''
          ].filter(Boolean).join('　·　')+
          '　<button class="linkbtn" data-act="go-changes" style="font-size:13px">前往處理 →</button></div>'
        : '')+

      '<div class="two-col">'+
        '<div>'+
          '<h3 class="blk">燒錢中的專案</h3>'+
          (bleeding.length?
            '<div class="table-scroll"><table><thead><tr><th>專案</th><th>客戶</th><th>合約</th><th>成本</th><th>損益</th></tr></thead><tbody>'+
            bleeding.slice(0,8).map(function(x){
              return '<tr><td><strong>'+U.esc(x.p.name)+'</strong></td>'+
                '<td class="small muted">'+U.esc(Store.clientName(x.p.clientId))+'</td>'+
                '<td class="num">'+U.money(x.effective)+
                  (x.added? '<div class="small muted">含異動 +'+U.money0(x.added)+'</div>':'')+'</td>'+
                '<td class="num">'+U.money(x.cost)+'</td>'+
                '<td class="num neg">'+U.money0(x.margin)+'（'+x.pct+'%）</td></tr>';
            }).join('')+'</tbody></table></div>'
            : UI.emptyBox('目前沒有虧本的專案。'))+

          '<h3 class="blk">高風險客戶（評估 < 18）</h3>'+
          (risky.length?
            '<div class="table-scroll"><table><thead><tr><th>客戶</th><th>分數</th><th>評估日</th><th>主要紅旗</th></tr></thead><tbody>'+
            U.sortBy(risky,function(x){return x.a.total;}).map(function(x){
              const v=UI.verdictOf(x.a.total);
              return '<tr><td><strong>'+U.esc(x.c.name)+'</strong></td>'+
                '<td class="num">'+x.a.total+'/'+UI.MAX_SCORE+' '+UI.pill([{v:v.key,l:v.label,pill:v.pill}],v.key)+'</td>'+
                '<td class="small muted nowrap">'+U.dateStr(x.a.date)+'</td>'+
                '<td class="small" style="color:var(--seal)">'+U.esc((x.a.flags||[]).slice(0,2).join('、')||'—')+'</td></tr>';
            }).join('')+'</tbody></table></div>'
            : UI.emptyBox('沒有低分客戶，或還沒做過評估。'))+
        '</div>'+

        '<div>'+
          '<h3 class="blk">收款提醒</h3>'+
          renderPayments(unpaid)+
          '<h3 class="blk">最近動態</h3>'+
          renderFeed()+
        '</div>'+
      '</div>';

    const goCh=el.querySelector('[data-act="go-changes"]');
    if(goCh) goCh.onclick=function(){ Main.go('changes'); };
  }

  function kpi(k,v,s,cls){
    return '<div class="kpi'+(cls?' '+cls:'')+'"><div class="k">'+U.esc(k)+'</div>'+
      '<div class="v">'+U.esc(String(v))+'</div>'+
      '<div class="s">'+U.esc(s||'')+'</div></div>';
  }

  function renderPayments(unpaid){
    /* 逾期的排最前，接著是 30 天內到期的 */
    const rows=unpaid.map(function(x){
      return {x:x,d:U.daysFromToday(x.dueDate)};
    }).filter(function(r){ return r.d!==null && r.d<=30; });
    if(!rows.length) return UI.emptyBox('30 天內沒有待收款項。');
    return '<div class="table-scroll"><table><thead><tr><th>款項</th><th>客戶</th><th>金額</th><th>到期</th></tr></thead><tbody>'+
      U.sortBy(rows,function(r){return r.d;}).map(function(r){
        const late=r.d<0;
        return '<tr><td>'+U.esc(r.x.name)+'</td>'+
          '<td class="small muted">'+U.esc(Store.clientName(r.x.clientId))+'</td>'+
          '<td class="num">'+U.money(r.x.amount)+'</td>'+
          '<td class="small nowrap '+(late?'neg':'')+'">'+U.dateStr(r.x.dueDate)+
            '<br><span class="mono" style="font-size:11px">'+(late?'逾期 '+(-r.d)+' 天':r.d+' 天後')+'</span></td></tr>';
      }).join('')+'</tbody></table></div>';
  }

  function renderFeed(){
    const acts=U.sortBy(Store.list('activities'),function(a){return a.at||'';},true).slice(0,12);
    if(!acts.length) return UI.emptyBox('還沒有動態。新增客戶、評估或收款後會出現在這裡。');
    return '<div class="feed">'+acts.map(function(a){
      return '<div class="item"><span class="when">'+U.esc(U.ago(a.at))+'</span> · '+
        '<strong>'+U.esc(Store.clientName(a.clientId))+'</strong> '+U.esc(a.text)+
        (a.updatedBy?' <span class="muted small">— '+U.esc(a.updatedBy)+'</span>':'')+'</div>';
    }).join('')+'</div>';
  }

  return {render:render};
})();
