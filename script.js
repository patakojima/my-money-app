let data = JSON.parse(localStorage.getItem("moneyData")) || [];
let customEnds = JSON.parse(localStorage.getItem("customCycleEnds")) || {}; 

const formatStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseDate = (s) => { if(!s) return new Date(); const p = s.split('-'); return new Date(p[0], p[1]-1, p[2]); };

window.onload = () => { 
    const dateEl = document.getElementById("date");
    if(dateEl) dateEl.value = formatStr(new Date()); 
    render(); 
};

function switchPage(pageId, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pEl = document.getElementById('page-' + pageId);
    if(pEl) pEl.classList.add('active');
    
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if(el) el.classList.add('active');
}

function getV(id) { const el = document.getElementById(id); return el ? el.value : ""; }
function setV(id, val) { const el = document.getElementById(id); if(el) el.value = val; }
function setTxt(id, txt) { const el = document.getElementById(id); if(el) el.innerText = txt; }

function showCycleEditModal() { 
    let c = getCycle(new Date()); 
    setV('cycle-edit-key', c.cycleKey); 
    setV('cycle-edit-date', c.endStr); 
    const m = document.getElementById('cycle-edit-modal'); 
    if(m) m.style.display = 'flex'; 
}

function closeCycleEditModal() { 
    const m = document.getElementById('cycle-edit-modal'); 
    if(m) m.style.display = 'none'; 
}

function saveCycleEnd() { 
    let k=getV('cycle-edit-key'), d=getV('cycle-edit-date'); 
    if(!d) return; 
    customEnds[k] = d; 
    localStorage.setItem("customCycleEnds", JSON.stringify(customEnds)); 
    closeCycleEditModal(); 
    render(); 
}

function getCycle(dObj=new Date()) { 
    const y=dObj.getFullYear(), m=dObj.getMonth();
    let s = new Date(y, m, 0); 
    let e = new Date(y, m + 1, 0); e.setDate(e.getDate() - 1); 
    let cycleKey = formatStr(s).substring(0, 7); 
    if (customEnds[cycleKey]) e = parseDate(customEnds[cycleKey]);
    let nextP = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1);
    
    if (formatStr(dObj) >= formatStr(nextP)) {
        s = nextP; let nextLd = new Date(y, m + 2, 0); e = new Date(nextLd.getFullYear(), nextLd.getMonth(), nextLd.getDate() - 1);
        cycleKey = formatStr(s).substring(0, 7); if (customEnds[cycleKey]) e = parseDate(customEnds[cycleKey]);
        nextP = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1);
    }
    if (formatStr(dObj) < formatStr(s)) {
        let prevLd = new Date(y, m, 0); e = new Date(prevLd.getFullYear(), prevLd.getMonth(), prevLd.getDate() - 1);
        s = new Date(y, m - 1, 0); cycleKey = formatStr(s).substring(0, 7);
        if (customEnds[cycleKey]) e = parseDate(customEnds[cycleKey]);
        nextP = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1);
    }
    return { startStr:formatStr(s), endStr:formatStr(e), nextPayStr:formatStr(nextP), nextPayObj:nextP, cycleKey:cycleKey }; 
}

function calculateCurrentBudget() {
    const t=new Date(); t.setHours(0,0,0,0); const tStr=formatStr(t); const c=getCycle(t); 
    let cEx=0, cIn=0, tSp=0, wSp=0, dOfW=t.getDay(), dSM=dOfW===0?6:dOfW-1, sW=new Date(t); sW.setDate(t.getDate()-dSM); let sWStr=formatStr(sW);
    
    data.forEach(d => { 
        if(d.date>=c.startStr && d.date<c.nextPayStr && d.status!=='deleted' && d.status!=='skipped') { 
            if(d.type==='expense'){ 
                cEx+=d.amount; 
                if(d.date===tStr) tSp+=d.amount; 
                if(d.date>=sWStr && d.date<=tStr) wSp+=d.amount; 
            } 
            if(d.type==='income'){ cIn+=d.amount; } 
        } 
    });
    
    let cBal = cIn - cEx; 
    let cycleEndObj = parseDate(c.endStr); 
    let remD = Math.floor((cycleEndObj.getTime() - t.getTime())/(1000*60*60*24)) + 1; 
    if (remD < 1) remD = 1; 
    
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

function addData() { 
    const amtEl = document.getElementById("amount"); if(!amtEl) return;
    const a = Number(amtEl.value); 
    if(!a){ alert("金額を入力してください"); return; }
    
    data.push({ 
        id: Date.now(), 
        date: getV("date") || formatStr(new Date()), 
        time: getV("time") || "12:00", 
        timestamp: Date.now(), 
        amount: a, 
        type: getV("type"), 
        category: getV("category") || "未分類", 
        memo: "", 
        actionLogText: "", 
        status: 'confirmed' 
    }); 
    save(); 
    render(); 
    amtEl.value = ""; 
    setV("category", ""); 
}

function render() {
    const l = document.getElementById("list"); if(l) l.innerHTML = ""; 
    const c = calculateCurrentBudget(); 
    
    if(l) {
        const filtered = data.filter(d=>d.date>=c.startStr && d.date<c.nextPayStr && d.status!=='deleted' && d.status!=='skipped');
        if(filtered.length === 0){
            l.innerHTML = `<div style="text-align:center; padding:20px; color:#8e8e93; font-size:13px;">記録はまだありません</div>`;
        } else {
            filtered.sort((a,b)=>(b.date+" "+b.time).localeCompare(a.date+" "+a.time)).forEach(d => {
                const tc = d.type === 'expense' ? 'expense' : 'income';
                const sign = d.type === 'expense' ? '-' : '+';
                const v = document.createElement("div"); 
                v.className = "item"; 
                v.innerHTML = `<div><small style="color:#8e8e93;display:block;">${d.date}</small>${d.category||'未分類'}</div><div class="item-amount ${tc}">${sign}${d.amount.toLocaleString()}円</div>`; 
                l.appendChild(v);
            });
        }
    }
    
    setTxt("total", c.currentBalance.toLocaleString()+"円"); 
    setTxt("todayBudget", (c.todayBudget > 0 ? c.todayBudget.toLocaleString() : 0) + "円");
    setTxt("weekRemaining", (c.weekRemaining > 0 ? c.weekRemaining.toLocaleString() : 0) + "円");
    updateMainProgressBar(c);
}

function updateMainProgressBar(c) {
    let tIn = data.filter(d=>d.date>=c.startStr && d.date<c.nextPayStr && d.type==='income' && d.status!=='deleted' && d.status!=='skipped').reduce((s,d)=>s+d.amount,0) || 1;
    
    const u = (bId, vId, aId, bM, cV) => { 
        let b = document.getElementById(bId), v = document.getElementById(vId), a = document.getElementById(aId); 
        if(!b || !v || !a) return;
        
        let used = bM - cV; 
        
        if(bM <= 0 && cV <= 0){
            b.style.width = '0%'; b.style.background = '#e2e8f0'; v.innerText = '0%'; a.innerText = `0円`;
        } else if(cV < 0){
            b.style.width = '100%'; b.style.background = '#ff3b30'; v.innerText = '0%'; v.style.color = '#ff3b30'; a.innerText = `${used.toLocaleString()}円`;
        } else {
            let p = bM > 0 ? (cV/bM)*100 : 100; if(p > 100) p = 100;
            b.style.width = p + '%'; v.innerText = Math.floor(p) + '%'; v.style.color = '#1c1c1e';
            b.style.background = p > 50 ? '#34c759' : (p > 20 ? '#ffcc00' : '#ff3b30'); 
            a.innerText = `${used.toLocaleString()}円`;
        }
    };
    
    u('bar-day', 'val-day', 'amt-day', c.budgetForToday, c.todayBudget); 
    u('bar-week', 'val-week', 'amt-week', c.budgetForWeek, c.weekRemaining); 
    u('bar-core', 'val-core', 'amt-core', tIn, c.currentBalance);
}


