/* ═══ Merito · 路由與啟動 ═══ */
const Main = (function(){

  const VIEWS={
    dashboard:ViewDashboard,
    clients:ViewClients,
    assess:ViewAssess,
    projects:ViewProjects,
    finance:ViewFinance,
    lessons:ViewLessons,
    settings:ViewSettings
  };
  let current='dashboard';
  let lastRev=-1;

  function go(name){
    if(!VIEWS[name]) name='dashboard';
    current=name;
    if(location.hash.slice(1)!==name) location.hash=name;
    paintTabs();
    render(true);
  }

  function paintTabs(){
    U.$$('#tabs button').forEach(function(b){
      b.classList.toggle('on',b.dataset.v===current);
    });
    U.$$('.view').forEach(function(v){
      v.classList.toggle('on',v.id==='v-'+current);
    });
  }

  /* 重繪目前分頁。會盡量把焦點與游標位置還回去，
     免得背景同步完成時把使用者正在打的字打斷。 */
  function render(force){
    if(!force && Store.state.rev===lastRev) return;
    lastRev=Store.state.rev;

    const active=document.activeElement;
    const keep=active && active.id && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)
      ? {id:active.id,start:active.selectionStart,end:active.selectionEnd} : null;

    const el=document.getElementById('v-'+current);
    try{
      VIEWS[current].render(el);
    }catch(err){
      console.error(err);
      el.innerHTML='<div class="warnbox">畫面繪製發生錯誤：'+U.esc(err.message)+
        '<br>請到「設定 → 備份與轉移」匯出 JSON 保住資料，再回報這個訊息。</div>';
    }

    if(keep){
      /* 只在同一個分頁裡還原焦點。切分頁時舊分頁的 DOM 還在（只是隱藏），
         不擋掉的話焦點會跳去看不見的元素 */
      const again=document.getElementById(keep.id);
      if(again && el.contains(again) && typeof again.focus==='function'){
        again.focus();
        try{ again.setSelectionRange(keep.start,keep.end); }catch(e){}
      }
    }
    paintFooter();
  }

  function paintFooter(){
    const n=Store.list('clients').length, p=Store.list('projects').length;
    document.getElementById('footStat').textContent=
      n+' 個客戶 · '+p+' 個專案'+(Store.state.lastSync? ' · 最後同步 '+U.ago(Store.state.lastSync) : '');
  }

  function paintSync(){
    const dot=document.getElementById('syncDot');
    const txt=document.getElementById('syncText');
    const st=Store.state;
    dot.className='sync-dot';
    if(!Store.syncConfigured()){ txt.textContent='未設定同步'; return; }
    if(st.syncing){ dot.classList.add('busy'); txt.textContent='同步中…'; return; }
    if(st.lastError){ dot.classList.add('err'); txt.textContent='同步失敗'; return; }
    if(st.dirty){ dot.classList.add('dirty'); txt.textContent='有未同步變更'; return; }
    dot.classList.add('ok');
    txt.textContent=st.lastSync? '已同步 '+U.ago(st.lastSync) : '已連線';
  }

  function boot(){
    U.$$('#tabs button').forEach(function(b){
      b.onclick=function(){ go(b.dataset.v); };
    });
    document.getElementById('syncChip').onclick=function(){
      if(!Store.syncConfigured()){ go('settings'); return; }
      Store.sync().then(function(){ Store.emit(); }).catch(function(){});
    };
    window.addEventListener('hashchange',function(){
      const h=location.hash.slice(1);
      if(h && VIEWS[h] && h!==current) go(h);
    });

    /* 資料沒變就只更新同步狀態，不整頁重繪 */
    Store.subscribe(function(){ paintSync(); render(false); paintFooter(); });
    Store.init();

    const h=location.hash.slice(1);
    current = VIEWS[h] ? h : 'dashboard';
    paintTabs();
    render(true);
    paintSync();

    /* 離開前若還有沒推上去的變更，提醒一下 */
    window.addEventListener('beforeunload',function(e){
      if(Store.syncConfigured() && Store.state.dirty){
        e.preventDefault(); e.returnValue='';
      }
    });
  }

  /* 對外的 render() 一律強制重繪：畫面上有些狀態（例如評分中的分數）不在 Store 裡 */
  return {go:go,render:function(){ render(true); },boot:boot};
})();

document.addEventListener('DOMContentLoaded',Main.boot);
