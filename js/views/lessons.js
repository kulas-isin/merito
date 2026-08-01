/* ═══ 05 經驗記錄 ═══ */
const ViewLessons = (function(){

  let query='';
  let filterType='';

  function render(el){
    el.innerHTML=
      '<h2 class="sect">Lessons Archive</h2>'+
      '<p class="lead">每個客戶踩過的雷、換來的教訓。下次遇到同類型，先翻這裡 —— 這是團隊的共同記憶，不是誰的私人筆記。</p>'+
      '<div class="row-between">'+
        '<div class="btn-row" style="flex:1">'+
          '<input class="search" id="lSearch" placeholder="搜尋客戶／雷點／教訓／標籤" value="'+U.esc(query)+'">'+
          '<select id="lType" style="font-family:inherit;font-size:14.5px;padding:9px 11px;border:1px solid var(--line);background:#fff;border-radius:2px">'+
            '<option value="">全部類型</option>'+
            UI.LESSON_TYPES.map(function(t){
              return '<option value="'+U.esc(t)+'"'+(filterType===t?' selected':'')+'>'+U.esc(t)+'</option>';
            }).join('')+
          '</select>'+
        '</div>'+
        '<button class="act" data-act="new">＋ 存入經驗</button>'+
      '</div>'+
      '<div id="lessonList"></div>';

    el.querySelector('[data-act="new"]').onclick=function(){ edit(null); };
    const s=el.querySelector('#lSearch');
    s.oninput=function(){ query=s.value; paint(el); };
    el.querySelector('#lType').onchange=function(){ filterType=this.value; paint(el); };
    paint(el);
  }

  function paint(el){
    const box=el.querySelector('#lessonList');
    const rows=U.sortBy(Store.list('lessons').filter(function(l){
      if(filterType && l.type!==filterType) return false;
      return U.matches([Store.clientName(l.clientId),l.type,l.trap,l.lesson,(l.tags||[]).join(' ')].join(' '),query);
    }),function(l){return l.date||'';},true);

    if(!rows.length){
      box.innerHTML=UI.emptyBox(query||filterType?'沒有符合的記錄。':'尚無經驗記錄。把這次的痛，變成下次的判斷力。');
      return;
    }

    box.innerHTML='<div class="lessons">'+rows.map(function(l){
      return '<div class="lesson">'+
        '<div class="lact btn-row">'+
          '<button class="linkbtn" data-act="edit" data-id="'+U.esc(l.id)+'">編輯</button>'+
          '<button class="linkbtn" data-act="del" data-id="'+U.esc(l.id)+'">刪除</button>'+
        '</div>'+
        '<h4>'+U.esc(Store.clientName(l.clientId))+'</h4>'+
        '<div class="ctype">'+U.esc(l.type||'未分類')+'　'+U.dateStr(l.date)+
          (l.by?'　by '+U.esc(l.by):'')+'</div>'+
        '<div class="block"><div class="bl">踩到的雷</div><div class="bt">'+(U.escLines(l.trap)||'—')+'</div></div>'+
        '<div class="block"><div class="bl">教訓／下次怎麼辦</div><div class="bt">'+(U.escLines(l.lesson)||'—')+'</div></div>'+
        ((l.tags||[]).length? '<div style="margin-top:10px">'+l.tags.map(function(t){
          return '<span class="tag">'+U.esc(t)+'</span>';
        }).join('')+'</div>' : '')+
      '</div>';
    }).join('')+'</div>';

    U.$$('[data-act="edit"]',box).forEach(function(b){
      b.onclick=function(){ edit(Store.get('lessons',b.dataset.id)); };
    });
    U.$$('[data-act="del"]',box).forEach(function(b){
      b.onclick=function(){
        UI.confirm('刪除經驗記錄','刪掉就沒了，確定嗎？',function(){
          Store.remove('lessons',b.dataset.id); UI.toast('已刪除');
        });
      };
    });
  }

  function edit(l){
    UI.form({
      title:l?'編輯經驗':'存入經驗',
      sub:l?'':'寫給三個月後的自己，還有還沒踩過這個雷的同事。',
      submitLabel:'儲存',
      fields:[
        {k:'clientId',label:'客戶',type:'select',options:UI.clientOptions(true),value:l&&l.clientId},
        {k:'type',label:'客戶類型',type:'select',options:UI.LESSON_TYPES,value:l&&l.type},
        {k:'date',label:'記錄日期',type:'date',value:l?l.date:U.today()},
        {k:'tags',label:'標籤',type:'tags',value:l&&l.tags,placeholder:'例：需求膨脹 免費支援'},
        {k:'trap',label:'踩到的雷',type:'textarea',rows:3,value:l&&l.trap,full:true,
          placeholder:'例：需求驗收後持續追加、免費幫忙被視為理所當然、想拿完整程式碼自己接手'},
        {k:'lesson',label:'學到的教訓／下次怎麼辦',type:'textarea',rows:3,value:l&&l.lesson,full:true,
          placeholder:'例：開案前寫需求變更條款；商務界線一開始就交業務；客戶有工程能力考慮只出 UI'}
      ],
      onSubmit:function(v){
        const rec=Store.upsert('lessons',Object.assign({},v,{
          id:l?l.id:undefined,
          by:l?l.by:(Store.state.cfg.me||'（未署名）')
        }));
        if(rec.clientId) Store.logActivity(rec.clientId,'lesson',(l?'更新':'新增')+'一則經驗記錄');
        UI.toast('已儲存');
      }
    });
  }

  return {render:render};
})();
