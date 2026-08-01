/* ═══ Merito · 共用工具 ═══ */
const U = (function(){

  function esc(s){
    return (s==null?'':String(s)).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  /* 保留換行的顯示 */
  function escLines(s){ return esc(s).replace(/\n/g,'<br>'); }

  function uid(prefix){
    return (prefix||'id')+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
  }

  function nowISO(){ return new Date().toISOString(); }
  function today(){
    const d=new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }

  function num(v){ const n=parseFloat(v); return isFinite(n)?n:0; }

  /* 金額：0 或空 → dash */
  function money(v,dash){
    const n=num(v);
    if(!n) return dash===undefined?'—':dash;
    return n.toLocaleString('zh-TW',{maximumFractionDigits:0});
  }
  function money0(v){ return num(v).toLocaleString('zh-TW',{maximumFractionDigits:0}); }

  function dateStr(iso){ return iso? String(iso).slice(0,10) : '—'; }

  /* 相對時間：3 分鐘前 / 2 天前 */
  function ago(iso){
    if(!iso) return '';
    const t=new Date(iso).getTime();
    if(!isFinite(t)) return '';
    const s=Math.floor((Date.now()-t)/1000);
    if(s<60) return '剛剛';
    if(s<3600) return Math.floor(s/60)+' 分鐘前';
    if(s<86400) return Math.floor(s/3600)+' 小時前';
    if(s<2592000) return Math.floor(s/86400)+' 天前';
    return dateStr(iso);
  }

  /* 距今天幾天：負數 = 已逾期 */
  function daysFromToday(dateOnly){
    if(!dateOnly) return null;
    const a=new Date(dateOnly+'T00:00:00'), b=new Date(today()+'T00:00:00');
    if(!isFinite(a.getTime())) return null;
    return Math.round((a-b)/86400000);
  }

  function debounce(fn,ms){
    let t=null;
    return function(){
      const args=arguments, self=this;
      clearTimeout(t);
      t=setTimeout(function(){ fn.apply(self,args); },ms);
    };
  }

  /* UTF-8 safe base64（GitHub contents API 用） */
  function b64encode(str){
    const bytes=new TextEncoder().encode(str);
    let bin='';
    const CH=0x8000;
    for(let i=0;i<bytes.length;i+=CH){
      bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+CH));
    }
    return btoa(bin);
  }
  function b64decode(b64){
    const bin=atob(String(b64).replace(/\s/g,''));
    const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  function download(filename,text,mime){
    const blob=new Blob([text],{type:mime||'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); },1000);
  }

  function csvCell(v){
    const s=(v==null?'':String(v));
    return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
  }
  function toCSV(rows){
    return rows.map(function(r){ return r.map(csvCell).join(','); }).join('\n');
  }

  /* 陣列分組 / 加總 */
  function sum(arr,pick){
    return arr.reduce(function(a,x){ return a+num(pick?pick(x):x); },0);
  }
  function by(arr,key){
    const m={};
    arr.forEach(function(x){ const k=x[key]; (m[k]=m[k]||[]).push(x); });
    return m;
  }
  function sortBy(arr,pick,desc){
    return arr.slice().sort(function(a,b){
      const x=pick(a), y=pick(b);
      if(x===y) return 0;
      return (x>y?1:-1)*(desc?-1:1);
    });
  }

  /* 標籤字串 <-> 陣列 */
  function parseTags(s){
    return String(s||'').split(/[,，\s]+/).map(function(x){return x.trim();}).filter(Boolean);
  }

  /* 模糊搜尋：所有關鍵字都要命中 */
  function matches(haystack,q){
    if(!q) return true;
    const h=String(haystack).toLowerCase();
    return String(q).toLowerCase().split(/\s+/).filter(Boolean)
      .every(function(w){ return h.indexOf(w)>=0; });
  }

  function $(sel,root){ return (root||document).querySelector(sel); }
  function $$(sel,root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }

  /* 綁定 data-act 事件（事件委派，避免重複 render 後失效） */
  function delegate(root,act,handler){
    root.addEventListener('click',function(e){
      const el=e.target.closest('[data-act="'+act+'"]');
      if(el && root.contains(el)){ e.preventDefault(); handler(el,e); }
    });
  }

  return {esc:esc,escLines:escLines,uid:uid,nowISO:nowISO,today:today,num:num,money:money,money0:money0,
    dateStr:dateStr,ago:ago,daysFromToday:daysFromToday,debounce:debounce,
    b64encode:b64encode,b64decode:b64decode,download:download,toCSV:toCSV,
    sum:sum,by:by,sortBy:sortBy,parseTags:parseTags,matches:matches,$:$,$$:$$,delegate:delegate};
})();
