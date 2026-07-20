// ==========================================
// V2 Core State & Initialization
// ==========================================
let isSystemAction = false;
let data = JSON.parse(localStorage.getItem("moneyData")) || [];
let stores = JSON.parse(localStorage.getItem("storePresets")) || [];
let fixedTemplates = JSON.parse(localStorage.getItem("fixedTemplates")) || [];
let customEnds = JSON.parse(localStorage.getItem("customCycleEnds")) || {};
let customStarts = JSON.parse(localStorage.getItem("customCycleStarts")) || {}; 

// V2 State (条件分岐徹底チェックによるデータ防衛)
let v2_status = JSON.parse(localStorage.getItem("v2_status")) || {
    ticketRemaining: 5, ticketMax: 5, ticketBaseAmount: 2500,
    foodDeposit: 30000, foodDepositMax: 30000,
    drinkDeposit: 10000, drinkDepositMax: 10000
};
let vault_accounts = JSON.parse(localStorage.getItem("vault_accounts")) || [
    {id: "v_cash", name: "財布の現金", balance: 0},
    {id: "v_bank", name: "メイン銀行", balance: 0}
];
let activeStore = null, mDCount = 0, mFCount = 0, mTotal = 0, actionLog = [], currentExtraMode = 'D';
const formatStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseDate = (s) => { if(!s) return new Date(); const p = s.split('-'); return new Date(p[0], p[1]-1, p[2]); };

function saveV2() { localStorage.setItem("v2_status", JSON.stringify(v2_status)); }
function saveVault() { localStorage.setItem("vault_accounts", JSON.stringify(vault_accounts)); }
function save() { localStorage.setItem("moneyData", JSON.stringify(data)); }

window.onload = () => { 
    const dateEl = document.getElementById("date");
    if(dateEl) dateEl.value = formatStr(new Date()); 
    const sel = document.getElementById('active-project-id');
    if(sel) sel.addEventListener('change', handleProjectSelection);
    
    const typeSel = document.getElementById("type");
    if(typeSel) {
        typeSel.addEventListener("change", (e) => {
            const esC = document.getElementById("expense-source-container");
            if(esC) esC.style.display = e.target.value === 'expense' ? 'block' : 'none';
        });
    }

    initStealthEvents();
    checkEnvironment();
    loadV2ConfigUI();
    renderVault();
    renderTemplates(); 
    render(); 
    updateStoreUI(); 
    loadTerminalDraft(); 
};

// ==========================================
// Navigation & Core Logic
// ==========================================
function switchPage(pageId, el) {
    try {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const targetPage = document.getElementById('page-' + pageId);
        if(targetPage) targetPage.classList.add('active');
        
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active')); 
        if(el) el.classList.add('active');
        let titles = {'main':'MAIN_DASHBOARD', 'terminal':'TERMINAL_OP_V2.0', 'fixed':'司令部 (FIXD)', 'vault':'金庫室 (VAULT)'};
        const titleEl = document.getElementById('display-title');
        if(titleEl) titleEl.innerText = titles[pageId] || '';
        if(pageId === 'terminal') { 
            isSystemAction = true; updateStoreSelect();
            if(activeStore) { 
                const apId = document.getElementById('active-project-id');
                if(apId) apId.value = activeStore.id; 
                const ata = document.getElementById('active-terminal-area'); if(ata) ata.style.display = 'block'; 
                const la = document.getElementById('label-price-a'); if(la) la.innerText = activeStore.a;
                const lb = document.getElementById('label-price-b'); if(lb) lb.innerText = activeStore.b; 
                setExtraMode(currentExtraMode); updateTDisplay();
            } 
            updateMainProgressBar(); setTimeout(() => isSystemAction = false, 50);
        } else {
            if(pageId === 'fixed') loadV2ConfigUI();
            if(pageId === 'vault') renderVault();
            updateMainProgressBar();
        }
    } catch(e) { console.error("Navigation Error:", e); }
}

// Stealth Events
let stealthTimer;
function initStealthEvents() {
    const area = document.getElementById('stealth-trigger-area');
    const disp = document.getElementById('stealth-display');
    if(!area || !disp) return;
    const show = () => { stealthTimer = setTimeout(() => { disp.style.display='block'; }, 400); };
    const hide = () => { clearTimeout(stealthTimer); disp.style.display='none'; };
    
    area.addEventListener('mousedown', show);
    area.addEventListener('mouseup', hide);
    area.addEventListener('mouseleave', hide);
    area.addEventListener('touchstart', show, {passive:true});
    area.addEventListener('touchend', hide);
    area.addEventListener('touchcancel', hide);
}

// Vault Logic
function renderVault() {
    let total = 0;
    const listUi = document.getElementById('vault-list-ui');
    if(!listUi) return;
    listUi.innerHTML = vault_accounts.map(v => {
        total += Number(v.balance) || 0;
        return `
        <div class="vault-item">
            <div style="flex:1; font-weight:bold; color:#1c1c1e;">${v.name}</div>
            <div style="display:flex; gap:8px; align-items:center;">
                <input type="number" class="vault-input" inputmode="numeric" value="${v.balance}" onchange="updateVaultBalance('${v.id}', this.value)">
                <button class="main-btn" style="background:#ff3b30; padding:12px; margin:0; width:45px; display:flex; justify-content:center; align-items:center;" onclick="removeVault('${v.id}')">✖</button>
            </div>
        </div>
        `;
    }).join('');
    const vt = document.getElementById('vault-total');
    if(vt) vt.innerText = "¥" + total.toLocaleString();
}
function addVault() {
    const nameInput = document.getElementById('new-vault-name');
    if(!nameInput || !nameInput.value) return;
    vault_accounts.push({ id: 'v_'+Date.now(), name: nameInput.value, balance: 0 });
    nameInput.value = '';
    saveVault(); renderVault(); render();
}
function updateVaultBalance(id, val) {
    const v = vault_accounts.find(x => x.id === id);
    if(v) { v.balance = Number(val) || 0; saveVault(); renderVault(); render(); }
}
function removeVault(id) {
    if(!confirm("削除しますか？")) return;
    vault_accounts = vault_accounts.filter(x => x.id !== id);
    saveVault(); renderVault(); render();
}

// Sync & Calc Logic
function calcAppBalance() {
    return data.filter(d => d.status === 'confirmed')
               .reduce((sum, d) => sum + (d.type === 'income' ? d.amount : -d.amount), 0);
}
function calcVaultTotal() { return vault_accounts.reduce((s, v) => s + (Number(v.balance) || 0), 0); }

function updateMainView() {
    const appBal = calcAppBalance();
    const vTotal = calcVaultTotal();
    const diff = vTotal - appBal;
    const syncWarn = document.getElementById('sync-warning');
    if(syncWarn) {
        if (diff !== 0) {
            syncWarn.style.display = 'block';
            document.getElementById('sync-diff-text').innerText = `⚠️ 現実とのズレ: ${diff > 0 ? '+' : ''}${diff.toLocaleString()}円`;
        } else {
            syncWarn.style.display = 'none';
        }
    }

    const tInd = document.getElementById('ticket-indicator');
    if(tInd) {
        tInd.innerHTML = '';
        let ticketRatio = (v2_status.ticketRemaining / v2_status.ticketMax) * 100;
        let colorClass = 'ticket-color-safe';
        if (ticketRatio < 30) colorClass = 'ticket-color-critical';
        else if (ticketRatio < 60) colorClass = 'ticket-color-warn';
        for(let i=0; i<v2_status.ticketMax; i++) {
            const isAvail = i < v2_status.ticketRemaining;
            tInd.innerHTML += `<div style="width:28px; height:12px; border-radius:4px; background:${isAvail ? 'var(--drink)' : '#e5e5ea'}; box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);" class="${isAvail ? colorClass : ''}"></div>`;
        }
    }

    const stF = document.getElementById('st-food');
    if(stF) stF.innerText = (v2_status.foodDeposit||0).toLocaleString();
    const stD = document.getElementById('st-drink'); if(stD) stD.innerText = (v2_status.drinkDeposit||0).toLocaleString();
}

function syncRealCash() {
    const diff = calcVaultTotal() - calcAppBalance();
    if (diff === 0) return;
    const type = diff > 0 ? 'income' : 'expense';
    const amt = Math.abs(diff);
    data.push({
        id: Date.now(), date: formatStr(new Date()), time: getT(), timestamp: Date.now(),
        amount: amt, type: type, category: '使途不明金', memo: '現金過不足 / SYNCHRONIZE',
        actionLogText: '', status: 'confirmed'
    });
    save(); render();
}

// V2 Config (FIXD)
function loadV2ConfigUI() {
    const tBase = document.getElementById('cfg-t-base'); if(tBase) tBase.value = v2_status.ticketBaseAmount;
    const tMax = document.getElementById('cfg-t-max'); if(tMax) tMax.value = v2_status.ticketMax;
    const tRem = document.getElementById('cfg-t-rem'); if(tRem) tRem.value = v2_status.ticketRemaining;
    const fPool = document.getElementById('cfg-f-pool');
    if(fPool) fPool.value = v2_status.foodDeposit;
    const dPool = document.getElementById('cfg-d-pool'); if(dPool) dPool.value = v2_status.drinkDeposit;
}
function saveV2Config() {
    v2_status.ticketBaseAmount = Number(document.getElementById('cfg-t-base').value) || 2500;
    v2_status.ticketMax = Number(document.getElementById('cfg-t-max').value) || 5;
    v2_status.ticketRemaining = Number(document.getElementById('cfg-t-rem').value) || 0;
    v2_status.foodDeposit = Number(document.getElementById('cfg-f-pool').value) || 0;
    v2_status.drinkDeposit = Number(document.getElementById('cfg-d-pool').value) || 0;
    
    v2_status.foodDepositMax = v2_status.foodDeposit;
    v2_status.drinkDepositMax = v2_status.drinkDeposit;
    if(v2_status.ticketRemaining > v2_status.ticketMax) v2_status.ticketRemaining = v2_status.ticketMax;
    saveV2(); render();
    alert("防衛ライン（設定）を更新しました！");
}
function transferFund() {
    const amt = Number(prompt("食費POOLから飲み代POOLへ移管する金額を入力してください:", "3000"));
    if(!amt || amt <= 0) return;
    
    v2_status.foodDeposit -= amt;
    v2_status.drinkDeposit += amt;
    saveV2();
    data.push({
        id: Date.now(), date: formatStr(new Date()), time: getT(), timestamp: Date.now(),
        amount: 0, type: 'expense', category: '資金繰り', memo: `FOOD ➔ DRINK (¥${amt.toLocaleString()})`,
        actionLogText: '', status: 'confirmed'
    });
    save(); loadV2ConfigUI(); render();
    alert(`¥${amt.toLocaleString()} を移管しました。`);
}

function showCycleEditModal() { 
    let c = getCycle(new Date()); 
    document.getElementById('cycle-edit-key').value = c.cycleKey;
    document.getElementById('cycle-edit-start-date').value = c.startStr;
    document.getElementById('cycle-edit-date').value = c.endStr; 
    document.getElementById('cycle-edit-modal').style.display = 'flex'; 
}
function closeCycleEditModal() { document.getElementById('cycle-edit-modal').style.display = 'none'; }
function saveCycleEnd() { 
    let key = document.getElementById('cycle-edit-key').value;
    let sStr = document.getElementById('cycle-edit-start-date').value;
    let dStr = document.getElementById('cycle-edit-date').value;
    if(!sStr || !dStr) return; 
    customStarts[key] = sStr; customEnds[key] = dStr; 
    localStorage.setItem("customCycleStarts", JSON.stringify(customStarts));
    localStorage.setItem("customCycleEnds", JSON.stringify(customEnds)); 
    closeCycleEditModal(); render();
}
function resetCycleEnd() { 
    let key = document.getElementById('cycle-edit-key').value; 
    delete customStarts[key]; delete customEnds[key]; 
    localStorage.setItem("customCycleStarts", JSON.stringify(customStarts));
    localStorage.setItem("customCycleEnds", JSON.stringify(customEnds)); 
    closeCycleEditModal();
    render(); 
}

function renderTemplates() { 
    const ui = document.getElementById('template-list-ui');
    if(!ui) return;
    
    // 【修正箇所】 テンプレートのカテゴリ横にメモ（(メモ内容)の形式）を表示するように追加
    ui.innerHTML = fixedTemplates.sort((a,b)=>a.day-b.day).map((t,i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;padding:10px 0;border-bottom:1px dashed #eee;">
            <div>
                <span style="color:#8e8e93;font-family:monospace;margin-right:5px;">${t.day}日</span>
                <span style="color:${t.type==='expense'?'#dc3545':'#28a745'};font-weight:bold;">${t.type==='expense'?'[-]':'[+]'}</span> 
                ${t.category} 
                ${t.memo ? `<div style="font-size:12px; color:#666; margin-top:4px; margin-left: 28px;">(${t.memo})</div>` : ''}
            </div>
            <div style="display:flex; gap:6px; align-items:center; flex-shrink: 0;">
                <span style="margin-right:6px; font-weight:bold;">${t.amount.toLocaleString()}円</span>
                <button class="main-btn" onclick="editTemplateUI(${t.id})" style="background:#007aff;color:white;border:none;border-radius:6px;padding:6px 10px;font-size:10px;margin:0;">編集</button>
                <button class="main-btn" onclick="delTemplate(${i})" style="background:#ff3b30;color:white;border:none;border-radius:6px;padding:6px 10px;font-size:10px;margin:0;">✖</button>
            </div>
        </div>
    `).join('');
}

// FIXED: テンプレート編集時に入力コンテナへジャンプ
function editTemplateUI(id) { 
    const t = fixedTemplates.find(x=>x.id==id); 
    if(!t) return; 
    document.getElementById('edit-tpl-id').value=t.id; 
    document.getElementById('tpl-day').value=t.day; 
    document.getElementById('tpl-time').value=t.time||"10:00"; 
    document.getElementById('tpl-type').value=t.type; 
    document.getElementById('tpl-amount').value=t.amount; 
    document.getElementById('tpl-category').value=t.category; 
    document.getElementById('tpl-memo').value=t.memo||""; 
    document.getElementById('tpl-save-btn').innerText="保存"; 
    document.getElementById('tpl-cancel-btn').style.display="block"; 
    
    // スクロールコンテナ(.content)を最上部にスムーズスクロール
    const contentEl = document.querySelector('.content'); 
    if(contentEl) contentEl.scrollTo({top:0, behavior:'smooth'}); 
}

function cancelEditTemplate() { document.getElementById('edit-tpl-id').value=""; document.getElementById('tpl-day').value=""; document.getElementById('tpl-amount').value=""; document.getElementById('tpl-category').value=""; document.getElementById('tpl-memo').value=""; document.getElementById('tpl-save-btn').innerText="追加"; document.getElementById('tpl-cancel-btn').style.display="none"; }
function saveTemplate() { const id=document.getElementById('edit-tpl-id').value, day=Number(document.getElementById('tpl-day').value), time=document.getElementById('tpl-time').value||"00:00", type=document.getElementById('tpl-type').value, amount=Number(document.getElementById('tpl-amount').value), category=document.getElementById('tpl-category').value, memo=document.getElementById('tpl-memo').value; if(!day||day<1||day>31||!amount||!category){alert("入力漏れがあります");return;} if(id){ fixedTemplates[fixedTemplates.findIndex(t=>t.id==id)]={id:Number(id),day,time,type,amount,category,memo}; } else { fixedTemplates.push({id:Date.now(),day,time,type,amount,category,memo}); } localStorage.setItem("fixedTemplates",JSON.stringify(fixedTemplates)); cancelEditTemplate(); renderTemplates(); render(); }
function delTemplate(i) { if(!confirm("削除しますか？"))return; fixedTemplates.splice(i,1); localStorage.setItem("fixedTemplates",JSON.stringify(fixedTemplates)); renderTemplates(); }

function getCycle(dObj=new Date()) { 
    const y=dObj.getFullYear(), m=dObj.getMonth();
    let s = new Date(y, m, 0);
    let e = new Date(y, m + 1, 0); e.setDate(e.getDate() - 1); 
    let cycleKey = formatStr(s).substring(0, 7);
    if (customStarts[cycleKey]) { s = parseDate(customStarts[cycleKey]); }
    if (customEnds[cycleKey]) { e = parseDate(customEnds[cycleKey]); }
    let nextP = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1);
    if (formatStr(dObj) >= formatStr(nextP)) {
        s = nextP;
        let nextLd = new Date(y, m + 2, 0); e = new Date(nextLd.getFullYear(), nextLd.getMonth(), nextLd.getDate() - 1);
        cycleKey = formatStr(new Date(y, m+1, 0)).substring(0, 7);
        if (customStarts[cycleKey]) { s = parseDate(customStarts[cycleKey]); }
        if (customEnds[cycleKey]) { e = parseDate(customEnds[cycleKey]); }
        nextP = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1);
    }
    if (formatStr(dObj) < formatStr(s)) {
        let prevLd = new Date(y, m, 0);
        e = new Date(prevLd.getFullYear(), prevLd.getMonth(), prevLd.getDate() - 1); s = new Date(y, m - 1, 0);
        cycleKey = formatStr(new Date(y, m-1, 0)).substring(0, 7);
        if (customStarts[cycleKey]) { s = parseDate(customStarts[cycleKey]); }
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

function calculateCurrentBudget() {
    const t = new Date(); t.setHours(0,0,0,0); const tStr = formatStr(t);
    const c = getCycle(t); 

    let appBal = data.filter(d => d.status === 'confirmed').reduce((sum, d) => sum + (d.type === 'income' ? d.amount : -d.amount), 0);
    let vTotal = calcVaultTotal(); 
    let pendingExpenses = data.filter(d => d.status === 'pending' && d.type === 'expense' && d.date >= c.startStr && d.date < c.nextPayStr).reduce((s, d) => s + d.amount, 0);
    let lockTickets = (v2_status.ticketRemaining || 0) * (v2_status.ticketBaseAmount || 0);
    
    let lockFood = Math.max(0, v2_status.foodDeposit || 0); 
    let lockDrinkPool = Math.max(0, v2_status.drinkDeposit || 0); 
    let lockDrinkTotal = lockDrinkPool + lockTickets;
    
    let freeBalance = vTotal - pendingExpenses - lockFood - lockDrinkTotal; 

    let cycleEndObj = parseDate(c.endStr);
    let remD = Math.floor((cycleEndObj.getTime() - t.getTime())/(1000*60*60*24)) + 1; 
    if (remD < 1) remD = 1;
    let todayFreeSp = 0, weekFreeSp = 0, monthFreeSp = 0;
    let dOfW = t.getDay(), dSM = dOfW === 0 ? 6 : dOfW - 1; 
    let sW = new Date(t); sW.setDate(t.getDate() - dSM); let sWStr = formatStr(sW);
    data.forEach(d => {
        if (d.status === 'confirmed' && d.type === 'expense' && d.date >= c.startStr && d.date < c.nextPayStr) {
            let isPool = false;
            if (d.memo && (d.memo.includes("POOL") || d.memo.includes("TICKET") || d.memo.includes("[FOOD_POOL]") || d.memo.includes("[DRINK_POOL]"))) isPool = true;
            if (d.category === '資金繰り') isPool = true;

            if (!isPool && !d.templateId) { 
                monthFreeSp += d.amount;
                if (d.date === tStr) todayFreeSp += d.amount;
                if (d.date >= sWStr && d.date <= tStr) weekFreeSp += d.amount;
            }
        }
    });
    let dailyAvg = Math.floor((freeBalance + todayFreeSp) / remD); 
    if (dailyAvg < 0) dailyAvg = 0;
    let tBud = dailyAvg - todayFreeSp; 

    let weekStartD = parseDate(sWStr); let weekEndD = new Date(weekStartD); weekEndD.setDate(weekStartD.getDate() + 6);
    let validStart = weekStartD < parseDate(c.startStr) ? parseDate(c.startStr) : weekStartD;
    let validEnd = weekEndD > cycleEndObj ? cycleEndObj : weekEndD;
    let validDaysInWeek = Math.floor((validEnd.getTime() - validStart.getTime())/(1000*60*60*24)) + 1; 
    if (validDaysInWeek < 1) validDaysInWeek = 1;
    let bFW = dailyAvg * validDaysInWeek; 
    let wRem = bFW - weekFreeSp; 
    if (wRem > freeBalance) wRem = freeBalance;
    bFW = weekFreeSp + (wRem > 0 ? wRem : 0);
    
    let coreMax = vTotal + monthFreeSp; 

    return { 
        appBal, freeBalance, lockFood, lockDrinkTotal,
        todayBudget: tBud, weekRemaining: wRem, 
        budgetForToday: dailyAvg, budgetForWeek: bFW, 
        monthFreeSp, todayFreeSp, weekFreeSp, remainDays: remD,
        cycleText: `${c.startStr.slice(5)} 〜 ${c.endStr.slice(5)}`, 
        startStr: c.startStr, nextPayStr: c.nextPayStr,
        coreMax: coreMax
    };
}

function addData(obj) { 
    if (obj && obj.id) { data.push(obj); save(); render(); return; } 
    const amtEl = document.getElementById("amount");
    const a=Number(amtEl ? amtEl.value : 0); if(!a)return alert("金額を入力してください");
    const typeVal = document.getElementById("type") ? document.getElementById("type").value : 'expense';
    let memoText = document.getElementById("memo") ? document.getElementById("memo").value : "";
    if (typeVal === 'expense') {
        const sourceSel = document.getElementById("expense-source");
        const source = sourceSel ? sourceSel.value : 'free';
        
        if (source === 'food') {
            v2_status.foodDeposit -= a;
            memoText = memoText ? memoText + " [FOOD_POOL]" : "[FOOD_POOL]";
        } else if (source === 'drink') {
            v2_status.drinkDeposit -= a;
            memoText = memoText ? memoText + " [DRINK_POOL]" : "[DRINK_POOL]";
        }
        if(document.getElementById("memo")) document.getElementById("memo").value = memoText; 
        saveV2();
    }

    const pendingEl = document.getElementById("is-pending");
    const isPending = pendingEl && pendingEl.checked;
    const initialStatus = isPending ? 'pending' : 'confirmed';

    let tId = null;
    if (isPending) {
        tId = Date.now() + Math.floor(Math.random() * 1000);
        let inputDate = document.getElementById("date") ? document.getElementById("date").value : formatStr(new Date());
        let dObj = parseDate(inputDate);
        fixedTemplates.push({
            id: tId, day: dObj.getDate(), time: document.getElementById("time").value || "12:00",
            type: typeVal, amount: a, category: document.getElementById("category").value || "未分類",
            memo: memoText 
        });
        localStorage.setItem("fixedTemplates", JSON.stringify(fixedTemplates));
        renderTemplates();
    }

    data.push({ 
        id: Date.now(), templateId: tId, date: document.getElementById("date").value, time: document.getElementById("time").value||"00:00", 
        timestamp: Date.now(), amount: a, type: typeVal, category: document.getElementById("category").value || "未分類", 
        memo: memoText, actionLogText: "", status: initialStatus
    });
    save(); render(); 
    if(document.getElementById("amount")) document.getElementById("amount").value=""; 
    if(document.getElementById("memo")) document.getElementById("memo").value=""; 
    if(document.getElementById("category")) document.getElementById("category").value=""; 
    if(pendingEl) pendingEl.checked = false;
}

function render() {
    const l=document.getElementById("list");
    if(!l) return;
    l.innerHTML=""; const c=calculateCurrentBudget(); 
    const ct = document.getElementById("cycle-title"); if(ct) ct.innerText=`現在の実績 (${c.cycleText})`; 
    syncTemplatesWithCycle(c);
    data.filter(d=>d.date>=c.startStr && d.date<c.nextPayStr && d.status!=='deleted' && d.status!=='skipped').sort((a,b)=>(b.date+" "+b.time).localeCompare(a.date+" "+a.time)).forEach(d => {
        const p=d.status==='pending', cl=p?`item item-pending`:`item ${d.type}`, bd=p?`<span class="badge-pending">予定</span>`:'', tc=d.type==='expense'?'#dc3545':'#28a745';
        const v=document.createElement("div"); v.className=cl; v.innerHTML=`<div><small style="color:#999;display:block;">${d.date} ${d.time}</small>${bd}${d.category||'未分類'} <small style="color:#666;">${d.memo?'('+d.memo+')':''}</small></div><div style="color:${p?'#8e8e93':tc};font-weight:bold;">${d.type==='expense'?'-':'+'}${d.amount.toLocaleString()}円</div>`; v.onclick=()=>showDetail(d.id); l.appendChild(v);
    });
    const totalEl = document.getElementById("total"); if(totalEl) totalEl.innerText=c.freeBalance.toLocaleString()+"円";
    
    const tbEl = document.getElementById("todayBudget");
    if(tbEl) {
        tbEl.innerHTML = `<span style="font-size:12px; font-weight:normal; color:#8e8e93; display:block;">作戦猶予：残り ${c.remainDays} 日 ／ 当日予算：</span>${c.todayBudget > 0 ? c.todayBudget.toLocaleString() : 0}円`;
        if (c.todayBudget < 1000) {
            tbEl.classList.add("text-critical");
        } else {
            tbEl.classList.remove("text-critical");
        }
    }
    const wrEl = document.getElementById("weekRemaining"); if(wrEl) wrEl.innerText=(c.weekRemaining>0?c.weekRemaining.toLocaleString():0)+"円";

    updateMainProgressBar();
}

function updateMainProgressBar() {
    updateMainView();

    let c = calculateCurrentBudget();
    let termEl = document.getElementById('page-terminal');
    let isTerm = termEl ? termEl.classList.contains('active') : false;

    if (!isTerm) {
        const uMain = (bId, vId, aId, maxVal, remainVal) => { 
            let b=document.getElementById(bId), v=document.getElementById(vId), a=document.getElementById(aId);
            if(!b || !v || !a) return;
            let used = maxVal - remainVal;
            if (maxVal <= 0 && remainVal <= 0) {
                b.style.width='0%';
                b.style.background='#e5e5ea'; v.innerText='0%'; v.style.color='#8e8e93'; 
                a.innerText = '支出 0円 / 予算 0円'; a.style.color='#8e8e93';
            } else if (remainVal < 0) {
                b.style.width='100%';
                b.style.background='repeating-linear-gradient(45deg,#ff3b30,#ff3b30 8px,#ff6b6b 8px,#ff6b6b 16px)'; 
                v.innerText='OVER'; v.style.color='#ff3b30'; a.innerText=`予算超越 (支出 ${used.toLocaleString()}円 / 予算 ${maxVal.toLocaleString()}円)`; a.style.color='#ff3b30';
            } else {
                let p = maxVal > 0 ? (used / maxVal) * 100 : 100;
                if(p > 100) p = 100; if(p < 0) p = 0;
                b.style.width = p + '%'; v.innerText = Math.floor(p) + '%'; v.style.color='#1c1c1e'; 
                b.style.background = p < 60 ? '#34C759' : (p < 85 ? '#FFCC00' : '#FF3B30'); 
                a.innerText = `支出 ${used.toLocaleString()}円 / 予算 ${maxVal.toLocaleString()}円`; a.style.color='#1c1c1e';
            }
        };
        uMain('main-bar-day','main-val-day','main-amt-day', c.budgetForToday, c.todayBudget); 
        uMain('main-bar-week','main-val-week','main-amt-week', c.budgetForWeek, c.weekRemaining); 
        uMain('main-bar-core','main-val-core','main-amt-core', c.coreMax, c.freeBalance);
        
        // MAIN画面用のPOOL残高メーター
        const uMainPool = (bId, vId, aId, maxVal, remainVal) => {
            let b=document.getElementById(bId), v=document.getElementById(vId), a=document.getElementById(aId);
            if(!b || !v || !a) return;
            if (maxVal <= 0) {
                b.style.width='0%'; b.style.background='#e5e5ea'; v.innerText='0%'; v.style.color='#8e8e93';
                a.innerText = `残高 0円 / 最大 0円`; a.style.color='#8e8e93';
            } else if (remainVal < 0) {
                b.style.width='0%'; b.style.background='#ff3b30'; v.innerText='0%'; v.style.color='#ff3b30';
                a.innerText = `残高 ${remainVal.toLocaleString()}円 (赤字)`; a.style.color='#ff3b30';
            } else {
                let p = (remainVal / maxVal) * 100;
                if(p > 100) p = 100;
                b.style.width = p + '%'; v.innerText = Math.floor(p) + '%'; v.style.color='#1c1c1e';
                b.style.background = p > 50 ? '#34C759' : (p > 20 ? '#FFCC00' : '#FF3B30'); 
                a.innerText = `残高 ${remainVal.toLocaleString()}円 / 最大 ${maxVal.toLocaleString()}円`; a.style.color='#1c1c1e';
            }
        };
        uMainPool('main-bar-drink', 'main-val-drink', 'main-amt-drink', v2_status.drinkDepositMax || v2_status.drinkDeposit || 10000, v2_status.drinkDeposit || 0);
        uMainPool('main-bar-food', 'main-val-food', 'main-amt-food', v2_status.foodDepositMax || v2_status.foodDeposit || 30000, v2_status.foodDeposit || 0);
        
    } else {
        let tMax = v2_status.ticketMax || 5;
        let tRem = v2_status.ticketRemaining || 0;
        let tUsed = tMax - tRem;
        let pendingTicket = (mTotal > 0 && tRem > 0) ? 1 : 0;
        
        let dMax = v2_status.drinkDepositMax || v2_status.drinkDeposit || 10000;
        let dRem = v2_status.drinkDeposit || 0;
        let dUsed = dMax - dRem;
        let ticketBase = v2_status.ticketBaseAmount || 2500;
        let pendingDrink = 0;
        if(mTotal > 0) {
            if(tRem > 0) {
                pendingDrink = mTotal > ticketBase ? mTotal - ticketBase : 0;
            } else {
                pendingDrink = mTotal;
            }
        }
        
        let fMax_term = v2_status.foodDepositMax || v2_status.foodDeposit || 30000;
        let fRem_term = v2_status.foodDeposit || 0;
        let fUsed_term = fMax_term - fRem_term;
        const updateTermMeter = (bId, vId, aId, maxVal, usedVal, pendingVal, unit, name) => {
            let b=document.getElementById(bId), v=document.getElementById(vId), a=document.getElementById(aId);
            if(!b || !v || !a) return;
            
            let totalUsed = usedVal + pendingVal;
            if (maxVal <= 0) {
                b.style.width='0%';
                b.style.background='#e5e5ea'; v.innerText='0%'; v.style.color='#8e8e93'; 
                a.innerText = `USED: 0${unit} / MAX: 0${unit}`; a.style.color='#8e8e93';
            } else if (totalUsed > maxVal) {
                b.style.width='100%';
                b.style.background='repeating-linear-gradient(45deg,#ff3b30,#ff3b30 8px,#ff6b6b 8px,#ff6b6b 16px)'; 
                v.innerText='OVER'; v.style.color='#ff3b30'; a.innerText=`USED: ${totalUsed.toLocaleString()}${unit} / MAX: ${maxVal.toLocaleString()}${unit} (OVER)`; a.style.color='#ff3b30';
            } else {
                let p = (totalUsed / maxVal) * 100;
                if(p < 0) p = 0;
                b.style.width = p + '%'; 
                v.innerText = Math.floor(p) + '%'; v.style.color='#1c1c1e';
                b.style.background = p < 60 ? '#34C759' : (p < 85 ? '#FFCC00' : '#FF3B30');
                a.innerText = `USED: ${totalUsed.toLocaleString()}${unit} / MAX: ${maxVal.toLocaleString()}${unit}`; a.style.color='#1c1c1e';
            }
        };
        updateTermMeter('term-bar-ticket', 'term-val-ticket', 'term-amt-ticket', tMax, tUsed, pendingTicket, '枚', 'TICKET');
        updateTermMeter('term-bar-drink', 'term-val-drink', 'term-amt-drink', dMax, dUsed, pendingDrink, '円', 'DRINK_POOL');
        updateTermMeter('term-bar-food', 'term-val-food', 'term-amt-food', fMax_term, fUsed_term, 0, '円', 'FOOD_POOL');
    }
}

function showDetail(id) { 
    const d=data.find(x=>x.id===id); if(!d)return;
    const p=d.status==='pending';
    let btns = p 
        ? `<button class="main-btn" style="background:#34C759;margin-bottom:10px;padding:16px;" onclick="confirmRecord(${id})">✅ 確定にする</button>
           <div style="display:flex;gap:10px;"><button class="main-btn" style="flex:1;" onclick="updateRecord(${id})">更新</button><button class="main-btn" style="flex:1;background:#8e8e93;" onclick="skipRecord(${id})">スキップ</button></div>` 
        : `<button class="main-btn" onclick="updateRecord(${id})">保存</button><button class="main-btn" style="background:#ff3b30;" onclick="deleteRecord(${id})">削除</button>`; 
        
    let templateUi = '';
    if(d.templateId) {
        templateUi = `<div style="display:flex; align-items:center; gap:8px; margin: 15px 4px 10px; font-size:13px; font-weight:bold; color:#34C759;"><span style="font-size:16px;">📌</span> <span>FIXED(固定費) 連携済み</span></div>`;
    } else {
        templateUi = `<label style="display:flex; align-items:center; gap:8px; margin: 15px 4px 10px; font-size:14px; font-weight:bold; color:#FF9500; cursor:pointer;"><input type="checkbox" id="edit-is-pending" style="-webkit-appearance: checkbox !important; appearance: checkbox !important; width: 22px !important; height: 22px !important; margin: 0 !important; padding: 0 !important; border: none !important; cursor: pointer; flex-shrink: 0; outline: none !important;"><span style="padding-top:2px;">FIXEDに登録して保留</span></label>`;
    }

    const dc = document.getElementById('detail-content');
    if(!dc) return;
    dc.innerHTML=`<h3 style="margin:0 0 10px;border-bottom:2px solid ${p?'#FF9500':'#007aff'};padding-bottom:5px;">${p?'予定の確認':'データの編集'}</h3><div style="display:flex;gap:10px;"><input type="date" id="edit-date" value="${d.date}" style="flex:2;"><input type="time" id="edit-time" value="${d.time}" style="flex:1;"></div><select id="edit-type"><option value="expense" ${d.type==='expense'?'selected':''}>支出</option><option value="income" ${d.type==='income'?'selected':''}>収入</option></select><input type="number" id="edit-amount" value="${d.amount}" inputmode="numeric"><input type="text" id="edit-category" value="${d.category||''}"><input type="text" id="edit-memo" value="${d.memo||''}"><textarea id="edit-actionlog" style="font-size:12px;width:100%;height:60px;margin-top:10px;">${d.actionLogText||''}</textarea>${templateUi}${btns}<button class="main-btn" style="background:#ccc;" onclick="document.getElementById('detail-modal').style.display='none'">閉じる</button>`; 
    document.getElementById('detail-modal').style.display = 'flex'; 
}

function updateRecord(id) { 
    const i=data.findIndex(x=>x.id===id); if(i===-1)return; 
    const d = data[i];
    if (d.memo && d.memo.includes("TICKET")) {
        alert("⚠️戦場（TERMINAL）の記録は編集できません。\nチケットやPOOLの計算を正確に戻すため、一度「削除」してから新しく入力し直してください！");
        return;
    }

    data[i].date=document.getElementById('edit-date').value; 
    data[i].time=document.getElementById('edit-time').value;
    data[i].type=document.getElementById('edit-type').value; 
    data[i].amount=Number(document.getElementById('edit-amount').value); 
    data[i].category=document.getElementById('edit-category').value; 
    data[i].memo=document.getElementById('edit-memo').value; 
    data[i].actionLogText=document.getElementById('edit-actionlog').value; 

    const pendingEl = document.getElementById('edit-is-pending');
    if (pendingEl && pendingEl.checked && !data[i].templateId) {
        let tId = Date.now() + Math.floor(Math.random() * 1000);
        let dObj = parseDate(data[i].date);
        fixedTemplates.push({
            id: tId, day: dObj.getDate(), time: data[i].time || "12:00",
            type: data[i].type, amount: data[i].amount, category: data[i].category || "未分類",
            memo: data[i].memo
        });
        localStorage.setItem("fixedTemplates", JSON.stringify(fixedTemplates));
        renderTemplates();
        data[i].templateId = tId;
        data[i].status = 'pending'; 
    }
    save(); render(); document.getElementById('detail-modal').style.display='none';
}

function confirmRecord(id) { const i=data.findIndex(x=>x.id===id); if(i===-1)return; updateRecord(id); data[i].status='confirmed'; save(); render(); }
function skipRecord(id) { const i=data.findIndex(x=>x.id===id); if(i===-1)return; data[i].status='skipped'; save(); render(); document.getElementById('detail-modal').style.display='none'; }

function deleteRecord(id) { 
    if(!confirm("削除しますか？")) return; 
    const i=data.findIndex(x=>x.id===id); 
    if(i===-1) return; 
    const d = data[i];
    if (d.memo && d.memo.includes("TICKET")) {
        let tMatch = d.memo.match(/TICKET -(\d+)/);
        let pMatch = d.memo.match(/POOL -(\d+)/);
        let tAdd = tMatch ? Number(tMatch[1]) : 0;
        let pAdd = pMatch ? Number(pMatch[1]) : 0;
        v2_status.ticketRemaining += tAdd;
        v2_status.drinkDeposit += pAdd;
        if (v2_status.ticketRemaining > v2_status.ticketMax) v2_status.ticketRemaining = v2_status.ticketMax;
        alert(`♻️ ロールバック実行！\nチケット +${tAdd}枚\n飲み代POOL +${pAdd}円`);
    } else if (d.memo && d.memo.includes("[FOOD_POOL]")) {
        v2_status.foodDeposit += d.amount;
        alert(`♻️ 食費POOLに +${d.amount.toLocaleString()}円 戻しました`);
    } else if (d.memo && d.memo.includes("[DRINK_POOL]")) {
        v2_status.drinkDeposit += d.amount;
        alert(`♻️ 飲み代POOLに +${d.amount.toLocaleString()}円 戻しました`);
    }
    saveV2();

    if(d.templateId) d.status='deleted'; 
    else data.splice(i,1); 
    
    save(); render(); document.getElementById('detail-modal').style.display='none';
}

// ==========================================
// STORE (TERMINAL UI に合わせて仕様変更)
// ==========================================
function editStoreUI(id) { 
    const s=stores.find(x=>x.id==id); 
    if(!s)return; 
    document.getElementById('edit-store-id').value=s.id; 
    document.getElementById('store-name').value=s.name; 
    document.getElementById('price-a').value=s.a; 
    document.getElementById('price-b').value=s.b; 
    document.getElementById('store-save-btn').innerText="SAVE"; 
    document.getElementById('store-cancel-btn').style.display="block"; 
    
    // スクロールコンテナ(.content)を最上部にスムーズスクロール
    const contentEl = document.querySelector('.content'); 
    if(contentEl) contentEl.scrollTo({top:0, behavior:'smooth'}); 
}

function cancelEditStore() { document.getElementById('edit-store-id').value=""; document.getElementById('store-name').value=""; document.getElementById('price-a').value=""; document.getElementById('price-b').value=""; document.getElementById('store-save-btn').innerText="ADD_NEW"; document.getElementById('store-cancel-btn').style.display="none"; }
function saveStore() { const id=document.getElementById('edit-store-id').value, name=document.getElementById('store-name').value, a=Number(document.getElementById('price-a').value), b=Number(document.getElementById('price-b').value); if(!name)return; if(id){stores[stores.findIndex(s=>s.id==id)]={id:Number(id),name,a,b};}else{stores.push({id:Date.now(),name,a,b});} localStorage.setItem("storePresets",JSON.stringify(stores)); updateStoreUI(); updateStoreSelect(); cancelEditStore(); }
function updateStoreSelect() { const w = isSystemAction; isSystemAction=true; const sel=document.getElementById('active-project-id'); if(!sel)return; const p=sel.value; sel.innerHTML='<option value="">-- SELECT_STORE --</option>'+stores.map(s=>`<option value="${s.id}">${s.name}</option>`).join(''); if(p)sel.value=p; if(!w)setTimeout(()=>isSystemAction=false,50); }
function updateStoreUI() { const sui = document.getElementById('store-list-ui'); if(!sui)return; sui.innerHTML=stores.map(s=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #eee;"><div><b style="font-size:15px;">${s.name}</b> <small style="color:#8e8e93; margin-left:4px;">(D1:${s.a} D2:${s.b})</small></div><div style="display:flex; gap:6px;"><button class="main-btn" onclick="editStoreUI(${s.id})" style="background:#007aff;color:white;border:none;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:bold;margin:0;">EDIT</button><button class="main-btn" onclick="if(confirm('削除しますか？')){stores=stores.filter(x=>x.id!=${s.id});localStorage.setItem('storePresets',JSON.stringify(stores));updateStoreUI();updateStoreSelect();}" style="background:#ff3b30;color:white;border:none;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:bold;margin:0;">DEL</button></div></div>`).join(''); }

function handleProjectSelection() { if(isSystemAction)return; activeStore=stores.find(s=>s.id==document.getElementById('active-project-id').value); if(activeStore){ document.getElementById('active-terminal-area').style.display='block'; document.getElementById('label-price-a').innerText=activeStore.a; document.getElementById('label-price-b').innerText=activeStore.b; mDCount=0;mFCount=0;mTotal=0;actionLog=[]; updateTDisplay(); document.getElementById('btn-task-f').classList.add('active-f'); }else{ document.getElementById('active-terminal-area').style.display='none'; localStorage.removeItem("terminalDraft"); activeStore=null;mDCount=0;mFCount=0;mTotal=0;actionLog=[]; } }
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

function updateTDisplay() { 
    const mdc = document.getElementById('mock-d-count'); if(mdc) mdc.innerText=mDCount; 
    const mfc = document.getElementById('mock-f-count'); if(mfc) mfc.innerText=mFCount;
    const mtv = document.getElementById('mock-total-val'); if(mtv) mtv.innerText=mTotal.toLocaleString(); 
    updateMainProgressBar(); 
    const l=document.getElementById('action-log-list'); if(!l)return; l.innerHTML=""; 
    document.getElementById('action-log-area').style.display=actionLog.length?'block':'none';
    for(let i=actionLog.length-1;i>=0;i--){ 
        const a=actionLog[i];
        l.innerHTML+=`<div class="action-log-item"><div><span style="color:#aaa;margin-right:8px;">${a.time}</span><b>${a.label}</b></div><div style="display:flex;align-items:center;gap:6px;">${a.cost>0?'+'+a.cost:''}<button class="main-btn" onclick="editActionById(${a.id})" style="background:#007aff;color:white;border:none;border-radius:4px;padding:4px;font-size:10px;margin:0;">✎</button><button class="action-log-del" onclick="removeActionById(${a.id})">✖</button></div></div>`;
    } 
    saveTerminalDraft();
    const statusBar = document.getElementById('stealth-status-bar');
    if (statusBar) {
        statusBar.classList.remove('status-safe', 'status-warning', 'status-critical');
        if (mDCount <= 2) {
            statusBar.innerText = "[ ONLINE - SESSION SAFE ]";
            statusBar.classList.add('status-safe');
        } else if (mDCount === 3) {
            statusBar.innerText = "[ SYNCING... - WARNING ]";
            statusBar.classList.add('status-warning');
        } else {
            statusBar.innerText = "[ OVERLOAD / LIMIT EXCEEDED ]";
            statusBar.classList.add('status-critical');
        }
    }
}
function logT(m) { const e=document.getElementById('log-msg'); if(!e)return; e.innerHTML=`STATUS: ${m}<br>READY`; setTimeout(()=>e.innerHTML="SYSTEM: STANDBY<br>AWAITING INPUT...",1500); }
function showCheckout() { document.getElementById('checkout-modal').style.display='flex'; document.getElementById('final-amount').value=mTotal>0?mTotal:""; }
function closeCheckout() { document.getElementById('checkout-modal').style.display='none'; }

function finishProject() { 
    const amt=Number(document.getElementById('final-amount').value); if(!amt) return;
    
    let ticketBase = v2_status.ticketBaseAmount;
    let usedTicket = 0;
    let poolDeduct = amt;

    if (v2_status.ticketRemaining > 0) {
        usedTicket = 1;
        v2_status.ticketRemaining -= 1;
        poolDeduct = amt > ticketBase ? amt - ticketBase : 0;
    }
    v2_status.drinkDeposit -= poolDeduct;
    saveV2();

    let termMemo = `D:${mDCount} F:${mFCount} | TICKET -${usedTicket} / POOL -${poolDeduct} CONFIRMED`;
    addData({ 
        id:Date.now(), date:formatStr(new Date()), time:getT(), timestamp:Date.now(), 
        amount:amt, type:'expense', category:activeStore.name, memo:termMemo, 
        actionLogText:actionLog.map(a=>`${a.time} ${a.label} ${a.cost>0?'+'+a.cost:''}`).join('\n'), 
        status:'confirmed' 
    });
    alert(`記録完了 (TICKET -${usedTicket} / DRINK_POOL -${poolDeduct}円)`); 
    closeCheckout(); localStorage.removeItem("terminalDraft"); 
    document.getElementById('active-terminal-area').style.display='none'; 
    document.getElementById('active-project-id').value=""; activeStore=null; cancelEditStore(); 
    switchPage('main', document.querySelector('.tab-item'));
}

// ==========================================
// ★ 統合型 CSVエクスポート（出力）ロジック
// ==========================================
function exportCSV(type) {
    let csvContent = "";
    let fileName = "";
    const bom = "\uFEFF"; // Excel用BOM

    if (type === 'log') {
        if (!data || data.length === 0) { alert("出力するデータがありません。"); return; }
        csvContent = bom + "日付,時間,収支,金額,カテゴリ,メモ,ステータス,詳細ログ\n";
        const sortedData = [...data].sort((a,b) => ((b.date||"") + " " + (b.time||"")).localeCompare((a.date||"") + " " + (a.time||"")));
        sortedData.forEach(d => {
            let t = d.type === 'income' ? '収入' : '支出';
            let stat = d.status === 'deleted' ? '削除' : (d.status === 'skipped' ? 'スキップ' : (d.status === 'pending' ? '予定' : '確定'));
            let cat = `"${(d.category || "").replace(/"/g, '""')}"`;
            let memo = `"${(d.memo || "").replace(/"/g, '""')}"`;
            let log = `"${(d.actionLogText || "").replace(/"/g, '""').replace(/\n/g, ' / ')}"`;
            csvContent += `${d.date||""},${d.time||""},${t},${d.amount},${cat},${memo},${stat},${log}\n`;
        });
        fileName = `ACTIVITY_LOG_${formatStr(new Date()).replace(/-/g, '')}.csv`;
    } 
    else if (type === 'fixed') {
        if (!fixedTemplates || fixedTemplates.length === 0) { alert("出力するデータがありません。"); return; }
        csvContent = bom + "日,時間,収支,金額,カテゴリ,メモ\n";
        const sortedData = [...fixedTemplates].sort((a,b) => a.day - b.day);
        sortedData.forEach(t => {
            let ty = t.type === 'income' ? '収入' : '支出';
            let cat = `"${(t.category || "").replace(/"/g, '""')}"`; 
            let memo = `"${(t.memo || "").replace(/"/g, '""')}"`; 
            csvContent += `${t.day},${t.time||""},${ty},${t.amount},${cat},${memo}\n`;
        });
        fileName = `FIXED_COST_${formatStr(new Date()).replace(/-/g, '')}.csv`;
    } 
    else if (type === 'vault') {
        if (!vault_accounts || vault_accounts.length === 0) { alert("出力するデータがありません。"); return; }
        csvContent = bom + "ID,口座名,残高\n";
        vault_accounts.forEach(v => {
            let n = `"${(v.name || "").replace(/"/g, '""')}"`;
            csvContent += `${v.id},${n},${v.balance}\n`;
        });
        fileName = `VAULT_DATA_${formatStr(new Date()).replace(/-/g, '')}.csv`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    if (navigator.share) { 
        const file = new File([blob], fileName, { type: 'text/csv' }); 
        if (navigator.canShare && navigator.canShare({ files: [file] })) { 
            navigator.share({ files: [file] }).catch(err => console.log(err)); return; 
        } 
    }
    const link = document.createElement("a"); 
    const url = URL.createObjectURL(blob); 
    link.setAttribute("href", url); 
    link.setAttribute("download", fileName); 
    link.style.display = 'none'; 
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
}

// ==========================================
// ★ 統合型 CSVインポート（読込）ロジック
// ==========================================
function importCSV(event, type) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\n');
        let importedCount = 0;
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // 簡易的なCSVパーサー（カンマ区切りとダブルクォーテーション対応）
            let cols = [];
            let inQuote = false;
            let col = '';
            for(let j = 0; j < line.length; j++){
                let c = line[j];
                if(c === '"') { inQuote = !inQuote; }
                else if(c === ',' && !inQuote) { cols.push(col); col = ''; }
                else { col += c; }
            }
            cols.push(col);

            // ① 履歴・支出 (ACTIVITY_LOG) の処理
            if (type === 'log' && cols.length >= 7) {
                let dateStr = cols[0];
                let timeStr = cols[1];
                let typeStr = cols[2];
                let amount = Number(cols[3]);
                let cat = cols[4] ? cols[4].replace(/^"|"$/g, '').replace(/""/g, '"') : '';
                let memo = cols[5] ? cols[5].replace(/^"|"$/g, '').replace(/""/g, '"') : '';
                let statStr = cols[6];
                let logText = cols[7] ? cols[7].replace(/^"|"$/g, '').replace(/""/g, '"').replace(/ \/ /g, '\n') : '';
                
                let t = typeStr === '収入' ? 'income' : 'expense';
                let status = 'confirmed';
                if (statStr === '削除') status = 'deleted';
                if (statStr === 'スキップ') status = 'skipped';
                if (statStr === '予定') status = 'pending';

                const isDuplicate = data.some(d => d.date === dateStr && d.time === timeStr && d.amount === amount && d.category === cat);
                if (!isDuplicate && !isNaN(amount)) {
                    data.push({ id: Date.now() + importedCount, date: dateStr, time: timeStr, timestamp: parseDate(dateStr).getTime(), amount: amount, type: t, category: cat, memo: memo, actionLogText: logText, status: status });
                    importedCount++;
                }
            } 
            // ② 固定費テンプレート (FIXED_COST) の処理
            else if (type === 'fixed' && cols.length >= 6) {
                let day = Number(cols[0]);
                if (isNaN(day) || day < 1 || day > 31) continue;
                let timeStr = cols[1] || "10:00";
                let typeStr = cols[2];
                let amount = Number(cols[3]);
                if (isNaN(amount) || amount <= 0) continue;
                let cat = cols[4] ? cols[4].replace(/^"|"$/g, '').replace(/""/g, '"') : '';
                let memo = cols[5] ? cols[5].replace(/^"|"$/g, '').replace(/""/g, '"') : '';
                
                let t = typeStr === '収入' ? 'income' : 'expense';

                const isDuplicate = fixedTemplates.some(tmpl => tmpl.day === day && tmpl.amount === amount && tmpl.category === cat);
                if (!isDuplicate) {
                    fixedTemplates.push({ id: Date.now() + importedCount, day: day, time: timeStr, type: t, amount: amount, category: cat, memo: memo });
                    importedCount++;
                }
            } 
            // ③ 金庫・口座残高 (VAULT_DATA) の処理
            else if (type === 'vault' && cols.length >= 3) {
                let id = cols[0];
                let name = cols[1] ? cols[1].replace(/^"|"$/g, '').replace(/""/g, '"') : '';
                let balance = Number(cols[2]);
                if (isNaN(balance)) continue;
                
                const existing = vault_accounts.find(v => v.id === id);
                if (existing) {
                    existing.name = name;
                    existing.balance = balance;
                } else {
                    vault_accounts.push({ id: id, name: name, balance: balance });
                }
                importedCount++;
            }
        }
        
        // 読込完了後の保存と画面更新
        if (type === 'log') { save(); render(); alert(`📥 ${importedCount}件の「履歴・支出」データをインポートしました！`); }
        if (type === 'fixed') { localStorage.setItem("fixedTemplates", JSON.stringify(fixedTemplates)); renderTemplates(); render(); alert(`📥 ${importedCount}件の「固定費」データをインポートしました！`); }
        if (type === 'vault') { saveVault(); renderVault(); render(); alert(`📥 ${importedCount}件の「口座残高」データをインポートしました！`); }
        
        event.target.value = ''; 
    };
    reader.readAsText(file);
}

// 実行環境の自動判定 (PWA or Safari)
function checkEnvironment() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const envText = isStandalone ? "App Mode (PWA設定状態)" : "Safari Browser (通常ブラウザ状態)";
    const envEl = document.getElementById('env-indicator');
    if(envEl) envEl.innerText = `現在の検出環境: [ ${envText} ]`;
}

// 全LocalStorageデータの救済コピー
function exportData() {
    let allData = JSON.stringify(localStorage);
    navigator.clipboard.writeText(allData).then(() => {
        alert("✅ 鉄壁の防衛データ退避！\n全データを1行の退避用テキストとしてクリップボードにコピーしました。\nメモ帳やLINE等に貼り付けて退避・保管してください。");
    }).catch(err => {
        prompt("以下のテキストを全選択して手動でコピーし、退避させてください:", allData);
    });
}

