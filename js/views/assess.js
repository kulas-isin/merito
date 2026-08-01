/* ═══ 02 接案評估 ═══ */
const ViewAssess = (function(){

  let scores=new Array(UI.CRITERIA.length).fill(0);
  let clientId='';
  let newName='';
  let note='';

  function reset(){
    scores=new Array(UI.CRITERIA.length).fill(0);
    clientId=''; newName=''; note='';
  }

  /* 從客戶檔案頁「前往評估」進來 */
  function startFor(id){
    reset(); clientId=id;
    Main.go('assess');
  }

  function total(){ return scores.reduce(function(a,b){return a+b;},0); }
  function answered(){ return scores.filter(function(s){return s>0;}).length; }
  function flags(){
    return scores.map(function(s,i){ return (s>0&&s<=2)? UI.CRITERIA[i].flag : null; }).filter(Boolean);
  }

  function render(el){
    const done=answered()===UI.CRITERIA.length;
    const t=total();
    const v=UI.verdictOf(t);

    el.innerHTML=
      '<h2 class="sect">Pre-engagement Assessment</h2>'+
      '<p class="lead">接案前，逐項評分（1 = 差／高風險，5 = 好）。系統即時算出 Merito 分數與建議，並標出伸手牌警訊。存檔後會記進該客戶的評估歷史，之後可以比對前後變化。</p>'+

      '<div class="panel" style="margin-bottom:18px">'+
        '<div class="field-row">'+
          '<div class="field"><label>評估對象</label>'+
            '<select id="aClient">'+
              '<option value="">＋ 新客戶（下方填名稱）</option>'+
              UI.clientOptions().map(function(o){
                return '<option value="'+U.esc(o.v)+'"'+(o.v===clientId?' selected':'')+'>'+U.esc(o.l)+'</option>';
              }).join('')+
            '</select></div>'+
          '<div class="field"><label>新客戶名稱</label>'+
            '<input id="aName" value="'+U.esc(newName)+'" placeholder="選了既有客戶就不用填"'+(clientId?' disabled':'')+'></div>'+
        '</div>'+
      '</div>'+

      '<div class="assess-grid" id="critGrid">'+
        UI.CRITERIA.map(function(c,i){
          return '<div class="crit">'+
            '<div class="q">'+U.esc(c.q)+'</div>'+
            '<div class="scale" data-i="'+i+'">'+
              [1,2,3,4,5].map(function(s){
                const sel=scores[i]===s;
                return '<button type="button" data-s="'+s+'" class="'+(sel?'sel'+(s<=2?' risk':''):'')+'">'+s+'</button>';
              }).join('')+
            '</div>'+
            '<div class="hint">'+U.esc(c.hint)+'</div>'+
          '</div>';
        }).join('')+
      '</div>'+

      '<div class="verdict">'+
        '<div class="score-badge">'+
          '<div class="score-num">'+(answered()? t : '—')+'</div>'+
          '<div class="score-max">/ '+UI.MAX_SCORE+'</div>'+
        '</div>'+
        '<div class="verdict-body">'+
          (done
            ? '<span class="label '+v.key+'">'+U.esc(v.label)+'</span><h3>'+U.esc(v.title)+'</h3><p>'+U.esc(v.desc)+'</p>'
            : '<span class="label">已評 '+answered()+'/'+UI.CRITERIA.length+'</span>'+
              '<h3>'+(answered()?'繼續評分':'開始逐項評分')+'</h3>'+
              '<p>'+(answered()?'全部評完後給出建議。':'每一項都是接案前的真實提問。誠實打分，比事後後悔便宜。')+'</p>')+
          '<div class="flags">'+flags().map(function(f){
            return '<div class="flag">'+U.esc(f)+'</div>';
          }).join('')+'</div>'+
        '</div>'+
      '</div>'+

      '<div class="panel" style="margin-top:20px">'+
        '<div class="field"><label>這次評估的補充說明</label>'+
          '<textarea id="aNote" rows="2" placeholder="例：老闆自己是工程師；預算卡在 60 萬但想要 App＋後台">'+U.esc(note)+'</textarea></div>'+
        '<div class="btn-row" style="margin-top:14px">'+
          '<button class="act" data-act="save">存入評估歷史</button>'+
          '<button class="act ghost" data-act="reset">重新評分</button>'+
        '</div>'+
      '</div>'+

      renderHistory();

    bind(el);
  }

  function renderHistory(){
    const all=U.sortBy(Store.list('assessments'),function(a){return a.date||'';},true).slice(0,20);
    if(!all.length) return '';
    return '<h3 class="blk">最近的評估</h3>'+
      '<div class="table-scroll"><table><thead><tr><th>客戶</th><th>日期</th><th>分數</th><th>判定</th><th>紅旗</th><th>評估人</th></tr></thead><tbody>'+
      all.map(function(a){
        const v=UI.verdictOf(a.total);
        return '<tr><td><strong>'+U.esc(Store.clientName(a.clientId))+'</strong></td>'+
          '<td class="small muted nowrap">'+U.dateStr(a.date)+'</td>'+
          '<td class="num">'+a.total+'/'+UI.MAX_SCORE+'</td>'+
          '<td><span class="pill '+v.pill+'">'+U.esc(v.label)+'</span></td>'+
          '<td class="small" style="color:var(--seal)">'+U.esc((a.flags||[]).join('、')||'—')+'</td>'+
          '<td class="small muted">'+U.esc(a.by||'—')+'</td></tr>';
      }).join('')+'</tbody></table></div>';
  }

  function bind(el){
    const sel=el.querySelector('#aClient');
    const nameInput=el.querySelector('#aName');
    sel.onchange=function(){
      clientId=sel.value;
      nameInput.disabled=!!clientId;
      if(clientId) nameInput.value='';
    };
    nameInput.oninput=function(){ newName=nameInput.value; };
    const noteEl=el.querySelector('#aNote');
    noteEl.oninput=function(){ note=noteEl.value; };

    U.$$('#critGrid .scale',el).forEach(function(scale){
      const i=+scale.dataset.i;
      U.$$('button',scale).forEach(function(btn){
        btn.onclick=function(){
          scores[i]=+btn.dataset.s;
          Main.render();   /* 重繪以更新分數與紅旗 */
        };
      });
    });

    el.querySelector('[data-act="reset"]').onclick=function(){ reset(); Main.render(); };
    el.querySelector('[data-act="save"]').onclick=save;
  }

  function save(){
    if(answered()<UI.CRITERIA.length){ UI.toast('請先完成所有評分項目',true); return; }
    let cid=clientId;
    if(!cid){
      const n=newName.trim();
      if(!n){ UI.toast('請選擇客戶或填新客戶名稱',true); return; }
      const existing=Store.findClientByName(n);
      cid = existing ? existing.id : Store.upsert('clients',{name:n,status:'lead'},true).id;
    }
    const t=total();
    const v=UI.verdictOf(t);
    Store.upsert('assessments',{
      clientId:cid,date:U.today(),scores:scores.slice(),total:t,
      verdict:v.key,flags:flags(),note:note.trim(),
      by:Store.state.cfg.me||'（未署名）'
    });
    Store.logActivity(cid,'assess','完成評估 '+t+'/'+UI.MAX_SCORE+'（'+v.label+'）');
    UI.toast('已存入評估歷史');
    const target=cid;
    reset();
    ViewClients.open(target);
  }

  return {render:render,startFor:startFor};
})();
