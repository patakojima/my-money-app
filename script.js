let isSystemAction = false;
let data = JSON.parse(localStorage.getItem("moneyData")) || [];
let stores = JSON.parse(localStorage.getItem("storePresets")) || [];
let fixedTemplates = JSON.parse(localStorage.getItem("fixedTemplates")) || [];
let customEnds = JSON.parse(localStorage.getItem("customCycleEnds")) || {}; 

let activeStore = null, mDCount = 0, mFCount = 0, mTotal = 0, actionLog = [], currentExtraMode = 'D'; 

const formatStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseDate = (s) => { if(!s) return new Date(); const p = s.split('-'); return new Date(p[0], p[1]-1, p[2]); };

window.onload = () => { 
    const dateEl = document.getElementById("date");
    if(dateEl) dateEl.value = formatStr(new Date()); 
    renderTemplates(); render(); updateStoreUI(); loadTerminalDraft(); 
};

function switchPage(pageId, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pEl = document.getElementById('page-' + pageId);
    if(pEl) pEl.classList.add('active');
    
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    if(el) el.classList.add('active');
    
    const titleEl = document.getElementById('display-title');
    if(titleEl) {
        titleEl.innerText = pageId==='main'?'MAIN_DASHBOARD':(pageId==='terminal'?'TERMINAL_OP_V7.9':'TEMPLATE_MANAGER');
    }
    
    if(pageId === 'terminal') { 
        isSystemAction = true; updateStoreSelect(); 
        if(activeStore) { 
            const api = document.getElementById('active-project-id'); if(api) api.value = activeStore.id;
            const atArea = document.getElementById('active-terminal-area'); if(atArea) atArea.style.display = 'block'; 
            setTxt('label-price-a', activeStore.a); setTxt('label-price-b', activeStore.b);
            setExtraMode(currentExtraMode); updateTDisplay(); 
        } 
        updateProgressBar(); setTimeout(() => isSystemAction = false, 50); 
    }
}

// 締め日カスタム関係
function showCycleEditModal() { let c = getCycle(new Date()); setV('cycle-edit-key', c.cycleKey); setV('cycle-edit-date', c.endStr); const cem = document.getElementById('cycle-edit-modal'); if(cem) cem.style.display = 'flex'; }
function closeCycleEditModal() { const cem = document.getElementById('cycle-edit-modal'); if(cem) cem.style.display = 'none'; }
function saveCycleEnd() { const k=getV('cycle-edit-key'), d=getV('cycle-edit-date'); if(!k || !d) return; customEnds[k] = d; localStorage.setItem("customCycleEnds", JSON.stringify(customEnds)); closeCycleEditModal(); render(); }
function resetCycleEnd() { const k=getV('cycle-edit-key'); if(!k) return; delete customEnds[k]; localStorage.setItem("customCycleEnds", JSON.stringify(customEnds)); closeCycleEditModal(); render(); }

// 固定テンプレート関係
function renderTemplates() { 
    const tList = document.getElementById('template-list-ui'); if(!tList) return;
    tList.innerHTML = fixedTemplates.sort((a,b)=>a.day-b.day).map((t,i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;padding:10px 0;border-bottom:1px dashed #334155;">
            <div><span style="color:var(--text-muted);font-family:monospace;margin-right:5px;">${t.day}日</span><span style="color:${t.type==='expense'?'var(--accent-red)':'var(--accent-green)'};font-weight:bold;">${t.type==='expense'?'[-]':'[+]'}</span> ${t.category}</div>
            <div style="display:flex; gap:6px; align-items:center;">
                <span style="margin-right:6px; font-weight:bold;">${t.amount.toLocaleString()}円</span>
                <button onclick="editTemplateUI(${t.id})" style="background:#007aff;color:white;border:none;border-radius:6px;padding:6px 10px;font-size:10px;font-weight:bold;">編集</button>
                <button onclick="delTemplate(${i})" style="background:var(--accent-red);color:white;border:none;border-radius:6px;padding:6px 10px;font-size:10px;font-weight:bold;">✖</button>
            </div>
        </div>
    `).join(''); 
}
function editTemplateUI(id) { 
    const t = fixedTemplates.find(x=>x.id==id); if(!t) return; 
    const fields = { 'edit-tpl-id':t.id, 'tpl-day':t.day, 'tpl-time':t.time||"10:00", 'tpl-type':t.type, 'tpl-amount':t.amount, 'tpl-category':t.category, 'tpl-memo':t.memo||"" };
    for(let k in fields) { setV(k, fields[k]); }
    const sb = document.getElementById('tpl-save-btn'); if(sb) sb.innerText="保存"; 
    const cb = document.getElementById('tpl-cancel-btn'); if(cb) cb.style.display="block"; 
    window.scrollTo({top:0,behavior:'smooth'});
}
function cancelEditTemplate() { 
    ['edit-tpl-id','tpl-day','tpl-amount','tpl-category','tpl-memo'].forEach(k => setV(k, ""));
    const sb = document.getElementById('tpl-save-btn'); if(sb) sb.innerText="テンプレート追加"; 
    const cb = document.getElementById('tpl-cancel-btn'); if(cb) cb.style.display="none"; 
}
function saveTemplate() { 
    const id=getV('edit-tpl-id'), day=Number(getV('tpl-day')), time=getV('tpl-time')||"00:00", type=getV('tpl-type'), amount=Number(getV('tpl-amount')), category=getV('tpl-category'), memo=getV('tpl-memo'); 
    if(!day||day<1||day>31||!amount||!category){alert("入力漏れがあります");return;} 
    if(id){ fixedTemplates[fixedTemplates.findIndex(t=>t.id==id)]={id:Number(id),day,time,type,amount,category,memo}; } 
    else { fixedTemplates.push({id:Date.now(),day,time,type,amount,category,memo}); } 
    localStorage.setItem("fixedTemplates",JSON.stringify(fixedTemplates)); cancelEditTemplate(); renderTemplates(); render(); 
}
function delTemplate(i) { if(!confirm("削除しますか？"))return; fixedTemplates.splice(i,1); localStorage.setItem("fixedTemplates",JSON.stringify(fixedTemplates)); renderTemplates(); }

// サイクル日付演算
function getCycle(dObj=new Date()) { 
    const y=dObj.getFullYear(), m=dObj.getMonth();
    let s = new Date(y, m, 0); 
    let e = new Date(y, m + 1, 0); 
    e.setDate(e.getDate() - 1); 
    let cycleKey = formatStr(s).substring(0, 7); 
    if (customEnds[cycleKey]) { e = parseDate(customEnds[cycleKey]); }
    let nextP = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1);

    if (formatStr(dObj) >= formatStr(nextP)) {
        s = nextP; let nextLd = new Date(y, m + 2, 0); 
        e = new Date(nextLd.getFullYear(), nextLd.getMonth(), nextLd.getDate() - 1);
        cycleKey = formatStr(s).substring(0, 7); if (customEnds[cycleKey]) { e = parseDate(customEnds[cycleKey]); }
        nextP = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1);
    }
    if (formatStr(dObj) < formatStr(s)) {
        let prevLd = new Date(y, m, 0); e = new Date(prevLd.getFullYear(), prevLd.getMonth(), prevLd.getDate() - 1);
        s = new Date(y, m - 1, 0); cycleKey = formatStr(s).substring(0, 7);
        if (customEnds[cycleKey]) { e = parseDate(customEnds[cycleKey]); }
        nextP = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1);
    }
    return { startStr:formatStr(s), endStr:formatStr(e), nextPayStr:formatStr(nextP), nextPayObj:nextP, cycleKey:cycleKey }; 
}

function getCycleDateForDay(tDay, sStr, eStr) { let c=parseDate(sStr), e=parseDate(eStr), fb=null, sc=0; while(c<=e && sc<40){ if(c.getDate()==tDay)return formatStr(c); let n=new Date(c); n.setDate(c.getDate()+1); if(c.getMonth()!==n.getMonth())fb=formatStr(c); c=n; sc++; } return fb||formatStr(e); }

function syncTemplatesWithCycle(calc) {
    let u=false;
    fixedTemplates.forEach(t => {
        const tgt = getCycleDateForDay(t.day, calc.startStr, calc.endStr);
        if(!data.find(d => d.templateId===t.id && d.status!=='deleted' && d.date>=calc.startStr && d.date<calc.nextPayStr)){
            data.push({ id:Date.now()+Math.random(), templateId:t.id, date:tgt, time:t.time, timestamp:parseDate(tgt).getTime(), amount:t.amount, type:t.type, category:t.category, memo:t.memo, actionLogText:"", status:'pending' }); u=true;
        }
    });
    if(u) save();
}

// 予算計算コアロジック
function calculateCurrentBudget() {
    const t=new Date(); t.setHours(0,0,0,0); const tStr=formatStr(t); const c=getCycle(t); 
    let cEx=0, cIn=0, tSp=0, wSp=0, dOfW=t.getDay(), dSM=dOfW===0?6:dOfW-1, sW=new Date(t); sW.setDate(t.getDate()-dSM); let sWStr=formatStr(sW);
    
    data.forEach(d => { 
        if(d.date>=c.startStr && d.date<c.nextPayStr && d.status!=='deleted' && d.status!=='skipped') { 
            if(d.type==='expense'){ 
                cEx+=d.amount; 
                if(!d.templateId && d.status!=='pending') { 
                    if(d.date===tStr) tSp+=d.amount; 
                    if(d.date>=sWStr && d.date<=tStr) wSp+=d.amount; 
                } 
            } 
            if(d.type==='income'){ cIn+=d.amount; } 
        } 
    });
    
    let cBal = cIn - cEx; let cycleEndObj = parseDate(c.endStr); let remD = Math.floor((cycleEndObj.getTime() - t.getTime())/(1000*60*60*24)) + 1; if (remD < 1) remD = 1; 
    let dailyAvg = Math.floor((cBal + tSp) / remD); if (dailyAvg < 0) dailyAvg = 0;
    let tBud = dailyAvg - tSp;
    let weekStartD = parseDate(sWStr); let cycleStartObj = parseDate(c.startStr);
    let validStart = weekStartD < cycleStartObj ? cycleStartObj : weekStartD;
    let weekEndD = new Date(weekStartD); weekEndD.setDate(weekStartD.getDate() + 6);
    let validEnd = weekEndD > cycleEndObj ? cycleEndObj : weekEndD; 
    let validDaysInWeek = Math.floor((validEnd.getTime() - validStart.getTime())/(1000*60*60*24)) + 1; if (validDaysInWeek < 1) validDaysInWeek = 1;
    
    let bFW = dailyAvg * validDaysInWeek; let wRem = bFW - wSp; 
    if (wRem > cBal) wRem = cBal; bFW = wSp + (wRem > 0 ? wRem : 0);
    return { currentBalance:cBal, todayBudget:tBud, weekRemaining:wRem, budgetForToday:dailyAvg, budgetForWeek:bFW, cycleText:`${c.startStr.slice(5)} 〜 ${c.endStr.slice(5)}`, startStr:c.startStr, nextPayStr:c.nextPayStr };
}

function save() { localStorage.setItem("moneyData", JSON.stringify(data)); }

// クイック手動データ追加用
function executeAddData() { 
    const amt = Number(getV("amount")); if(!amt) { alert("金額を入力してください"); return; }
    data.push({ 
        id: Date.now(), date: getV("date") || formatStr(new Date()), time: getV("time") || "12:00", 
        timestamp: Date.now(), amount: amt, type: getV("type"), category: getV("category") || "未分類", 
        memo: getV("memo"), actionLogText: "", status: 'confirmed' 
    }); 
    save(); render(); 
    setV("amount", ""); setV("memo", ""); setV("category", ""); 
}

// ショートカット関数
function setTxt(id, txt) { const el = document.getElementById(id); if(el) el.innerText = txt; }
function getV(id) { const el = document.getElementById(id); return el ? el.value : ""; }
function setV(id, val) { const el = document.getElementById(id); if(el) el.value = val; }

// メイン描画
function render() {
    const l = document.getElementById("list"); if(l) l.innerHTML=""; 
    const c = calculateCurrentBudget(); 
    setTxt("cycle-title", `現在の実績 (${c.cycleText})`);
    syncTemplatesWithCycle(c);
    
    if(l) {
        const filtered = data.filter(d=>d.date>=c.startStr && d.date<c.nextPayStr && d.status!=='deleted' && d.status!=='skipped');
        if(filtered.length === 0) {
            l.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px;">今サイクルの記録はまだありません</div>`;
        } else {
            filtered.sort((a,b)=>(b.date+" "+b.time).localeCompare(a.date+" "+a.time)).forEach(d => {
                const p=d.status==='pending', bd=p?`<span class="badge-pending">予定</span>`:'', tc=d.type==='expense'?'var(--accent-red)':'var(--accent-green)';
                const v=document.createElement("div"); v.className=p?`item item-pending`:`item`; 
                v.innerHTML=`<div><small style="color:var(--text-muted);display:block;">${d.date} ${d.time}</small>${bd}${d.category||'未分類'} <small style="color:#9ca3af;">${d.memo?'('+d.memo+')':''}</small></div><div style="color:${p?'#8e8e93':tc};font-weight:bold;font-family:monospace;">${d.type==='expense'?'-':'+'}${d.amount.toLocaleString()}円</div>`; 
                v.onclick=()=>showDetail(d.id); l.appendChild(v);
            });
        }
    }
    setTxt("total", (c.currentBalance.toLocaleString()+"円")); 
    updateMainProgressBar(c);
}

function updateMainProgressBar(c) {
    let tIn=data.filter(d=>d.date>=c.startStr && d.date<c.nextPayStr && d.type==='income' && d.status!=='deleted' && d.status!=='skipped').reduce((s,d)=>s+d.amount,0)||1;
    
    const u=(bId,vId,aId,bM,cV)=>{ 
        let b=document.getElementById(bId); let v=document.getElementById(vId); let a=document.getElementById(aId); 
        if(!b || !v || !a) return;
        
        let used = bM - cV; 
        let textNormal = `USED: ${used.toLocaleString()}MB / MAX: ${bM.toLocaleString()}MB`;
        let textOver = `USED: ${used.toLocaleString()}MB / MAX: ${bM.toLocaleString()}MB (SWAP OVER)`;
        
        if(bM<=0 && cV<=0){
            b.style.width='0%'; b.style.background='#1f2937'; v.innerText='0%'; v.style.color='var(--text-muted)'; a.innerText=textNormal;
        }else if(cV<0){
            b.style.width='100%'; b.style.background='repeating-linear-gradient(45deg,var(--accent-red),var(--accent-red) 8px,#ff6b6b 8px,#ff6b6b 16px)';
            v.innerText='OVER'; v.style.color='var(--accent-red)'; a.innerText=textOver; a.style.color='var(--accent-red)';
        }else{
            let p=bM>0?(cV/bM)*100:100; if(p>100)p=100;
            b.style.width=p+'%'; v.innerText=Math.floor(p)+'%'; v.style.color='white';
            b.style.background=p>50?'var(--accent-green)':(p>20?'var(--accent-yellow)':'var(--accent-red)');
            a.innerText=textNormal; a.style.color='white';
        }
    };
    
    u('main-bar-day','main-val-day','main-amt-day',c.budgetForToday,c.todayBudget); 
    u('main-bar-week','main-val-week','main-amt-week',c.budgetForWeek,c.weekRemaining); 
    u('main-bar-core','main-val-core','main-amt-core',tIn,c.currentBalance);
}

// 履歴個別編集関連
function showDetail(id) { 
    const d=data.find(x=>x.id===id); if(!d)return; const p=d.status==='pending'; 
    let btns = p ? `<button class="btn btn-green" style="margin-bottom:10px;padding:14px;" onclick="confirmRecord(${id})">✅ 確定にする</button><div style="display:flex;gap:10px;"><button class="btn" style="flex:1;margin:0;" onclick="updateRecord(${id})">更新</button><button class="btn btn-muted" style="flex:1;margin:0;" onclick="skipRecord(${id})">スキップ</button></div>` : `<div style="display:flex;gap:10px;margin-bottom:10px;"><button class="btn" style="flex:2;margin:0;" onclick="updateRecord(${id})">保存</button><button class="btn btn-red" style="flex:1;margin:0;" onclick="deleteRecord(${id})">削除</button></div>`; 
    const dm = document.getElementById('detail-content');
    if(dm) {
        dm.innerHTML=`<h3 style="margin:0 0 12px;border-bottom:2px solid ${p?'#FF9500':'#007aff'};padding-bottom:5px;font-size:15px;">${p?'予定の確認':'データの編集'}</h3><div style="display:flex;gap:10px;margin-bottom:8px;"><input type="date" id="edit-date" value="${d.date}" style="flex:2;"><input type="time" id="edit-time" value="${d.time}" style="flex:1;"></div><select id="edit-type" style="margin-bottom:8px;"><option value="expense" ${d.type==='expense'?'selected':''}>支出</option><option value="income" ${d.type==='income'?'selected':''}>収入</option></select><input type="number" id="edit-amount" value="${d.amount}" inputmode="numeric" style="margin-bottom:8px;"><input type="text" id="edit-category" value="${d.category||''}" style="margin-bottom:8px;" placeholder="カテゴリ"><input type="text" id="edit-memo" value="${d.memo||''}" style="margin-bottom:8px;" placeholder="メモ"><textarea id="edit-actionlog" style="font-size:12px;width:100%;height:60px;margin-top:5px;margin-bottom:10px;" placeholder="システムログ（ステルスデータ）">${d.actionLogText||''}</textarea>${btns}<button class="btn btn-muted" onclick="document.getElementById('detail-modal').style.display='none'">閉じる</button>`; 
        document.getElementById('detail-modal').style.display='flex';
    }
}
function updateRecord(id) { 
    const i=data.findIndex(x=>x.id===id); if(i===-1)return; 
    data[i].date=getV('edit-date'); data[i].time=getV('edit-time'); data[i].type=getV('edit-type'); data[i].amount=Number(getV('edit-amount')); data[i].category=getV('edit-category'); data[i].memo=getV('edit-memo'); data[i].actionLogText=getV('edit-actionlog'); 
    save(); render(); document.getElementById('detail-modal').style.display='none'; 
}
function confirmRecord(id) { const i=data.findIndex(x=>x.id===id); if(i===-1)return; updateRecord(id); data[i].status='confirmed'; save(); render(); }
function skipRecord(id) { const i=data.findIndex(x=>x.id===id); if(i===-1)return; data[i].status='skipped'; save(); render(); document.getElementById('detail-modal').style.display='none'; }
function deleteRecord(id) { if(!confirm("削除しますか？"))return; const i=data.findIndex(x=>x.id===id); if(data[i].templateId)data[i].status='deleted'; else data.splice(i,1); save(); render(); document.getElementById('detail-modal').style.display='none'; }

// 店舗プリセット処理
function editStoreUI(id) { 
    const s=stores.find(x=>x.id==id); if(!s)return; 
    setV('edit-store-id', s.id); setV('store-name', s.name); setV('price-a', s.a); setV('price-b', s.b);
    const sb = document.getElementById('store-save-btn'); if(sb) sb.innerText="保存"; 
    const cb = document.getElementById('store-cancel-btn'); if(cb) cb.style.display="block"; 
    window.scrollTo({top:0,behavior:'smooth'});
}
function cancelEditStore() { 
    ['edit-store-id','store-name','price-a','price-b'].forEach(k => setV(k, ""));
    const sb = document.getElementById('store-save-btn'); if(sb) sb.innerText="新規追加"; 
    const cb = document.getElementById('store-cancel-btn'); if(cb) cb.style.display="none"; 
}
function saveStore() { 
    const id=getV('edit-store-id'), name=getV('store-name'), a=Number(getV('price-a')), b=Number(getV('price-b')); if(!name)return; 
    if(id){stores[stores.findIndex(s=>s.id==id)]={id:Number(id),name,a,b};}else{stores.push({id:Date.now(),name,a,b});} 
    localStorage.setItem("storePresets",JSON.stringify(stores)); updateStoreUI(); updateStoreSelect(); cancelEditStore(); 
}
function updateStoreSelect() { 
    const sel=document.getElementById('active-project-id'); if(!sel) return;
    const prev=sel.value; sel.innerHTML='<option value="">-- 対象製品ラインを選択 --</option>'+stores.map(s=>`<option value="${s.id}">${s.name}</option>`).join(''); if(prev)sel.value=prev; 
}
function updateStoreUI() { 
    const sui = document.getElementById('store-list-ui'); if(!sui) return;
    sui.innerHTML=stores.map(s=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #334155;"><div><b style="font-size:15px;color:white;">${s.name}</b><small style="color:var(--text-muted); margin-left:6px;">(D1:${s.a} D2:${s.b})</small></div><div style="display:flex; gap:6px;"><button onclick="editStoreUI(${s.id})" style="background:#007aff;color:white;border:none;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:bold;">編集</button><button onclick="if(confirm('削除しますか？')){stores=stores.filter(x=>x.id!=${s.id});localStorage.setItem('storePresets',JSON.stringify(stores));updateStoreUI();updateStoreSelect();}" style="background:var(--accent-red);color:white;border:none;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:bold;">✖</button></div></div>`).join(''); 
}

// ステルスターミナルオペレーション
function handleProjectSelection() { 
    const sel = document.getElementById('active-project-id'); if(!sel) return;
    activeStore=stores.find(s=>s.id==sel.value); 
    if(activeStore){ 
        const atArea = document.getElementById('active-terminal-area'); if(atArea) atArea.style.display = 'block';
        setTxt('label-price-a', activeStore.a); setTxt('label-price-b', activeStore.b);
        mDCount=0; mFCount=0; mTotal=0; actionLog=[]; updateTDisplay(); 
    }else{ 
        const atArea = document.getElementById('active-terminal-area'); if(atArea) atArea.style.display = 'none';
        localStorage.removeItem("terminalDraft"); activeStore=null;
    } 
}
function saveTerminalDraft() { if(activeStore)localStorage.setItem("terminalDraft",JSON.stringify({activeStore,mDCount,mFCount,mTotal,actionLog,currentExtraMode})); }
function loadTerminalDraft() { const d=JSON.parse(localStorage.getItem("terminalDraft")); if(d&&d.activeStore){activeStore=d.activeStore;mDCount=d.mDCount||0;mFCount=d.mFCount||0;mTotal=d.mTotal||0;actionLog=d.actionLog||[];currentExtraMode=d.currentExtraMode||'D'; updateStoreSelect(); const sel=document.getElementById('active-project-id'); if(sel)sel.value=activeStore.id; const atArea=document.getElementById('active-terminal-area'); if(atArea)atArea.style.display='block'; setTxt('label-price-a',activeStore.a); setTxt('label-price-b',activeStore.b); updateTDisplay();} }
const getT=()=>`${String(new Date().getHours()).padStart(2,'0')}:${String(new Date().getMinutes()).padStart(2,'0')}`;

function commitTaskA() { if(!activeStore)return; mDCount++; mTotal+=activeStore.a; actionLog.push({id:Date.now(),time:getT(),cost:activeStore.a,d:1,f:0,label:'Task A(D)'}); updateTDisplay(); logT('TASK A'); }
function commitTaskB() { if(!activeStore)return; mDCount++; mTotal+=activeStore.b; actionLog.push({id:Date.now(),time:getT(),cost:activeStore.b,d:1,f:0,label:'Task B(D)'}); updateTDisplay(); logT('TASK B'); }
function selectTaskF() { const btf = document.getElementById('btn-task-f'); if(btf) btf.classList.add('active-f'); logT('AWAITING NUM'); }
function commitNum(v) { if(!activeStore)return; const c=v*100; mFCount++; mTotal+=c; actionLog.push({id:Date.now(),time:getT(),cost:c,d:0,f:1,label:`Task F(${v})`}); updateTDisplay(); logT('TASK F'); }
function setExtraMode(m) { currentExtraMode=m; const emd = document.getElementById('ext-btn-d'); if(emd) emd.className=m==='D'?'term-btn style-btn active-d':'term-btn style-btn'; const emf = document.getElementById('ext-btn-f'); if(emf) emf.className=m==='F'?'term-btn style-btn active-f':'term-btn style-btn'; saveTerminalDraft(); }
function addExtra() { const v=Number(getV('extra-cost')); if(!v)return; let iD=currentExtraMode==='D'?1:0, iF=currentExtraMode==='F'?1:0; if(iD)mDCount++; if(iF)mFCount++; mTotal+=v; actionLog.push({id:Date.now(),time:getT(),cost:v,d:iD,f:iF,label:`Extra(${currentExtraMode})`}); setV("extra-cost",""); updateTDisplay(); logT('EXTRA'); }
function addStealthMemo() { const t=getV('stealth-memo-input'); if(!t)return; actionLog.push({id:Date.now(),time:getT(),cost:0,d:0,f:0,label:`【メモ】${t}`}); setV("stealth-memo-input",""); updateTDisplay(); logT('MEMO'); }
function undoLast() { const l=actionLog.pop(); if(!l)return; mDCount-=l.d; mFCount-=l.f; mTotal-=l.cost; updateTDisplay(); logT("UNDO"); }
function removeActionById(id) { const i=actionLog.findIndex(a=>a.id===id); if(i>-1){const t=actionLog[i];actionLog.splice(i,1);mDCount-=t.d;mFCount-=t.f;mTotal-=t.cost;updateTDisplay();} }
function editActionById(id) { const a=actionLog.find(x=>x.id===id); if(!a)return; setV('stealth-edit-id',id); setV('stealth-edit-label',a.label); setV('stealth-edit-cost',a.cost); const sem=document.getElementById('stealth-edit-modal'); if(sem)sem.style.display='flex'; }
function saveActionEdit() { const id=Number(getV('stealth-edit-id')), a=actionLog.find(x=>x.id===id); if(!a)return; const l=getV('stealth-edit-label'), c=Number(getV('stealth-edit-cost')); mTotal=mTotal-a.cost+c; a.label=l; a.cost=c; document.getElementById('stealth-edit-modal').style.display='none'; updateTDisplay(); }

function updateProgressBar() {
    let c=calculateCurrentBudget(); 
    let tIn=data.filter(d=>d.date>=c.startStr&&d.date<c.nextPayStr&&d.type==='income'&&d.status!=='deleted'&&d.status!=='skipped').reduce((s,d)=>s+d.amount,0)||1;
    
    const u=(bId,vId,aId,bM,cR,cS)=>{
        let b=document.getElementById(bId); let v=document.getElementById(vId); let a=document.getElementById(aId);
        if(!b || !v || !a) return;
        
        let fR=cR-cS;
        let used = bM - fR;
        let textNormal = `USED: ${used.toLocaleString()}MB / MAX: ${bM.toLocaleString()}MB`;
        let textOver = `USED: ${used.toLocaleString()}MB / MAX: ${bM.toLocaleString()}MB (SWAP OVER)`;
        
        if(bM<=0 && fR<=0){
            b.style.width='0%'; b.style.background='#1f2937'; v.innerText='0%'; v.style.color='var(--text-muted)'; a.innerText=textNormal;
        }else if(fR<0){
            b.style.width='100%'; b.style.background='repeating-linear-gradient(45deg,var(--accent-red),var(--accent-red) 8px,#ff6b6b 8px,#ff6b6b 16px)';
            v.innerText='OVER'; v.style.color='var(--accent-red)'; a.innerText=textOver; a.style.color='var(--accent-red)';
        }else{
            let p=bM>0?(fR/bM)*100:100; if(p>100)p=100;
            b.style.width=p+'%'; v.innerText=Math.floor(p)+'%'; v.style.color='white';
            b.style.background=p>50?'var(--accent-green)':(p>20?'var(--accent-yellow)':'var(--accent-red)');
            a.innerText=textNormal; a.style.color='white';
        }
    };
    
    // ターミナル用進捗メーターの更新
    u('bar-day','val-day','amt-day',c.budgetForToday,c.todayBudget,mTotal); 
    u('bar-week','val-week','amt-week',c.budgetForWeek,c.weekRemaining,mTotal); 
    u('bar-core','val-core','amt-core',tIn,c.currentBalance,mTotal);
}

function updateTDisplay() { 
    setTxt('mock-d-count', mDCount); setTxt('mock-f-count', mFCount); setTxt('mock-total-val', mTotal.toLocaleString()); 
    updateProgressBar();
    const l=document.getElementById('action-log-list'); if(!l) return;
    l.innerHTML=""; const ala = document.getElementById('action-log-area'); if(ala) ala.style.display=actionLog.length?'block':'none'; 
    for(let i=actionLog.length-1;i>=0;i--){ 
        const a=actionLog[i]; 
        l.innerHTML+=`<div class="action-log-item"><div><span style="color:#64748b;margin-right:8px;">${a.time}</span><b>${a.label}</b></div><div style="display:flex;align-items:center;gap:6px;">${a.cost>0?'+'+a.cost.toLocaleString():''}<button onclick="editActionById(${a.id})" style="background:#007aff;color:white;border:none;border-radius:4px;padding:4px;font-size:10px;">✎</button><button onclick="removeActionById(${a.id})" style="background:none;border:none;color:var(--accent-red);font-weight:bold;padding:0 4px;">✖</button></div></div>`; 
    } 
    saveTerminalDraft(); 
}
function logT(m) { const e=document.getElementById('log-msg'); if(!e) return; e.innerHTML=`STATUS: ${m}<br>READY`; setTimeout(()=>{if(e)e.innerHTML="SYSTEM: STANDBY<br>AWAITING INPUT..."},1500); }

function showCheckout() { const cm = document.getElementById('checkout-modal'); if(cm) cm.style.display='flex'; setV('final-amount', mTotal>0?mTotal:""); }
function closeCheckout() { const cm = document.getElementById('checkout-modal'); if(cm) cm.style.display='none'; }

function finishProject() { 
    const amt=Number(getV('final-amount')); if(!amt) return; 
    data.push({ 
        id:Date.now(), date:formatStr(new Date()), time:getT(), timestamp:Date.now(), 
        amount:amt, type:'expense', category:activeStore.name, 
        memo:`D:${mDCount} F:${mFCount}`, 
        actionLogText:actionLog.map(a=>`${a.time} ${a.label} ${a.cost>0?'+'+a.cost:''}`).join('\n'), 
        status:'confirmed' 
    }); 
    save(); alert("記録完了！"); closeCheckout(); localStorage.removeItem("terminalDraft"); 
    const ata = document.getElementById('active-terminal-area'); if(ata) ata.style.display='none';
    const api = document.getElementById('active-project-id'); if(api) api.value=""; 
    activeStore=null; render(); switchPage('main',document.querySelector('.tab-item')); 
}

// CSVエクスポート
function downloadCSV() {
    if (!data || data.length === 0) { alert("出力するデータがありません。"); return; }
    let csvContent = "\uFEFF日付,時間,収支,金額,カテゴリ,メモ,ステータス,詳細ログ\n";
    const sortedData = [...data].sort((a,b) => ((b.date||"") + " " + (b.time||"")).localeCompare((a.date||"") + " " + (a.time||"")));
    sortedData.forEach(d => {
        let type = d.type === 'income' ? '収入' : '支出';
        let stat = d.status === 'deleted' ? '削除' : (d.status === 'skipped' ? 'スキップ' : (d.status === 'pending' ? '予定' : '確定'));
        let cat = `"${(d.category || "").replace(/"/g, '""')}"`;
        let memo = `"${(d.memo || "").replace(/"/g, '""')}"`;
        let log = `"${(d.actionLogText || "").replace(/"/g, '""').replace(/\n/g, ' / ')}"`;
        csvContent += `${d.date||""},${d.time||""},${type},${d.amount},${cat},${memo},${stat},${log}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const today = formatStr(new Date()).replace(/-/g, '');
    const fileName = `money_data_${today}.csv`;
    const link = document.createElement("a"); const url = URL.createObjectURL(blob);
    link.setAttribute("href", url); link.setAttribute("download", fileName); link.style.display = 'none';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}



