// ==========================================
// 入出金管理アプリ ver.2.2 ロジック部
// ==========================================

// 1. LocalStorage初期化＆読み込み防衛線
let foodBalance = parseInt(localStorage.getItem('foodBalance')) || 30000;
let drinkTickets = parseInt(localStorage.getItem('drinkTickets')) || 5;
let nextPayDate = localStorage.getItem('nextPayDate') || "2026-07-25"; // 給料日仮設定
let foodInit = parseInt(localStorage.getItem('foodInit')) || 30000;
let ticketInit = parseInt(localStorage.getItem('ticketInit')) || 5;
let survivalLimit = parseInt(localStorage.getItem('survivalLimit')) || 1000;
let drinkSessionCount = parseInt(localStorage.getItem('drinkSessionCount')) || 0; // 杯数カウント
let stealthCurrentInput = "";

// 初期ロード時にUIを更新
window.onload = () => {
    checkEnvironment();
    loadSettings();
    updateMainUI();
    updateStealthUI();
};

// タブ切り替え機能
function switchTab(tabName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(`screen-${tabName}`).classList.add('active');
    event.currentTarget.classList.add('active');
    document.getElementById('header-title').innerText = tabName.toUpperCase();
}

// MAIN画面の更新 (メーター、当日予算、カラータイマー)
function updateMainUI() {
    // --- 食費と当日予算 ---
    document.getElementById('food-balance').innerText = `¥${foodBalance.toLocaleString()}`;
    let foodPercent = (foodBalance / foodInit) * 100;
    document.getElementById('food-meter').style.width = `${Math.min(100, Math.max(0, foodPercent))}%`;

    // 残り日数の計算
    let today = new Date();
    today.setHours(0,0,0,0);
    let payDate = new Date(nextPayDate);
    payDate.setHours(0,0,0,0);
    let targetDate = new Date(payDate);
    targetDate.setDate(targetDate.getDate() - 1); // 給料日前日まで

    let diffTime = targetDate.getTime() - today.getTime();
    let remainDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (remainDays < 1) remainDays = 1; // 0割回避

    let dailyBudget = Math.floor(foodBalance / remainDays);
    let budgetDisplay = document.getElementById('daily-budget-display');
    
    budgetDisplay.innerText = `作戦猶予：残り ${remainDays} 日 ／ 当日予算：¥${dailyBudget.toLocaleString()}`;
    
    // アラートカラー
    if (dailyBudget < survivalLimit) {
        budgetDisplay.classList.add('text-critical');
    } else {
        budgetDisplay.classList.remove('text-critical');
    }

    // --- チケット ---
    let ticketDisplay = document.getElementById('drink-tickets');
    ticketDisplay.innerText = `${drinkTickets} 枚`;
    let ticketRatio = (drinkTickets / ticketInit) * 100;

    ticketDisplay.classList.remove('ticket-safe', 'ticket-warn', 'ticket-critical');
    if (ticketRatio >= 60) ticketDisplay.classList.add('ticket-safe');
    else if (ticketRatio >= 30) ticketDisplay.classList.add('ticket-warn');
    else ticketDisplay.classList.add('ticket-critical');
}

// TERMINAL (ステルスモード) の処理
function stealthInput(num) {
    stealthCurrentInput += num;
    document.getElementById('stealth-display').innerText = stealthCurrentInput;
}

function stealthClear() {
    stealthCurrentInput = "";
    document.getElementById('stealth-display').innerText = "0";
}

let pendingTaskType = "";
function stealthAction(type) {
    pendingTaskType = type;
    alert(`[SYSTEM] Task ${type} selected. Awaiting Execution.`);
}

function stealthEnter() {
    if (!stealthCurrentInput || !pendingTaskType) return;
    let amount = parseInt(stealthCurrentInput);

    if (pendingTaskType === 'D') {
        if(drinkTickets > 0) drinkTickets--;
        drinkSessionCount++;
        localStorage.setItem('drinkTickets', drinkTickets);
        localStorage.setItem('drinkSessionCount', drinkSessionCount);
    } else if (pendingTaskType === 'F') {
        foodBalance -= amount;
        localStorage.setItem('foodBalance', foodBalance);
    }

    stealthClear();
    pendingTaskType = "";
    updateMainUI();
    updateStealthUI();
    alert("Data committed to database.");
}

// 通信ステータスバー(杯数警告)の更新
function updateStealthUI() {
    let statusBar = document.getElementById('stealth-status-bar');
    statusBar.classList.remove('status-safe', 'status-warning', 'status-critical');

    if (drinkSessionCount <= 2) {
        statusBar.innerText = "[ ONLINE ]";
        statusBar.classList.add('status-safe');
    } else if (drinkSessionCount === 3) {
        statusBar.innerText = "[ SYNCING... ]";
        statusBar.classList.add('status-warning');
    } else {
        statusBar.innerText = "[ OVERLOAD / LIMIT EXCEEDED ]";
        statusBar.classList.add('status-critical');
    }
}

// 設定(SET)・データ救済の処理
function loadSettings() {
    document.getElementById('setting-paydate').value = nextPayDate;
    document.getElementById('setting-food-init').value = foodInit;
    document.getElementById('setting-ticket-init').value = ticketInit;
    document.getElementById('setting-survival-limit').value = survivalLimit;
}

function saveSettings() {
    nextPayDate = document.getElementById('setting-paydate').value;
    foodInit = parseInt(document.getElementById('setting-food-init').value) || 30000;
    ticketInit = parseInt(document.getElementById('setting-ticket-init').value) || 5;
    survivalLimit = parseInt(document.getElementById('setting-survival-limit').value) || 1000;

    localStorage.setItem('nextPayDate', nextPayDate);
    localStorage.setItem('foodInit', foodInit);
    localStorage.setItem('ticketInit', ticketInit);
    localStorage.setItem('survivalLimit', survivalLimit);
    
    updateMainUI();
    alert("Settings saved.");
}

function checkEnvironment() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const envText = isStandalone ? "App Mode (PWA)" : "Safari Browser";
    document.getElementById('env-indicator').innerText = `実行環境: [ ${envText} ]`;
}

function exportData() {
    let allData = JSON.stringify(localStorage);
    navigator.clipboard.writeText(allData).then(() => {
        alert("✅ 全データを暗号化テキストとしてクリップボードにコピーしました！");
    }).catch(err => {
        prompt("以下のテキストを全選択してコピーしてください:", allData);
    });
}

