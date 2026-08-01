/* ═══ 06 設定 ═══ */
const ViewSettings = (function(){

  /* 貼上的 JSON 與預覽結果留在模組層，這樣背景同步觸發重繪時不會把使用者貼的東西清掉 */
  let pasted='';
  let preview=null;

  function render(el){
    const c=Store.state.cfg;
    const st=Store.state;
    const configured=Store.syncConfigured();

    el.innerHTML=
      '<h2 class="sect">Settings</h2>'+
      '<p class="lead">設定同步、團隊成員與資料備份。同步用的是 GitHub —— 團隊每個人填自己的 token，共用同一份 data.json，改動會自動合併，還附帶完整版本歷史。</p>'+

      (st.repoPrivate===false
        ? '<div class="warnbox"><strong>警告：資料 repo 是 public。</strong>客戶名稱、合約金額、你對客戶的評語現在任何人都看得到。'+
          '請到 GitHub repo 的 Settings → General → Danger Zone 改成 Private，或換一個 private repo。</div>'
        : '')+

      '<h3 class="blk">我是誰</h3>'+
      '<div class="panel">'+
        '<div class="field-row"><div class="field"><label>你的名字</label>'+
          '<input id="sMe" value="'+U.esc(c.me)+'" placeholder="例：Kulas">'+
          '<div class="help">會記在每筆資料的「最後修改者」與評估記錄上，團隊才知道是誰改的。</div></div>'+
          '<div class="field"><label>&nbsp;</label><button class="act" data-act="save-me">儲存</button></div>'+
        '</div>'+
      '</div>'+

      '<h3 class="blk">GitHub 同步</h3>'+
      '<div class="infobox">'+
        '把資料存成一個 repo 裡的 <code>data.json</code>。建議另開一個 <strong>private</strong> repo（例如 <code>merito-data</code>），'+
        '不要用放這個網站的 public repo。<br>'+
        'Token 取得方式：GitHub → Settings → Developer settings → Personal access tokens → '+
        'Fine-grained tokens，Repository access 只勾那個資料 repo，權限給 <code>Contents: Read and write</code>。'+
      '</div>'+
      '<div class="panel">'+
        '<div class="field-row">'+
          '<div class="field"><label>Owner（帳號或組織）</label><input id="sOwner" value="'+U.esc(c.owner)+'" placeholder="kulas-isin"></div>'+
          '<div class="field"><label>Repo 名稱</label><input id="sRepo" value="'+U.esc(c.repo)+'" placeholder="merito-data"></div>'+
        '</div>'+
        '<div class="field-row">'+
          '<div class="field"><label>分支</label><input id="sBranch" value="'+U.esc(c.branch||'main')+'" placeholder="main"></div>'+
          '<div class="field"><label>檔案路徑</label><input id="sPath" value="'+U.esc(c.path||'data.json')+'" placeholder="data.json"></div>'+
        '</div>'+
        '<div class="field"><label>Personal Access Token</label>'+
          '<input id="sToken" type="password" value="'+U.esc(c.token)+'" placeholder="github_pat_...">'+
          '<div class="help">Token 存在這台瀏覽器的 localStorage，不會傳去別的地方。共用電腦請用完清除。</div></div>'+
        '<div class="btn-row" style="margin-top:14px">'+
          '<button class="act" data-act="save-sync">儲存並測試連線</button>'+
          '<button class="act ghost" data-act="pull"'+(configured?'':' disabled')+'>從 GitHub 拉取</button>'+
          '<button class="act ghost" data-act="push"'+(configured?'':' disabled')+'>推送到 GitHub</button>'+
          '<button class="act ghost danger" data-act="clear-token">清除 Token</button>'+
        '</div>'+
        '<div class="help" style="margin-top:12px">'+
          (configured
            ? '狀態：'+(st.lastError? '<span class="neg">'+U.esc(st.lastError)+'</span>'
                : '正常'+(st.lastSync? '，最後同步 '+U.esc(U.ago(st.lastSync)) : ''))+
              (st.repoPrivate===true? '　·　repo 為 private ✓':'')
            : '尚未設定，資料目前只存在這台瀏覽器。')+
        '</div>'+
      '</div>'+

      '<h3 class="blk">團隊成員</h3>'+
      '<p class="small muted" style="margin-bottom:12px">加了成員之後，客戶與專案的「負責人」欄位就能直接下拉選人。</p>'+
      '<div class="panel">'+
        '<div class="btn-row" style="margin-bottom:14px">'+
          '<input class="search" id="mName" placeholder="成員名字">'+
          '<input class="search" id="mRole" placeholder="角色（PM／工程／業務）" style="min-width:150px">'+
          '<button class="act sm" data-act="add-member">新增</button>'+
        '</div>'+
        renderMembers()+
      '</div>'+

      '<h3 class="blk">貼上 JSON 匯入</h3>'+
      '<div class="infobox">'+
        '請 AI 把對話紀錄整理成 Merito 格式後，回覆的 JSON 直接貼進來就好，不用先存成檔案。'+
        '欄位規格與可複製的提示詞在 <code>docs/ai-import.md</code>。'+
        '<br>會先做一次體檢再問你要不要匯入 —— AI 產的 JSON 常缺 id 或 updatedAt，那兩種錯誤匯入後不會報錯，資料只是默默沒進來。'+
      '</div>'+
      '<div class="panel">'+
        '<div class="field"><label>JSON 內容</label>'+
          '<textarea id="pasteBox" rows="7" placeholder=\'{ "schema": 2, "clients": [ ... ] }\'>'+U.esc(pasted)+'</textarea></div>'+
        '<div class="btn-row" style="margin-top:12px">'+
          '<button class="act" data-act="check">檢查並預覽</button>'+
          '<button class="act ghost" data-act="clear-paste">清空</button>'+
        '</div>'+
        renderPreview()+
      '</div>'+

      '<h3 class="blk">備份與轉移</h3>'+
      '<div class="panel">'+
        '<div class="btn-row">'+
          '<button class="act ghost" data-act="export">匯出 JSON 備份</button>'+
          '<button class="act ghost" data-act="import-merge">從檔案匯入（合併）</button>'+
          '<button class="act ghost" data-act="import-replace">從檔案匯入（覆蓋）</button>'+
          '<button class="act ghost danger" data-act="wipe">清空本機資料</button>'+
        '</div>'+
        '<div class="help" style="margin-top:12px">'+
          '合併＝兩邊都留，同一筆以較新的為準；覆蓋＝整份換掉。清空只會清這台瀏覽器，GitHub 上的資料不受影響。'+
        '</div>'+
        '<input type="file" id="importFile" accept="application/json,.json" hidden>'+
      '</div>'+

      '<h3 class="blk">目前資料量</h3>'+
      '<div class="table-scroll"><table><tbody>'+
        Store.COLLECTIONS.map(function(k){
          return '<tr><td>'+U.esc(labelOf(k))+'</td><td class="num">'+Store.list(k).length+'</td></tr>';
        }).join('')+
      '</tbody></table></div>';

    bind(el);
  }

  function labelOf(k){
    return {clients:'客戶',contacts:'聯絡人',assessments:'評估記錄',projects:'專案',
      quotes:'報價單',payments:'收款里程碑',lessons:'經驗記錄',activities:'動態記錄',members:'團隊成員'}[k]||k;
  }

  function renderPreview(){
    if(!preview) return '';
    if(!preview.ok) return '<div class="warnbox" style="margin:16px 0 0">'+U.esc(preview.error)+'</div>';
    return '<div style="margin-top:18px">'+
      '<div class="table-scroll"><table><thead><tr><th>區塊</th><th>新增</th><th>更新既有</th><th>會被略過</th></tr></thead><tbody>'+
        preview.stats.map(function(s){
          return '<tr><td>'+U.esc(s.label)+'</td>'+
            '<td class="num">'+(s.add||'—')+'</td>'+
            '<td class="num">'+(s.upd||'—')+'</td>'+
            '<td class="num'+(s.drop?' neg':'')+'">'+(s.drop||'—')+'</td></tr>';
        }).join('')+
      '</tbody></table></div>'+
      (preview.warnings.length
        ? '<div class="warnbox" style="margin-top:14px">'+
            preview.warnings.map(function(w){ return '▲ '+U.esc(w); }).join('<br>')+
          '</div>'
        : '')+
      '<div class="btn-row" style="margin-top:14px">'+
        '<button class="act" data-act="do-merge">合併匯入（共 '+preview.total+' 筆）</button>'+
        '<button class="act ghost danger" data-act="do-replace">改成覆蓋匯入</button>'+
      '</div>'+
      '<div class="help" style="margin-top:10px">'+
        '合併＝只補上新的、更新較新的，沒提到的記錄完全不動。'+
        '覆蓋＝整份資料換成這段 JSON，現有的東西會不見，除非你很確定否則別用。'+
      '</div>'+
    '</div>';
  }

  function renderMembers(){
    const ms=Store.list('members');
    if(!ms.length) return UI.emptyBox('還沒有成員。');
    return '<div class="table-scroll"><table><thead><tr><th>名字</th><th>角色</th><th></th></tr></thead><tbody>'+
      ms.map(function(m){
        return '<tr><td><strong>'+U.esc(m.name)+'</strong></td>'+
          '<td class="small muted">'+U.esc(m.role||'—')+'</td>'+
          '<td class="tight"><button class="linkbtn" data-act="del-member" data-id="'+U.esc(m.id)+'">刪除</button></td></tr>';
      }).join('')+'</tbody></table></div>';
  }

  function bind(el){
    el.querySelector('[data-act="save-me"]').onclick=function(){
      Store.setCfg({me:el.querySelector('#sMe').value.trim()});
      UI.toast('已儲存');
    };

    el.querySelector('[data-act="save-sync"]').onclick=function(){
      Store.setCfg({
        owner:el.querySelector('#sOwner').value.trim(),
        repo:el.querySelector('#sRepo').value.trim(),
        branch:el.querySelector('#sBranch').value.trim()||'main',
        path:el.querySelector('#sPath').value.trim()||'data.json',
        token:el.querySelector('#sToken').value.trim()
      });
      if(!Store.syncConfigured()){ UI.toast('owner、repo、path、token 都要填',true); return; }
      Store.pull().then(function(){
        UI.toast('連線成功，已載入遠端資料');
        return Store.checkRepoVisibility();
      }).then(function(priv){
        if(priv===false) UI.toast('注意：這個 repo 是 public，客戶資料會被公開',true);
        Store.emit();
      }).catch(function(err){ UI.toast(err.message,true); Store.emit(); });
    };

    el.querySelector('[data-act="pull"]').onclick=function(){
      Store.pull().then(function(){ UI.toast('已從 GitHub 拉取並合併'); Store.emit(); })
        .catch(function(err){ UI.toast(err.message,true); });
    };
    el.querySelector('[data-act="push"]').onclick=function(){ Store.sync(); };
    el.querySelector('[data-act="clear-token"]').onclick=function(){
      Store.setCfg({token:''});
      UI.toast('已清除 token，資料仍留在本機');
    };

    el.querySelector('[data-act="add-member"]').onclick=function(){
      const n=el.querySelector('#mName').value.trim();
      if(!n){ el.querySelector('#mName').focus(); return; }
      Store.upsert('members',{name:n,role:el.querySelector('#mRole').value.trim()});
      UI.toast('已新增成員');
    };
    U.$$('[data-act="del-member"]',el).forEach(function(b){
      b.onclick=function(){ Store.remove('members',b.dataset.id); UI.toast('已刪除'); };
    });

    /* ── 貼上 JSON 匯入 ── */
    const box=el.querySelector('#pasteBox');
    box.oninput=function(){ pasted=box.value; };
    el.querySelector('[data-act="check"]').onclick=function(){
      pasted=box.value;
      if(!pasted.trim()){ box.focus(); UI.toast('請先貼上 JSON',true); return; }
      preview=Store.analyzeImport(pasted);
      Main.render();
      if(!preview.ok) UI.toast(preview.error,true);
      else if(preview.warnings.length) UI.toast('可以匯入，但有需要注意的地方');
      else UI.toast('檢查通過，共 '+preview.total+' 筆');
    };
    el.querySelector('[data-act="clear-paste"]').onclick=function(){
      pasted=''; preview=null; Main.render();
    };
    const doMerge=el.querySelector('[data-act="do-merge"]');
    if(doMerge) doMerge.onclick=function(){ runPaste('merge'); };
    const doReplace=el.querySelector('[data-act="do-replace"]');
    if(doReplace) doReplace.onclick=function(){
      UI.confirm('覆蓋匯入',
        '會把現在所有的客戶、專案、收款、經驗全部換成這段 JSON 的內容，原本的資料會不見。'+
        '建議先「匯出 JSON 備份」。確定要覆蓋嗎？',
        function(){ runPaste('replace'); },'確定覆蓋');
    };

    el.querySelector('[data-act="export"]').onclick=function(){
      U.download('merito-backup-'+U.today()+'.json',Store.exportJSON());
    };
    const file=el.querySelector('#importFile');
    let importMode='merge';
    el.querySelector('[data-act="import-merge"]').onclick=function(){ importMode='merge'; file.click(); };
    el.querySelector('[data-act="import-replace"]').onclick=function(){ importMode='replace'; file.click(); };
    file.onchange=function(){
      const f=file.files[0];
      if(!f) return;
      const reader=new FileReader();
      reader.onload=function(){
        try{
          Store.importJSON(String(reader.result),importMode);
          UI.toast(importMode==='replace'?'已覆蓋匯入':'已合併匯入');
        }catch(e){ UI.toast('匯入失敗：檔案不是有效的 Merito JSON',true); }
        file.value='';
      };
      reader.readAsText(f);
    };

    el.querySelector('[data-act="wipe"]').onclick=function(){
      UI.confirm('清空本機資料','會刪掉這台瀏覽器上的所有 Merito 資料。若已設定同步，GitHub 上的那份不受影響，重新載入後會再抓回來。確定嗎？',function(){
        localStorage.removeItem('merito_data_v2');
        location.reload();
      },'確定清空');
    };
  }

  function runPaste(mode){
    try{
      Store.importJSON(pasted,mode);
      pasted=''; preview=null;
      UI.toast(mode==='replace'?'已覆蓋匯入':'已合併匯入');
      Main.render();
    }catch(e){
      UI.toast('匯入失敗：'+e.message,true);
    }
  }

  return {render:render};
})();
