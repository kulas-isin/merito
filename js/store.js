/* ═══ Merito · 資料層（本機快取 + GitHub 同步）═══

   設計重點：
   - 每筆記錄都有 id / updatedAt / updatedBy，刪除是寫 deleted:true 的墓碑，
     這樣多人各自編輯時可以用「每筆記錄比 updatedAt」的方式合併，而不是整份覆蓋。
   - 寫入 GitHub 前一定先抓遠端最新版合併再 PUT，所以兩個人同時改不同客戶不會互相蓋掉。
   - 沒設定 token 時整套照常運作，只是資料留在這台瀏覽器。
*/
const Store = (function(){

  const LS_DATA='merito_data_v2';
  const LS_CFG='merito_cfg_v1';
  const SCHEMA=2;

  const COLLECTIONS=['clients','contacts','assessments','projects','quotes','payments','lessons','activities','members'];

  function emptyData(){
    const d={schema:SCHEMA,updatedAt:null,updatedBy:null};
    COLLECTIONS.forEach(function(c){ d[c]=[]; });
    return d;
  }

  const state={
    rev:0,                 /* 資料版本；只有真的動到資料才 +1，UI 靠這個決定要不要重繪 */
    data:emptyData(),
    cfg:{token:'',owner:'',repo:'',branch:'main',path:'data.json',me:''},
    sha:null,              /* 遠端檔案的 blob sha，PUT 時要帶 */
    dirty:false,           /* 有未推上去的本機變更 */
    syncing:false,
    lastSync:null,
    lastError:null,
    repoPrivate:null       /* null=未知 true/false */
  };

  const listeners=[];
  function subscribe(fn){ listeners.push(fn); }
  function emit(){ listeners.forEach(function(f){ try{f();}catch(e){console.error(e);} }); }

  /* ── 本機儲存 ── */
  function loadLocal(){
    try{
      const raw=localStorage.getItem(LS_DATA);
      if(raw){
        const d=JSON.parse(raw);
        state.data=normalize(d);
      }
    }catch(e){ console.warn('本機資料讀取失敗',e); }
    try{
      const raw=localStorage.getItem(LS_CFG);
      if(raw) Object.assign(state.cfg,JSON.parse(raw));
    }catch(e){ console.warn('設定讀取失敗',e); }
    migrateV1();
  }
  function saveLocal(){
    state.rev++;
    try{ localStorage.setItem(LS_DATA,JSON.stringify(state.data)); }
    catch(e){ UI && UI.toast('本機儲存失敗（空間可能已滿）',true); }
  }
  function saveCfg(){
    try{ localStorage.setItem(LS_CFG,JSON.stringify(state.cfg)); }catch(e){}
  }

  function normalize(d){
    const out=emptyData();
    if(!d||typeof d!=='object') return out;
    COLLECTIONS.forEach(function(c){ out[c]=Array.isArray(d[c])?d[c].filter(function(r){return r&&r.id;}):[]; });
    out.updatedAt=d.updatedAt||null;
    out.updatedBy=d.updatedBy||null;
    return out;
  }

  /* 舊版單檔（v1）的 localStorage 有資料的話，一次性搬進來 */
  function migrateV1(){
    try{
      if(localStorage.getItem('merito_migrated_v1')) return;
      const oldTrack=JSON.parse(localStorage.getItem('merito_track_v1')||'[]');
      const oldLesson=JSON.parse(localStorage.getItem('merito_lesson_v1')||'[]');
      if(!oldTrack.length && !oldLesson.length){
        localStorage.setItem('merito_migrated_v1','1'); return;
      }
      oldTrack.forEach(function(t){
        const c=upsert('clients',{name:t.name,status:'active',note:''},true);
        upsert('projects',{clientId:c.id,name:t.name,stage:t.stage||'dev',
          amount:t.amount||'',hours:t.hours||'',rate:t.rate||'',note:t.note||''},true);
      });
      oldLesson.forEach(function(l){
        const c=findClientByName(l.name)||upsert('clients',{name:l.name,status:'ended'},true);
        upsert('lessons',{clientId:c.id,type:l.type||'',trap:l.trap||'',lesson:l.lesson||'',
          date:today(),tags:[]},true);
      });
      localStorage.setItem('merito_migrated_v1','1');
      saveLocal();
    }catch(e){ console.warn('舊資料轉移失敗',e); }
    function today(){ return U.today(); }
  }

  /* ── CRUD ── */
  function list(coll){
    return (state.data[coll]||[]).filter(function(r){ return !r.deleted; });
  }
  function get(coll,id){
    return (state.data[coll]||[]).find(function(r){ return r.id===id && !r.deleted; })||null;
  }
  /* obj 帶 id → 更新；不帶 → 新增。quiet=true 時不觸發 render / 同步 */
  function upsert(coll,obj,quiet){
    const arr=state.data[coll]=state.data[coll]||[];
    const stamp={updatedAt:U.nowISO(),updatedBy:state.cfg.me||'（未署名）'};
    let rec;
    if(obj.id){
      const i=arr.findIndex(function(r){ return r.id===obj.id; });
      if(i>=0){ rec=Object.assign(arr[i],obj,stamp); }
      else { rec=Object.assign({createdAt:U.nowISO()},obj,stamp); arr.push(rec); }
    }else{
      rec=Object.assign({createdAt:U.nowISO()},obj,stamp);
      /* id 一定要最後蓋上去：呼叫端常寫 {id:c?c.id:undefined}，
         那個 undefined 會把先產生的 id 洗掉，變成一筆沒有 id 的孤兒記錄 */
      rec.id=U.uid(coll.slice(0,3));
      arr.push(rec);
    }
    if(!quiet){ touched(); }
    return rec;
  }
  /* 刪除 = 墓碑，這樣刪除才會同步給隊友 */
  function remove(coll,id,quiet){
    const arr=state.data[coll]||[];
    const i=arr.findIndex(function(r){ return r.id===id; });
    if(i<0) return;
    arr[i]={id:id,deleted:true,updatedAt:U.nowISO(),updatedBy:state.cfg.me||'（未署名）'};
    if(!quiet) touched();
  }
  function touched(){
    state.dirty=true;
    saveLocal();
    emit();
    autoPush();
  }

  /* ── 活動記錄 ── */
  function logActivity(clientId,kind,text){
    if(!clientId) return;
    upsert('activities',{clientId:clientId,kind:kind,text:text,at:U.nowISO()},true);
  }

  /* ── 常用查詢 ── */
  function findClientByName(name){
    const n=String(name||'').trim();
    return list('clients').find(function(c){ return c.name===n; })||null;
  }
  function clientName(id){
    const c=get('clients',id);
    return c? c.name : '（已刪除的客戶）';
  }
  function ofClient(coll,clientId){
    return list(coll).filter(function(r){ return r.clientId===clientId; });
  }

  /* 專案損益：合約 - 工時×時薪 */
  function projectEconomics(p){
    const amount=U.num(p.amount);
    const cost=U.num(p.hours)*U.num(p.rate);
    const margin=amount-cost;
    const pct=amount>0? Math.round(margin/amount*100) : null;
    return {amount:amount,cost:cost,margin:margin,pct:pct,hasBoth:amount>0&&cost>0};
  }
  /* 客戶總覽數字 */
  function clientSummary(clientId){
    const projects=ofClient('projects',clientId);
    const payments=ofClient('payments',clientId);
    const contracted=U.sum(projects,function(p){return p.amount;});
    const cost=U.sum(projects,function(p){return U.num(p.hours)*U.num(p.rate);});
    const received=U.sum(payments.filter(function(x){return x.paidDate;}),function(x){return x.amount;});
    const outstanding=U.sum(payments.filter(function(x){return !x.paidDate;}),function(x){return x.amount;});
    const overdue=payments.filter(function(x){
      return !x.paidDate && x.dueDate && U.daysFromToday(x.dueDate)<0;
    });
    const assessments=U.sortBy(ofClient('assessments',clientId),function(a){return a.date||'';},true);
    return {projects:projects,payments:payments,contracted:contracted,cost:cost,
      margin:contracted-cost,received:received,outstanding:outstanding,
      overdue:overdue,overdueAmount:U.sum(overdue,function(x){return x.amount;}),
      latestAssessment:assessments[0]||null,assessments:assessments};
  }

  /* ── 設定 ── */
  function setCfg(patch){
    Object.assign(state.cfg,patch);
    saveCfg();
    emit();
  }
  function syncConfigured(){
    const c=state.cfg;
    return !!(c.token && c.owner && c.repo && c.path);
  }

  /* ── GitHub API ── */
  function api(path,opts){
    opts=opts||{};
    const headers=Object.assign({
      'Accept':'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28'
    },opts.headers||{});
    if(state.cfg.token) headers['Authorization']='Bearer '+state.cfg.token;
    if(opts.body) headers['Content-Type']='application/json';
    return fetch('https://api.github.com'+path,{
      method:opts.method||'GET',headers:headers,
      body:opts.body?JSON.stringify(opts.body):undefined
    }).then(function(res){
      if(res.status===204) return {ok:true,status:204,body:null};
      return res.json().catch(function(){return null;}).then(function(body){
        return {ok:res.ok,status:res.status,body:body};
      });
    });
  }

  function contentsPath(){
    const c=state.cfg;
    return '/repos/'+encodeURIComponent(c.owner)+'/'+encodeURIComponent(c.repo)
      +'/contents/'+c.path.split('/').map(encodeURIComponent).join('/');
  }

  function describeError(r){
    if(r.status===401) return 'Token 無效或已過期（401）';
    if(r.status===403) return 'Token 權限不足或觸發 API 限流（403）';
    if(r.status===404) return '找不到 repo 或路徑（404）— 請確認 owner/repo 拼字與 token 是否有這個 repo 的權限';
    if(r.status===409) return '版本衝突（409），請再同步一次';
    if(r.status===422) return '內容無法寫入（422）：'+((r.body&&r.body.message)||'');
    return '同步失敗（'+r.status+'）：'+((r.body&&r.body.message)||'');
  }

  /* 檢查 repo 是否為 private —— 客戶資料放 public repo 等於公開 */
  function checkRepoVisibility(){
    if(!syncConfigured()) return Promise.resolve(null);
    return api('/repos/'+encodeURIComponent(state.cfg.owner)+'/'+encodeURIComponent(state.cfg.repo))
      .then(function(r){
        state.repoPrivate = r.ok && r.body ? !!r.body.private : null;
        emit();
        return state.repoPrivate;
      });
  }

  function fetchRemote(){
    return api(contentsPath()+'?ref='+encodeURIComponent(state.cfg.branch||'main'))
      .then(function(r){
        if(r.status===404) return {data:emptyData(),sha:null,missing:true};
        if(!r.ok) throw new Error(describeError(r));
        let parsed;
        try{ parsed=JSON.parse(U.b64decode(r.body.content||'')); }
        catch(e){ throw new Error('遠端 '+state.cfg.path+' 不是有效的 JSON，請確認檔案內容'); }
        return {data:normalize(parsed),sha:r.body.sha,missing:false};
      });
  }

  /* 逐筆比 updatedAt，新的贏；本機沒有的遠端記錄會被帶進來 */
  function mergeData(local,remote){
    const out=emptyData();
    COLLECTIONS.forEach(function(coll){
      const map=new Map();
      (remote[coll]||[]).forEach(function(r){ map.set(r.id,r); });
      (local[coll]||[]).forEach(function(l){
        const r=map.get(l.id);
        if(!r || String(l.updatedAt||'') >= String(r.updatedAt||'')) map.set(l.id,l);
      });
      out[coll]=Array.from(map.values());
    });
    return out;
  }

  /* 清掉 180 天前的墓碑，免得檔案無限長大 */
  function purgeTombstones(d){
    const cutoff=new Date(Date.now()-180*86400000).toISOString();
    COLLECTIONS.forEach(function(coll){
      d[coll]=(d[coll]||[]).filter(function(r){
        return !(r.deleted && String(r.updatedAt||'')<cutoff);
      });
    });
    return d;
  }

  /* 只拉不推：丟掉本機未同步的變更會很痛，所以 pull 也是走合併 */
  function pull(){
    if(!syncConfigured()) return Promise.reject(new Error('尚未設定 GitHub 同步'));
    setSyncing(true);
    return fetchRemote().then(function(rem){
      state.data=mergeData(state.data,rem.data);
      state.sha=rem.sha;
      saveLocal();
      state.lastSync=U.nowISO(); state.lastError=null;
      setSyncing(false);
      return rem;
    }).catch(function(err){
      state.lastError=err.message; setSyncing(false); throw err;
    });
  }

  function push(retry){
    if(!syncConfigured()) return Promise.reject(new Error('尚未設定 GitHub 同步'));
    if(state.syncing) return Promise.resolve(null);
    setSyncing(true);
    return fetchRemote().then(function(rem){
      const merged=purgeTombstones(mergeData(state.data,rem.data));
      merged.schema=SCHEMA;
      merged.updatedAt=U.nowISO();
      merged.updatedBy=state.cfg.me||'（未署名）';
      state.data=merged;
      saveLocal();
      const body={
        message:'Merito: update client data ('+(state.cfg.me||'unknown')+')',
        content:U.b64encode(JSON.stringify(merged,null,2)),
        branch:state.cfg.branch||'main'
      };
      if(rem.sha) body.sha=rem.sha;
      return api(contentsPath(),{method:'PUT',body:body}).then(function(r){
        if(!r.ok){
          /* 409/422 通常是這中間有人推了新版本 → 重抓一次再推 */
          if((r.status===409||r.status===422) && !retry){
            setSyncing(false);
            return push(true);
          }
          throw new Error(describeError(r));
        }
        state.sha=r.body && r.body.content ? r.body.content.sha : null;
        state.dirty=false;
        state.lastSync=U.nowISO();
        state.lastError=null;
        setSyncing(false);
        return r;
      });
    }).catch(function(err){
      state.lastError=err.message; setSyncing(false); throw err;
    });
  }

  function sync(){
    return push().then(function(r){
      if(r) UI.toast('已同步至 GitHub');
      return r;
    }).catch(function(err){
      UI.toast(err.message,true);
      throw err;
    });
  }

  function setSyncing(v){ state.syncing=v; emit(); }

  /* 自動推送：改完 4 秒沒有新動作才推，避免每敲一個字就打 API */
  const autoPush=U.debounce(function(){
    if(!syncConfigured() || !state.dirty || state.syncing) return;
    push().catch(function(err){ console.warn('自動同步失敗：'+err.message); emit(); });
  },4000);

  /* ── 匯出 / 匯入 ── */
  function exportJSON(){
    return JSON.stringify(state.data,null,2);
  }
  function importJSON(text,mode){
    const incoming=normalize(JSON.parse(text));
    state.data = mode==='replace' ? incoming : mergeData(incoming,state.data);
    touched();
  }

  function init(){
    loadLocal();
    if(syncConfigured()){
      pull().then(function(){ emit(); checkRepoVisibility(); })
        .catch(function(err){ UI.toast('讀取遠端資料失敗：'+err.message,true); emit(); });
    }
  }

  return {
    state:state, COLLECTIONS:COLLECTIONS,
    subscribe:subscribe, emit:emit, init:init,
    list:list, get:get, upsert:upsert, remove:remove, logActivity:logActivity,
    findClientByName:findClientByName, clientName:clientName, ofClient:ofClient,
    projectEconomics:projectEconomics, clientSummary:clientSummary,
    setCfg:setCfg, syncConfigured:syncConfigured,
    pull:pull, push:push, sync:sync, checkRepoVisibility:checkRepoVisibility,
    exportJSON:exportJSON, importJSON:importJSON, saveLocal:saveLocal
  };
})();
