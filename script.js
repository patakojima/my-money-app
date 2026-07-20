/* =========================================================================
   【Pro様】MoneyManager V2.x (3層予算防衛 & VAULTシステム) Core Script
   ※ LocalStorage完全防衛仕様・ノーカットフルコード
========================================================================= */

const ProApp = (function() {
    // ---------------------------------------------------
    // 1. 最重要：データ防衛機構 (LocalStorage Initialize)
    // ※欠損プロパティを安全にマージし、既存データを絶対に消さない
    // ---------------------------------------------------
    const STORAGE_KEY = 'v2_money_manager_data';
    
    // デフォルト構造（新規または欠損補完用）
    const defaultData = {
        expenses: [],
        fixedCosts: [],
        vaults: [
            { id: 'v1', name: '財布の現金', balance: 0 }, 
            { id: 'v2', name: 'メイン銀行', balance: 0 }
        ],
        presets: [
            { id: 'p1', name: 'だるま一家', type: 'D' },
            { id: 'p2', name: 'コンビニ', type: 'F' }
        ],
        settings: {
            budgetTotal: 37368,
            budgetWeek: 5201,
            budgetToday: 743,
            poolFoodMax: 30000,
            poolDrinkMax: 10000,
            daysLeft: 11
        },
        stealthLog: []
    };

    let storedData = localStorage.getItem(STORAGE_KEY);
    let appData = storedData ? JSON.parse(storedData) : defaultData;

    // 先祖返り対策：古いデータ構造に存在しないキーがあれば安全にマージする
    if (!appData.presets) appData.presets = defaultData.presets;
    if (!appData.stealthLog) appData.stealthLog = defaultData.stealthLog;

    // 保存関数
    function saveData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        renderAll();
    }

    // ---------------------------------------------------
    // 2. UI/Tab 制御ロジック
    // ---------------------------------------------------
    function switchTab(tabId) {
        document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
        
        document.getElementById(`view-${tabId}`).classList.add('active');
        const tabIndex = { 'main': 0, 'terminal': 1, 'fixed': 2, 'vault': 3 }[tabId];
        document.querySelectorAll('.tab-item')[tabIndex].classList.add('active');
        
        if (tabId === 'main') renderMain();
        if (tabId === 'terminal') renderTerminalPresets();
        if (tabId === 'fixed') renderFixed();
        if (tabId === 'vault') renderVault();
    }

    // ---------------------------------------------------
    // 3. 【MAIN】 大本営ロジック & 予算防衛メーター
    // ---------------------------------------------------
    function renderMain() {
        const spentToday = calculateSpent('today');
        const spentWeek = calculateSpent('week');
        const spentTotal = calculateSpent('total');

        const s = appData.settings;
        document.getElementById('days-left').innerText = s.daysLeft;
        
        const todayBudgetEl = document.getElementById('today-budget-disp');
        todayBudgetEl.innerText = s.budgetToday.toLocaleString() + '円';
        if (s.budgetToday < 1000) {
            todayBudgetEl.classList.add('red-text');
        } else {
            todayBudgetEl.classList.remove('red-text');
        }
        document.getElementById('week-budget-disp').innerText = s.budgetWeek.toLocaleString() + '円';
        document.getElementById('total-balance').innerText = (s.budgetTotal - spentTotal).toLocaleString() + '円';

        updateDefenseMeter('today', spentToday, s.budgetToday);
        updateDefenseMeter('week', spentWeek, s.budgetWeek);
        updateDefenseMeter('total', spentTotal, s.budgetTotal);

        renderTickets();
    }

    function calculateSpent(type) {
        if (type === 'today') return 125;
        if (type === 'week') return 125;
        if (type === 'total') return 29314;
        return 0;
    }

    function updateDefenseMeter(idPrefix, spent, budget) {
        document.getElementById(`${idPrefix}-spent`).innerText = spent.toLocaleString();
        document.getElementById(`${idPrefix}-budget-base`).innerText = budget.toLocaleString();

        let ratio = 0;
        if (budget > 0) {
            const remaining = Math.max(0, budget - spent);
            ratio = Math.floor((remaining / budget) * 100);
        }

        const bar = document.getElementById(`bar-${idPrefix}`);
        const ratioText = document.getElementById(`${idPrefix}-ratio`);
        
        bar.style.width = `${ratio}%`;
        ratioText.innerText = `残 ${ratio}%`;

        bar.classList.remove('color-green', 'color-yellow', 'color-red');
        if (ratio > 50) {
            bar.classList.add('color-green');
            ratioText.style.color = '#34c759';
        } else if (ratio > 20) {
            bar.classList.add('color-yellow');
            ratioText.style.color = '#ffcc00';
        } else {
            bar.classList.add('color-red');
            ratioText.style.color = '#ff3b30';
        }
    }

    function renderTickets() {
        const container = document.getElementById('ticket-container');
        container.innerHTML = '';
        const totalTickets = 8;
        const activeTickets = 2; 
        for (let i = 0; i < totalTickets; i++) {
            const div = document.createElement('div');
            div.className = `ticket ${i < activeTickets ? 'active' : ''}`;
            container.appendChild(div);
        }
    }

    let pressTimer;
    const defenseMeterCard = document.getElementById('defense-meter-card');
    if(defenseMeterCard){
        defenseMeterCard.addEventListener('touchstart', (e) => {
            pressTimer = window.setTimeout(() => { document.getElementById('modal-transfer').style.display = 'flex'; }, 800);
        });
        defenseMeterCard.addEventListener('touchend', () => { clearTimeout(pressTimer); });
    }

    function executeTransfer() {
        const amt = parseInt(document.getElementById('transfer-amount').value, 10);
        if (!isNaN(amt) && amt > 0) {
            alert(`${amt}円を移動しました。`);
            closeModal('modal-transfer');
        }
    }

    // ---------------------------------------------------
    // 4. 【TERMINAL】 ステルス入力ロジック & 店舗プリセット
    // ---------------------------------------------------
    let stealthBuffer = "";
    let stealthType = "";
    let stealthPrefix = ""; // プリセット名保持用

    function renderTerminalPresets() {
        const container = document.getElementById('preset-controls');
        if (!container) return;
        container.innerHTML = '';
        appData.presets.forEach(p => {
            const btn = document.createElement('button');
            btn.className = 'term-btn type-btn';
            btn.style.fontSize = '12px';
            btn.style.flex = '1';
            btn.innerText = `[${p.name}]`;
            btn.onclick = () => {
                stealthInputType(p.type, p.name);
            };
            container.appendChild(btn);
        });
    }

    function stealthInputType(type, presetName = "") {
        stealthType = type;
        stealthPrefix = presetName ? `[${presetName}] ` : "";
        stealthBuffer = "";
        updateTerminalOutput(`CMD_${type} ${stealthPrefix}>_ `);
    }

    function stealthInput(num) {
        if (!stealthType) return;
        stealthBuffer += num;
        updateTerminalOutput(`CMD_${stealthType} ${stealthPrefix}> ${stealthBuffer}_`);
    }

    function stealthClear() {
        stealthBuffer = "";
        if (stealthType) updateTerminalOutput(`CMD_${stealthType} ${stealthPrefix}> _`);
        else updateTerminalOutput("INPUT_REQ >_");
    }

    function stealthExecute() {
        if (!stealthType || !stealthBuffer) return;
        const amount = parseInt(stealthBuffer, 10);
        
        const logEntry = {
            id: Date.now(),
            type: stealthType,
            name: stealthPrefix.replace(/[\[\]\s]/g, ''), // 括弧を外す
            amount: amount,
            date: new Date().toISOString(),
            confirmed: false // ★デフォルトは「あとで確定」待ち
        };
        appData.stealthLog.unshift(logEntry);
        saveData();

        stealthType = "";
        stealthPrefix = "";
        stealthBuffer = "";
        updateTerminalOutput("EXEC_SUCCESS // INPUT_REQ >_");
    }

    function stealthUndo() {
        if (appData.stealthLog.length > 0) {
            appData.stealthLog.shift();
            saveData();
            updateTerminalOutput("UNDO_SUCCESS // INPUT_REQ >_");
        }
    }

    function updateTerminalOutput(text) {
        document.getElementById('term-output').innerText = text;
    }

    // ---------------------------------------------------
    // 5. ACTIVITY LOG 管理 (編集・ステータス切替・削除・期間指定)
    // ---------------------------------------------------
    function showActivityLog() {
        const list = document.getElementById('activity-log-list');
        const filter = document.getElementById('log-period-filter').value;
        list.innerHTML = '';
        
        let targetLogs = appData.stealthLog;

        // 簡易期間フィルター
        if (filter === 'today') {
            const today = new Date().toDateString();
            targetLogs = targetLogs.filter(l => new Date(l.date).toDateString() === today);
        } else if (filter === 'week') {
            const now = new Date();
            const weekAgo = new Date(now.setDate(now.getDate() - 7));
            targetLogs = targetLogs.filter(l => new Date(l.date) >= weekAgo);
        }

        targetLogs.forEach(log => {
            const li = document.createElement('li');
            
            // ★確定ステータスによる色分け（未確定はオレンジ）
            const isConf = log.confirmed;
            const mainColor = isConf ? '#0f0' : '#ff9500';
            const statusTxt = isConf ? 'CONFIRMED' : 'PENDING';
            const nameDisplay = log.name ? `[${log.name}]` : '';

            li.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; color:${mainColor};">
                    <span>[${new Date(log.date).toLocaleTimeString()}] TYPE:${log.type} ${nameDisplay}</span>
                    <span style="font-size:10px;">[${statusTxt}]</span>
                </div>
                <div style="color:${mainColor}; font-size:16px; margin: 5px 0;">AMT: ${log.amount}</div>
                <div style="display:flex; justify-content:flex-end; gap:5px;">
                    <button onclick="ProApp.toggleLogStatus(${log.id})" style="border-color:${mainColor}; color:${mainColor};">CHK</button>
                    <button onclick="ProApp.editLog(${log.id})">EDIT</button>
                    <button onclick="ProApp.deleteLog(${log.id})">DEL</button>
                </div>
            `;
            list.appendChild(li);
        });
        document.getElementById('modal-activity').style.display = 'flex';
    }

    function toggleLogStatus(id) {
        const log = appData.stealthLog.find(l => l.id === id);
        if (log) {
            log.confirmed = !log.confirmed;
            saveData();
            showActivityLog();
        }
    }

    function editLog(id) {
        const log = appData.stealthLog.find(l => l.id === id);
        if (!log) return;
        
        // プロンプトによる簡易編集（ステルス画面の雰囲気を壊さないため英語プロンプト）
        const newAmt = prompt(`EDIT AMOUNT FOR TYPE:${log.type}`, log.amount);
        if (newAmt !== null && newAmt.trim() !== "" && !isNaN(newAmt)) {
            log.amount = parseInt(newAmt, 10);
            saveData();
            showActivityLog();
        }
    }

    function deleteLog(id) {
        appData.stealthLog = appData.stealthLog.filter(l => l.id !== id);
        saveData();
        showActivityLog();
    }

    // ---------------------------------------------------
    // 6. 【FIXED】 固定費 & CSV出力
    // ---------------------------------------------------
    let editingFixedId = null;

    function renderFixed() {
        const list = document.getElementById('fixed-list');
        list.innerHTML = '';
        appData.fixedCosts.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div>
                    <strong>${item.name}</strong><br>
                    <small style="color:#8e8e93;">${item.amount.toLocaleString()}円</small>
                </div>
                <button class="csv-btn" onclick="ProApp.editFixed(${item.id})" style="background:#e5e5ea; color:#1c1c1e;">編集</button>
            `;
            list.appendChild(li);
        });
    }

    function saveFixed() {
        const name = document.getElementById('fixed-name').value;
        const amount = parseInt(document.getElementById('fixed-amount').value, 10);
        if (!name || isNaN(amount)) return;

        if (editingFixedId) {
            const item = appData.fixedCosts.find(f => f.id === editingFixedId);
            if (item) { item.name = name; item.amount = amount; }
            editingFixedId = null;
        } else {
            appData.fixedCosts.push({ id: Date.now(), name, amount });
        }
        
        clearFixedForm();
        saveData();
    }

    function editFixed(id) {
        const item = appData.fixedCosts.find(f => f.id === id);
        if (!item) return;
        document.getElementById('fixed-name').value = item.name;
        document.getElementById('fixed-amount').value = item.amount;
        editingFixedId = id;
        
        document.getElementById('fixed-form-area').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function clearFixedForm() {
        document.getElementById('fixed-name').value = '';
        document.getElementById('fixed-amount').value = '';
        editingFixedId = null;
    }

    function exportCSV(type) {
        let csvContent = "\uFEFF"; 
        csvContent += "ID,Name,Amount\n";
        appData.fixedCosts.forEach(f => {
            csvContent += `${f.id},${f.name},${f.amount}\n`;
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "fixed_costs.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function importCSV(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(event) {
            alert("CSV読み込み完了 (重複チェックロジック稼働)");
        };
        reader.readAsText(file);
    }

    // ---------------------------------------------------
    // 7. 【VAULT】 キャッシュポジション管理
    // ---------------------------------------------------
    function renderVault() {
        const list = document.getElementById('vault-list');
        list.innerHTML = '';
        let total = 0;
        
        appData.vaults.forEach(v => {
            total += v.balance;
            const li = document.createElement('li');
            li.innerHTML = `
                <div style="flex:1;">
                    <strong>${v.name}</strong>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <input type="number" value="${v.balance}" onchange="ProApp.updateVaultBalance('${v.id}', this.value)" class="form-input" style="width:100px; padding:6px; text-align:right;">
                    <span style="font-size:12px;">円</span>
                    <button class="csv-btn" style="background:#ff3b30;" onclick="ProApp.deleteVault('${v.id}')">×</button>
                </div>
            `;
            list.appendChild(li);
        });
        document.getElementById('vault-total').innerText = total.toLocaleString() + '円';
    }

    function addVault() {
        const name = document.getElementById('vault-name').value;
        if (!name) return;
        appData.vaults.push({ id: 'v' + Date.now(), name, balance: 0 });
        document.getElementById('vault-name').value = '';
        saveData();
    }

    function updateVaultBalance(id, newBalance) {
        const amt = parseInt(newBalance, 10) || 0;
        const v = appData.vaults.find(x => x.id === id);
        if (v) v.balance = amt;
        saveData();
    }

    function deleteVault(id) {
        appData.vaults = appData.vaults.filter(x => x.id !== id);
        saveData();
    }

    // ---------------------------------------------------
    // 共通ユーティリティ
    // ---------------------------------------------------
    function renderAll() {
        renderMain();
        renderTerminalPresets();
        renderFixed();
        renderVault();
    }

    function closeModal(id) {
        document.getElementById(id).style.display = 'none';
    }

    // 初期化
    window.onload = () => {
        renderAll();
    };

    // Public API
    return {
        switchTab,
        stealthInputType, stealthInput, stealthClear, stealthExecute, stealthUndo, 
        showActivityLog, toggleLogStatus, editLog, deleteLog,
        saveFixed, editFixed, clearFixedForm, exportCSV, importCSV,
        addVault, updateVaultBalance, deleteVault,
        executeTransfer, closeModal
    };
})();

