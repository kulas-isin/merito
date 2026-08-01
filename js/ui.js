/* ═══ Merito · UI 元件與領域常數 ═══ */
const UI = (function(){

  /* ── Toast ── */
  function toast(msg,isErr){
    const wrap=document.getElementById('toastWrap');
    const el=document.createElement('div');
    el.className='toast'+(isErr?' err':'');
    el.textContent=msg;
    wrap.appendChild(el);
    setTimeout(function(){ el.remove(); }, isErr?5200:2600);
  }

  /* ── Modal ── */
  let onEsc=null;
  function closeModal(){
    document.getElementById('modalBack').hidden=true;
    document.getElementById('modal').innerHTML='';
    if(onEsc){ document.removeEventListener('keydown',onEsc); onEsc=null; }
  }
  function openModal(html){
    const back=document.getElementById('modalBack');
    const box=document.getElementById('modal');
    box.innerHTML=html;
    back.hidden=false;
    onEsc=function(e){ if(e.key==='Escape') closeModal(); };
    document.addEventListener('keydown',onEsc);
    back.onclick=function(e){ if(e.target===back) closeModal(); };
    const first=box.querySelector('input,select,textarea');
    if(first) setTimeout(function(){ first.focus(); },30);
    return box;
  }

  /* ── 表單 modal ──
     fields: [{k,label,type,value,options,placeholder,help,required,full}]
     type: text | number | date | select | textarea | tags
     onSubmit(values) 回傳 false 可阻止關閉 */
  function form(opts){
    const fields=opts.fields||[];
    const rows=[];
    let buffer=[];
    fields.forEach(function(f){
      const html=fieldHTML(f);
      if(f.full){
        if(buffer.length){ rows.push(buffer); buffer=[]; }
        rows.push([html]);
      }else{
        buffer.push(html);
        if(buffer.length===2){ rows.push(buffer); buffer=[]; }
      }
    });
    if(buffer.length) rows.push(buffer);

    const box=openModal(
      '<h3>'+U.esc(opts.title||'')+'</h3>'+
      (opts.sub?'<div class="msub">'+U.esc(opts.sub)+'</div>':'')+
      '<form id="mForm">'+
        rows.map(function(r){ return '<div class="field-row">'+r.join('')+'</div>'; }).join('')+
        '<div class="btn-row">'+
          (opts.extra||'')+
          '<button type="button" class="act ghost" data-act="cancel">取消</button>'+
          '<button type="submit" class="act">'+U.esc(opts.submitLabel||'儲存')+'</button>'+
        '</div>'+
      '</form>');

    box.querySelector('[data-act="cancel"]').onclick=closeModal;
    box.querySelector('#mForm').onsubmit=function(e){
      e.preventDefault();
      const values={};
      let bad=null;
      fields.forEach(function(f){
        const el=box.querySelector('[name="'+f.k+'"]');
        if(!el) return;
        let v=el.value;
        if(f.type==='tags') v=U.parseTags(v);
        else v=String(v).trim();
        if(f.required && (f.type==='tags'? !v.length : !v) && !bad) bad=el;
        values[f.k]=v;
      });
      if(bad){ bad.focus(); toast('必填欄位還沒填',true); return; }
      if(opts.onSubmit(values)!==false) closeModal();
    };
    return box;
  }

  function fieldHTML(f){
    const name=U.esc(f.k);
    const val=f.value==null?'':(Array.isArray(f.value)?f.value.join(' '):f.value);
    let input;
    if(f.type==='select'){
      input='<select name="'+name+'">'+(f.options||[]).map(function(o){
        const ov=(o.v!==undefined?o.v:o), ol=(o.l!==undefined?o.l:o);
        return '<option value="'+U.esc(ov)+'"'+(String(ov)===String(val)?' selected':'')+'>'+U.esc(ol)+'</option>';
      }).join('')+'</select>';
    }else if(f.type==='textarea'){
      input='<textarea name="'+name+'" rows="'+(f.rows||3)+'" placeholder="'+U.esc(f.placeholder||'')+'">'+U.esc(val)+'</textarea>';
    }else{
      const t=(f.type==='number'||f.type==='date')?f.type:'text';
      input='<input name="'+name+'" type="'+t+'"'+(t==='number'?' step="any"':'')+
        ' value="'+U.esc(val)+'" placeholder="'+U.esc(f.placeholder||'')+'">';
    }
    return '<div class="field"><label>'+U.esc(f.label)+(f.required?' *':'')+'</label>'+input+
      (f.help?'<div class="help">'+U.esc(f.help)+'</div>':'')+'</div>';
  }

  /* ── 確認框 ── */
  function confirm(title,msg,onYes,yesLabel){
    const box=openModal(
      '<h3>'+U.esc(title)+'</h3>'+
      '<div class="msub">'+U.esc(msg)+'</div>'+
      '<div class="btn-row">'+
        '<button class="act ghost" data-act="no">取消</button>'+
        '<button class="act" data-act="yes">'+U.esc(yesLabel||'確定刪除')+'</button>'+
      '</div>');
    box.querySelector('[data-act="no"]').onclick=closeModal;
    box.querySelector('[data-act="yes"]').onclick=function(){ closeModal(); onYes(); };
  }

  /* ── 領域常數 ── */
  const CRITERIA=[
    {q:"預算 vs 工作量是否成比例？",hint:"低價想做大量 = 從一開始就注定虧",flag:"預算與工作量不成比例"},
    {q:"需求清晰度",hint:"需求模糊、「做了再說」= 未來會無限膨脹",flag:"需求模糊，易膨脹"},
    {q:"是否為第一次外包（沒換過團隊）？",hint:"換過開發團隊 = 難搞前科",flag:"曾換過團隊，高風險"},
    {q:"決策鏈是否穩定？",hint:"窗口不能拍板、老闆愛事後改 = 需求反覆",flag:"決策鏈不穩，需求會反覆"},
    {q:"新需求的付費意願",hint:"想凹免費、「幫忙一下」= 成本吃不完",flag:"付費意願低，易凹免費"},
    {q:"溝通態度是否互惠？",hint:"只索取、不感謝、不尊重 = 伸手牌",flag:"伸手牌傾向：只索取不給予"},
    {q:"合作安全度（客戶自行接手的風險）",hint:"5 = 單純委託；1 = 客戶有工程能力，可能學走後自己做",flag:"客戶有工程能力，留意被取代"}
  ];
  const MAX_SCORE=CRITERIA.length*5;

  function verdictOf(total){
    if(total>=27) return {key:'go',label:'Go · 值得接',title:'這是個好客戶',
      desc:'互惠、需求清楚、付費合理。可正常承接。',pill:'green'};
    if(total>=18) return {key:'caution',label:'Caution · 謹慎',title:'可接，但要設好界線',
      desc:'有幾個警訊。建議：合約寫需求變更條款、提高報價、商務由業務把關。',pill:'amber'};
    return {key:'avoid',label:'Avoid · 高風險',title:'伸手牌警報',
      desc:'多項紅旗。若非接不可，務必大幅提高報價、白紙黑字鎖範圍，並讓業務主導商務。',pill:'red'};
  }

  const CLIENT_STATUS=[
    {v:'lead',l:'潛在',pill:'grey'},
    {v:'active',l:'合作中',pill:'green'},
    {v:'paused',l:'暫停',pill:'amber'},
    {v:'ended',l:'已結案',pill:'blue'},
    {v:'blacklist',l:'黑名單',pill:'red'}
  ];
  const STAGES=[
    {v:'dev',l:'開發中',pill:'grey'},
    {v:'uat',l:'驗收',pill:'amber'},
    {v:'close',l:'收尾',pill:'green'},
    {v:'maint',l:'維護',pill:'blue'},
    {v:'done',l:'已完成',pill:'blue'}
  ];
  const QUOTE_STATUS=[
    {v:'draft',l:'草稿',pill:'grey'},
    {v:'sent',l:'已送出',pill:'amber'},
    {v:'accepted',l:'已成交',pill:'green'},
    {v:'rejected',l:'未成交',pill:'red'}
  ];
  const LESSON_TYPES=['伸手牌（只索取不給予）','難搞高付費','互惠好客戶','低預算好配合','需求反覆型','想學走／換團隊型','其他'];

  function lookup(listArr,v){
    return listArr.find(function(x){ return x.v===v; }) || listArr[0];
  }
  function pill(listArr,v){
    const m=lookup(listArr,v);
    return '<span class="pill '+m.pill+'">'+U.esc(m.l)+'</span>';
  }
  function options(listArr){
    return listArr.map(function(x){ return {v:x.v,l:x.l}; });
  }
  /* 給下拉用的客戶清單 */
  function clientOptions(includeBlank){
    const arr=U.sortBy(Store.list('clients'),function(c){return c.name;})
      .map(function(c){ return {v:c.id,l:c.name}; });
    return includeBlank? [{v:'',l:'（不指定）'}].concat(arr) : arr;
  }
  function projectOptions(clientId,includeBlank){
    const arr=Store.list('projects')
      .filter(function(p){ return !clientId || p.clientId===clientId; })
      .map(function(p){ return {v:p.id,l:p.name+'（'+Store.clientName(p.clientId)+'）'}; });
    return includeBlank? [{v:'',l:'（不指定）'}].concat(arr) : arr;
  }
  function memberOptions(includeBlank){
    const arr=Store.list('members').map(function(m){ return {v:m.name,l:m.name}; });
    return includeBlank? [{v:'',l:'（未指派）'}].concat(arr) : arr;
  }

  function emptyBox(msg){ return '<div class="empty">'+U.esc(msg)+'</div>'; }

  return {toast:toast,openModal:openModal,closeModal:closeModal,form:form,confirm:confirm,
    CRITERIA:CRITERIA,MAX_SCORE:MAX_SCORE,verdictOf:verdictOf,
    CLIENT_STATUS:CLIENT_STATUS,STAGES:STAGES,QUOTE_STATUS:QUOTE_STATUS,LESSON_TYPES:LESSON_TYPES,
    lookup:lookup,pill:pill,options:options,clientOptions:clientOptions,projectOptions:projectOptions,
    memberOptions:memberOptions,emptyBox:emptyBox};
})();
