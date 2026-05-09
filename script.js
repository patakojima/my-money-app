let isSystemAction = false;
let data = JSON.parse(localStorage.getItem("moneyData")) || [];
let stores = JSON.parse(localStorage.getItem("storePresets")) || [];
let fixedTemplates = JSON.parse(localStorage.getItem("fixedTemplates")) || [];
let activeStore = null, mDCount = 0, mFCount = 0, mTotal = 0, actionLog = [], currentExtraMode = 'D'; 

const formatStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseDate = (s) => { if(!s) return new Date(); const p = s.split('-'); return new Date(p[0], p[1]-1, p[2]); };

window.onload = () => { 
    document.getElementById("date").value = formatStr(new Date()); 
    document.getElementById('active-project-id').addEventListener('change', handleProjectSelection);
    renderTemplates(); 
    render(); 
    updateStoreUI(); 
    loadTerminalDraft(); 
};

function switchPage(pageId, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); 
    document.getElementById('page-' + pageId).classList.add('active');
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active')); 
    if(el) el.classList.add('active');
    
    document.getElementById('display-title').innerText = pageId==='main'?'MAIN_DASHBOARD':(pageId==='terminal'?'TERMINAL_OP_V7.4':'TEMPLATE_MANAGER');
    
    if(pageId === 'terminal') { 
        isSystemAction = true; 
        updateStoreSelect(); 
        if(activeStore) { 
            document.getElementById('active-project-id').value = activeStore.id; 
            document.getElementById('active-terminal-area').style.display = 'block'; 
            document.getElementById('label-price-a').innerText = activeStore.a; 
            document.getElementById('label-price-b').innerText = activeStore.b; 
            setExtraMode(currentExtraMode); 
            updateTDisplay(); 
        } 
        updateProgressBar(); 
        setTimeout(() => isSystemAction = false, 50); 
    }
}

// --- テンプレート機能 ---
function renderTemplates() { 
    document.getElementById('template-list-ui').innerHTML = fixedTemplates.sort((a,b)=>a.day-b.day).map((t,i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;padding:8px 0;border-bottom:1px dashed #eee;">
            <div><span style="color:#8e8e93;font-family:monospace;margin-right:5px;">${t.day}日</span><span style="color:${t.type==='expense'?'#dc3545':'#28a745'};font-weight:bold;">${t.type==='expense'?'[-]':'[+]'}</span> ${t.category}</div>
            <div>
                <span>${t.amount.toLocaleString()}円</span>
                <button onclick="editTemplateUI(${t.id})" style="background:#007aff;color:white;border:none;border-radius:4px;padding:3px 6px;font-size:10px;margin:0 4px;">編集</button>
                <button onclick="delTemplate(${i})" style="background:#ff3b30;color:white;border:none;border-radius:4px;padding:3px 6px;font-size:10px;">✖</button>
            </div>
        </div>
    `).join(''); 
}

function editTemplateUI(id) { 
    const t = fixedTemplates.find(x=>x.id==id); if(!t) return; 
    document.getElementById('edit-tpl-id').value=t.id; 
    document.getElementById('tpl-day').value=t.day; 
    document.getElementById('tpl-time').value=t.time||"10:00"; 
    document.getElementById('tpl-type').value=t.type; 
    document.getElementById('tpl-amount').value=t.amount; 
    document.getElementById('tpl-category').value=t.category; 
    document.getElementById('tpl-memo').value=t.memo||""; 
    document.getElementById('tpl-save-btn').innerText="保存"; 
    document.getElementById('tpl-cancel-btn').style.display="block"; 
    window.scrollTo({top:0,behavior:'smooth'}); 
}

function cancelEditTemplate() { 
    document.getElementById('edit-tpl-id').value=""; document.getElementById('tpl-day').value=""; document.getElementById('tpl-amount').value=""; document.getElementById('tpl-category').value=""; document.getElementById('tpl-memo').value=""; 
    document.getElementById('tpl-save-btn').innerText="追加"; document.getElementById('tpl-cancel-btn').style.display="none"; 
}

function saveTemplate() { 
    const id=document.getElementById('edit-tpl-id').value, day=Number(document.getElementById('tpl-day').value), time=document.getElementById('tpl-time').value||"00:00", type=document.getElementById('tpl-type').value, amount=Number(document.getElementById('tpl-amount').value), category=document.getElementById('tpl-category').value, memo=document.getElementById('tpl-memo').value; 
    if(!day||day<1||day>31||!amount||!category){alert("入力漏れがあります");return;} 
    if(id){ 
        fixedTemplates[fixedTemplates.findIndex(t=>t.id==id)]={id:Number(id),day,time,type,amount,category,memo}; 
    } else { 
        fixedTemplates.push({id:Date.now(),day,time,type,amount,category,memo}); 
    } 
    localStorage.setItem("fixedTemplates",JSON.stringify(fixedTemplates)); 
    cancelEditTemplate(); renderTemplates(); render(); 
}

function delTemplate(i) { 
    if(!confirm("削除しますか？"))return; 
    fixedTemplates.splice(i,1); 
    localStorage.setItem("fixedTemplates",JSON.stringify(fixedTemplates)); 
    renderTemplates(); 
}

// --- 予算・サイクル計算 ---
function getCycle(dObj=new Date()) { 
    const y=dObj.getFullYear(), m=dObj.getMonth(), d=dObj.getDate(), ld=new Date(y,m+1,0).getDate(); let s, e; 
    if(d===ld){ s=new Date(y,m,d); e=new Date(y,m+1,new Date(y,m+2,0).getDate()-1); }else{ s=new Date(y,m-1,new Date(y,m,0).getDate()); e=new Date(y,m,ld-1); } 
    return { startStr:formatStr(s), endStr:formatStr(e), nextPayStr:formatStr(new Date(e.getFullYear(),e.getMonth(),e.getDate()+1)), nextPayObj:new Date(e.getFullYear(),e.getMonth(),e.getDate()+1) }; 
}

function getCycleDateForDay(tDay, sStr, eStr) { 
    let c=parseDate(sStr), e=parseDate(eStr), fb=null, sc=0; 
    while(c<=e && sc<40){ 
        if(c.getDate()==tDay)return formatStr(c); 
        let n=new Date(c); n.setDate(c.getDate()+1); 
        if(c.getMonth()!==n.getMonth())fb=formatStr(c); 
        c=n; sc++; 
    } 
    return fb||formatStr(e); 
}

function syncTemplatesWithCycle(calc) {
    let u=false;
    fixedTemplates.forEach(t => {
        const tgt = getCycleDateForDay(t.day, calc.startStr, calc.endStr);
        if(!data.find(d => d.templateId===t.id && d.status!=='deleted' && d.date>=calc.startStr && d.date<calc.nextPayStr)){
            data.push({ id:Date.now()+Math.random(), templateId:t.id, date:tgt, time:t.time, timestamp:parseDate(tgt).getTime(), amount:t.amount, type:t.type, category:t.category, memo:t.memo, actionLogText:"", status:'pending' }); 
            u=true;
        }
    });
    if(u) save();
}

function calculateCurrentBudget() {
    const t=new Date(); t.setHours(0,0,0,0); const tStr=formatStr(t); const c=getCycle(t); 
    let cEx=0, cIn=0, tSp=0, tIn=0, wSp=0, wIn=0, dOfW=t.getDay(), dSM=dOfW===0?6:dOfW-1, sW=new Date(t); sW.setDate(t.getDate()-dSM); let sWStr=formatStr(sW);
    
    data.forEach(d => { 
        if(d.date>=c.startStr && d.date<c.nextPayStr && d.status!=='deleted' && d.status!=='skipped') { 
            if(d.type==='expense'){ cEx+=d.amount; if(d.date===tStr)tSp+=d.amount; if(d.date>=sWStr && d.date<=tStr)wSp+=d.amount; } 
            if(d.type==='income'){ cIn+=d.amount; if(d.date===tStr)tIn+=d.amount; if(d.date>=sWStr && d.date<=tStr)wIn+=d.amount; } 
        } 
    });
    
    let cBal=cIn-cEx, sODBal=cBal+tSp-tIn, remD=Math.ceil((c.nextPayObj.getTime()-t.getTime())/(1000*60*60*24)), bFT=remD>0?Math.floor(sODBal/remD):sODBal, tBud=bFT+tIn-tSp, aSWS=sWStr<c.startStr?c.startStr:sWStr, sWD=parseDate(aSWS), remDW=Math.ceil((c.nextPayObj.getTime()-sWD.getTime())/(1000*60*60*24)), sOWB=cBal+wSp-wIn, bPDW=remDW>0?Math.floor(sOWB/remDW):sOWB, dIW=7; 
    if(sWStr<c.startStr) dIW=7-Math.round((parseDate(c.startStr).getTime()-parseDate(sWStr).getTime())/(1000*60*60*24)); 
    let bFW=bPDW*dIW, wRem=bFW+wIn-wSp;
    
    return { currentBalance:cBal, todayBudget:tBud, weekRemaining:wRem, budgetForToday:bFT, budgetForWeek:bFW, cycleText:`${c.startStr.slice(5)} 〜 ${c.endStr.slice(5)}`, startStr:c.startStr, nextPayStr:c.nextPayStr };
}

// --- メインデータ操作 ---
function save() { localStorage.setItem("moneyData", JSON.stringify(data)); }

function addData(obj) { 
    if (obj && obj.id) { data.push(obj); save(); render(); return; }
    const a=Number(document.getElementById("amount").value); if(!a)return alert("金額を入力してください"); 
    data.push({ id:Date.now(), date:document.getElementById("date").value, time:document.getElementById("time").value||"00:00", timestamp:Date.now(), amount:a, type:document.getElementById("type").value, category:document.getElementById("category").value, memo:document.getElementById("memo").value, actionLogText:"", status:'confirmed' }); 
    save(); render(); 
    document.getElementById("amount").value=""; document.getElementById("memo").value=""; document.getElementById("category").value=""; 
}

function render() {
    const l=document.getElementById("list"); l.innerHTML=""; 
    const c=calculateCurrentBudget(); 
    document.getElementById("cycle-title").innerText=`現在の実績 (${c.cycleText})`; 
    syncTemplatesWithCycle(c);
    
    data.filter(d=>d.date>=c.startStr && d.date<c.nextPayStr && d.status!=='deleted' && d.status!=='skipped').sort((a,b)=>(b.date+" "+b.time).localeCompare(a.date+" "+a.time)).forEach(d => {
        const p=d.status==='pending', cl=p?`item item-pending`:`item ${d.type}`, bd=p?`<span class="badge-pending">予定</span>`:'', tc=d.type==='expense'?'#dc3545':'#28a745';
        const v=document.createElement("div"); v.className=cl; 
        v.innerHTML=`<div><small style="color:#999;display:block;">${d.date} ${d.time}</small>${bd}${d.category||'未分類'} <small style="color:#666;">${d.memo?'('+d.memo+')':''}</small></div><div style="color:${p?'#8e8e93':tc};font-weight:bold;">${d.type==='expense'?'-':'+'}${d.amount.toLocaleString()}円</div>`; 
        v.onclick=()=>showDetail(d.id); l.appendChild(v);
    });
    
    document.getElementById("total").innerText=c.currentBalance.toLocaleString()+"円"; 
    document.getElementById("todayBudget").innerText=(c.todayBudget>0?c.todayBudget.toLocaleString():0)+"円"; 
    document.getElementById("weekRemaining").innerText=(c.weekRemaining>0?c.weekRemaining.toLocaleString():0)+"円"; 
    updateMainProgressBar(c);
}

function updateMainProgressBar(c) {
    let tIn=data.filter(d=>d.date>=c.startStr && d.date<c.nextPayStr && d.type==='income' && d.status!=='deleted' && d.status!=='skipped').reduce((s,d)=>s+d.amount,0)||1;
    const u=(bId,vId,aId,mV,cV)=>{ 
        let b=document.getElementById(bId),v=document.getElementById(vId),a=document.getElementById(aId); 
        if(mV<=0&&cV<=0){
            b.style.width='0%';b.style.background='#e5e5ea';v.innerText='0%';v.style.color='#8e8e93';a.innerText='0円';a.style.color='#8e8e93';
        }else if(cV<0){
            b.style.width='100%';b.style.background='repeating-linear-gradient(45deg,#ff3b30,#ff3b30 8px,#ff6b6b 8px,#ff6b6b 16px)';v.innerText='OVER';v.style.color='#ff3b30';a.innerText=cV.toLocaleString()+'円';a.style.color='#ff3b30';
        }else{
            let p=mV>0?(cV/mV)*100:100;if(p>100)p=100;
            b.style.width=p+'%';v.innerText=Math.floor(p)+'%';v.style.color='#1c1c1e';b.style.background=p>50?'#34C759':(p>20?'#FFCC00':'#FF3B30');a.innerText=cV.toLocaleString()+'円';a.style.color='#1c1c1e';
        }
    };
    u('main-bar-day','main-val-day','main-amt-day',c.budgetForToday,c.todayBudget); 
    u('main-bar-week','main-val-week','main-amt-week',c.budgetForWeek,c.weekRemaining); 
    u('main-bar-core','main-val-core','main-amt-core',tIn,c.currentBalance);
}

// --- 詳細編集・モーダル関連 ---
function showDetail(id) {
    const d=data.find(x=>x.id===id); if(!d)return; const p=d.status==='pending';
    let btns = p ? `<button class="main-btn" style="background:#34C759;margin-bottom:10px;padding:16px;" onclick="confirmRecord(${id})">✅ 確定にする</button><div style="display:flex;gap:10px;"><button class="main-btn" style="flex:1;" onclick="updateRecord(${id})">更新</button><button class="main-btn" style="flex:1;background:#8e8e93;" onclick="skipRecord(${id})">スキップ</button></div>` : `<button class="main-btn" onclick="updateRecord(${id})">保存</button><button class="main-btn" style="background:#ff3b30;" onclick="deleteRecord(${id})">削除</button>`;
    document.getElementById('detail-content').innerHTML=`<h3 style="margin:0 0 10px;border-bottom:2px solid ${p?'#FF9500':'#007aff'};padding-bottom:5px;">${p?'予定の確認':'データの編集'}</h3><div style="display:flex;gap:10px;"><input type="date" id="edit-date" value="${d.date}" style="flex:2;"><input type="time" id="edit-time" value="${d.time}" style="flex:1;"></div><select id="edit-type"><option value="expense" ${d.type==='expense'?'selected':''}>支出</option><option value="income" ${d.type==='income'?'selected':''}>収入</option></select><input type="number" id="edit-amount" value="${d.amount}" inputmode="numeric"><input type="text" id="edit-category" value="${d.category||''}"><input type="text" id="edit-memo" value="${d.memo||''}"><textarea id="edit-actionlog" style="font-size:12px;width:100%;height:60px;margin-top:10px;">${d.actionLogText||''}</textarea>${btns}<button class="main-btn" style="background:#ccc;" onclick="document.getElementById('detail-modal').style.display='none'">閉じる</button>`;
    document.getElementById('detail-modal').style.display='flex';
}

function updateRecord(id) { const i=data.findIndex(x=>x.id===id); if(i===-1)return; data[i].date=document.getElementById('edit-date').value; data[i].time=document.getElementById('edit-time').value; data[i].type=document.getElementById('edit-type').value; data[i].amount=Number(document.getElementById('edit-amount').value); data[i].category=document.getElementById('edit-category').value; data[i].memo=document.getElementById('edit-memo').value; data[i].actionLogText=document.getElementById('edit-actionlog').value; save(); render(); document.getElementById('detail-modal').style.display='none'; }
function confirmRecord(id) { const i=data.findIndex(x=>x.id===id); if(i===-1)return; updateRecord(id); data[i].status='confirmed'; save(); render(); }
function skipRecord(id) { const i=data.findIndex(x=>x.id===id); if(i===-1)return; data[i].status='skipped'; save(); render(); document.getElementById('detail-modal').style.display='none'; }
function deleteRecord(id) { if(!confirm("削除しますか？"))return; const i=data.findIndex(x=>x.id===id); if(data[i].templateId)data[i].status='deleted'; else data.splice(i,1); save(); render(); document.getElementById('detail-modal').style.display='none'; }

// --- お店管理 ---
function editStoreUI(id) { const s=stores.find(x=>x.id==id); if(!s)return; document.getElementById('edit-store-id').value=s.id; document.getElementById('store-name').value=s.name; document.getElementById('price-a').value=s.a; document.getElementById('price-b').value=s.b; document.getElementById('store-save-btn').innerText="保存"; document.getElementById('store-cancel-btn').style.display="block"; window.scrollTo({top:0,behavior:'smooth'}); }
function cancelEditStore() { document.getElementById('edit-store-id').value=""; document.getElementById('store-name').value=""; document.getElementById('price-a').value=""; document.getElementById('price-b').value=""; document.getElementById('store-save-btn').innerText="追加"; document.getElementById('store-cancel-btn').style.display="none"; }
function saveStore() { const id=document.getElementById('edit-store-id').value, name=document.getElementById('store-name').value, a=Number(document.getElementById('price-a').value), b=Number(document.getElementById('price-b').value); if(!name)return; if(id){stores[stores.findIndex(s=>s.id==id)]={id:Number(id),name,a,b};}else{stores.push({id:Date.now(),name,a,b});} localStorage.setItem("storePresets",JSON.stringify(stores)); updateStoreUI(); updateStoreSelect(); cancelEditStore(); }
function updateStoreSelect() { const w = isSystemAction; isSystemAction=true; const sel=document.getElementById('active-project-id'); const p=sel.value; sel.innerHTML='<option value="">-- 店舗 --</option>'+stores.map(s=>`<option value="${s.id}">${s.name}</option>`).join(''); if(p)sel.value=p; if(!w)setTimeout(()=>isSystemAction=false,50); }
function updateStoreUI() { document.getElementById('store-list-ui').innerHTML=stores.map(s=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;"><div><b>${s.name}</b> <small>(D1:${s.a} D2:${s.b})</small></div><div><button onclick="editStoreUI(${s.id})" style="background:#007aff;color:white;border:none;padding:4px;font-size:10px;margin-right:4px;">編集</button><button onclick="if(confirm('削除？')){stores=stores.filter(x=>x.id!=${s.id});localStorage.setItem('storePresets',JSON.stringify(stores));updateStoreUI();updateStoreSelect();}" style="background:#ff3b30;color:white;border:none;padding:4px;font-size:10px;">✖</button></div></div>`).join(''); }

// --- ターミナル（ステルス）機能 ---
function handleProjectSelection() { 
    if(isSystemAction)return; 
    activeStore=stores.find(s=>s.id==document.getElementById('active-project-id').value); 
    if(activeStore){ 
        document.getElementById('active-terminal-area').style.display='block'; 
        document.getElementById('label-price-a').innerText=activeStore.a; 
        document.getElementById('label-price-b').innerText=activeStore.b; 
        mDCount=0;mFCount=0;mTotal=0;actionLog=[]; 
        updateTDisplay(); 
        document.getElementById('btn-task-f').classList.add('active-f'); 
    }else{ 
        document.getElementById('active-terminal-area').style.display='none'; 
        localStorage.removeItem("terminalDraft"); 
        activeStore=null;mDCount=0;mFCount=0;mTotal=0;actionLog=[]; 
    } 
}
function saveTerminalDraft() { if(activeStore)localStorage.setItem("terminalDraft",JSON.stringify({activeStore,mDCount,mFCount,mTotal,actionLog,currentExtraMode})); }
function loadTerminalDraft() { const d=JSON.parse(localStorage.getItem("terminalDraft")); if(d&&d.activeStore){activeStore=d.activeStore;mDCount=d.mDCount||0;mFCount=d.mFCount||0;mTotal=d.mTotal||0;actionLog=d.actionLog||[];currentExtraMode=d.currentExtraMode||'D';} }
const getT=()=>`${String(new Date().getHours()).padStart(2,'0')}:${String(new Date().getMinutes()).padStart(2,'0')}`;

function commitTaskA() { mDCount++; mTotal+=activeStore.a; actionLog.push({id:Date.now(),time:getT(),cost:activeStore.a,d:1,f:0,label:'Task A(D)'}); updateTDisplay(); logT('TASK A'); }
function commitTaskB() { mDCount++; mTotal+=activeStore.b; actionLog.push({id:Date.now(),time:getT(),cost:activeStore.b,d:1,f:0,label:'Task B(D)'}); updateTDisplay(); logT('TASK B'); }
function selectTaskF() { document.getElementById('btn-task-f').classList.add('active-f'); logT('AWAITING NUM'); }
function commitNum(v) { const c=v*100; mFCount++; mTotal+=c; actionLog.push({id:Date.now(),time:getT(),cost:c,d:0,f:1,label:`Task F(${v})`}); updateTDisplay(); logT('TASK F'); document.getElementById('btn-task-f').classList.add('active-f'); }
function setExtraMode(m) { currentExtraMode=m; document.getElementById('ext-btn-d').className=m==='D'?'ext-btn active-d':'ext-btn'; document.getElementById('ext-btn-f').className=m==='F'?'ext-btn active-f':'ext-btn'; saveTerminalDraft(); }
function addExtra() { const v=Number(document.getElementById('extra-cost').value); if(!v)return; let iD=currentExtraMode==='D'?1:0, iF=currentExtraMode==='F'?1:0; if(iD)mDCount++; if(iF)mFCount++; mTotal+=v; actionLog.push({id:Date.now(),time:getT(),cost:v,d:iD,f:iF,label:`Extra(${currentExtraMode})`}); document.getElementById('extra-cost').value=""; updateTDisplay(); logT('EXTRA'); }
function addStealthMemo() { const t=document.getElementById('stealth-memo-input').value; if(!t)return; actionLog.push({id:Date.now(),time:getT(),cost:0,d:0,f:0,label:`【メモ】${t}`}); document.getElementById('stealth-memo-input').value=""; updateTDisplay(); logT('MEMO'); }
function undoLast() { const l=actionLog.pop(); if(!l)return; mDCount-=l.d; mFCount-=l.f; mTotal-=l.cost; updateTDisplay(); logT("UNDO"); }
function removeActionById(id) { const i=actionLog.findIndex(a=>a.id===id); if(i>-1){const t=actionLog[i];actionLog.splice(i,1);mDCount-=t.d;mFCount-=t.f;mTotal-=t.cost;updateTDisplay();} }
function editActionById(id) { const a=actionLog.find(x=>x.id===id); if(!a)return; document.getElementById('stealth-edit-id').value=id; document.getElementById('stealth-edit-label').value=a.label; document.getElementById('stealth-edit-cost').value=a.cost; document.getElementById('stealth-edit-modal').style.display='flex'; }
function saveActionEdit() { const id=Number(document.getElementById('stealth-edit-id').value), a=actionLog.find(x=>x.id===id); if(!a)return; const nL=document.getElementById('stealth-edit-label').value, nC=Number(document.getElementById('stealth-edit-cost').value); mTotal=mTotal-a.cost+nC; a.label=nL; a.cost=nC; document.getElementById('stealth-edit-modal').style.display='none'; updateTDisplay(); }

function updateProgressBar() {
    let c=calculateCurrentBudget(); let tIn=data.filter(d=>d.date>=c.startStr&&d.date<c.nextPayStr&&d.type==='income'&&d.status!=='deleted'&&d.status!=='skipped').reduce((s,d)=>s+d.amount,0)||1;
    const u=(bId,vId,aId,bM,cR,cS)=>{
        let b=document.getElementById(bId),v=document.getElementById(vId),a=document.getElementById(aId),fR=cR-cS;
        if(bM<=0&&fR<=0){b.style.width='0%';b.style.background='#e5e5ea';v.innerText='0%';v.style.color='#8e8e93';a.innerText='0円';a.style.color='#8e8e93';}
        else if(fR<0){b.style.width='100%';b.style.background='repeating-linear-gradient(45deg,#ff3b30,#ff3b30 8px,#ff6b6b 8px,#ff6b6b 16px)';v.innerText='OVER';v.style.color='#ff3b30';a.innerText=fR.toLocaleString()+'円';a.style.color='#ff3b30';}
        else{let p=bM>0?(fR/bM)*100:100;if(p>100)p=100;b.style.width=p+'%';v.innerText=Math.floor(p)+'%';v.style.color='#1c1c1e';b.style.background=p>50?'#34C759':(p>20?'#FFCC00':'#FF3B30');a.innerText=fR.toLocaleString()+'円';a.style.color='#1c1c1e';}
    };
    u('bar-day','val-day','amt-day',c.budgetForToday,c.todayBudget,mTotal); 
    u('bar-week','val-week','amt-week',c.budgetForWeek,c.weekRemaining,mTotal); 
    u('bar-core','val-core','amt-core',tIn,c.currentBalance,mTotal);
}

function updateTDisplay() { 
    document.getElementById('mock-d-count').innerText=mDCount; document.getElementById('mock-f-count').innerText=mFCount; document.getElementById('mock-total-val').innerText=mTotal.toLocaleString(); 
    updateProgressBar(); 
    const l=document.getElementById('action-log-list'); l.innerHTML=""; document.getElementById('action-log-area').style.display=actionLog.length?'block':'none'; 
    for(let i=actionLog.length-1;i>=0;i--){ 
        const a=actionLog[i]; 
        l.innerHTML+=`<div class="action-log-item"><div><span style="color:#aaa;margin-right:8px;">${a.time}</span><b>${a.label}</b></div><div style="display:flex;align-items:center;gap:6px;">${a.cost>0?'+'+a.cost:''}<button onclick="editActionById(${a.id})" style="background:#007aff;color:white;border:none;border-radius:4px;padding:4px;font-size:10px;">✎</button><button class="action-log-del" onclick="removeActionById(${a.id})">✖</button></div></div>`; 
    } 
    saveTerminalDraft(); 
}
function logT(m) { const e=document.getElementById('log-msg'); e.innerHTML=`STATUS: ${m}<br>READY`; setTimeout(()=>e.innerHTML="SYSTEM: STANDBY<br>AWAITING INPUT...",1500); }

function showCheckout() { document.getElementById('checkout-modal').style.display='flex'; document.getElementById('final-amount').value=mTotal>0?mTotal:""; }
function closeCheckout() { document.getElementById('checkout-modal').style.display='none'; }

function finishProject() { 
    const amt=Number(document.getElementById('final-amount').value); if(!amt) return; 
    addData({ 
        id:Date.now(), date:formatStr(new Date()), time:getT(), timestamp:Date.now(), 
        amount:amt, type:'expense', category:activeStore.name, 
        memo:`D:${mDCount} F:${mFCount}`, 
        actionLogText:actionLog.map(a=>`${a.time} ${a.label} ${a.cost>0?'+'+a.cost:''}`).join('\n'), 
        status:'confirmed' 
    }); 
    alert("記録完了！"); closeCheckout(); localStorage.removeItem("terminalDraft"); 
    document.getElementById('active-terminal-area').style.display='none'; document.getElementById('active-project-id').value=""; activeStore=null; cancelEditStore(); 
    switchPage('main',document.querySelector('.tab-item')); 
}


