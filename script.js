/* ==========================================
   1. Data Initialization & Storage Rules
   ※絶対に既存データを上書きで消さない厳格な初期化
=========================================== */
const initData = (key, fallback) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch (e) {
    console.error(`Error loading ${key}:`, e);
    return fallback;
  }
};

let logs = initData('budget_logs', []);
let fixedCosts = initData('budget_fixed', []);
let vaults = initData('budget_vaults', [{ id: Date.now().toString(), name: 'メイン財布', balance: 0 }]);
let settings = initData('budget_settings', {
  foodBudget: 50000, drinkBudget: 30000, otherBudget: 20000,
  drinkTickets: 4, transferD: 0, transferO: 0
});

// Save wrapper
const saveData = () => {
  localStorage.setItem('budget_logs', JSON.stringify(logs));
  localStorage.setItem('budget_fixed', JSON.stringify(fixedCosts));
  localStorage.setItem('budget_vaults', JSON.stringify(vaults));
  localStorage.setItem('budget_settings', JSON.stringify(settings));
  updateAllUI();
};

/* ==========================================
   2. Core Logic & Math
=========================================== */
const getNextSalaryDate = () => {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  const todayDate = now.getDate();
  
  // 給料日を25日と仮定 (拡張可能)
  let targetDay = 25; 
  if (todayDate >= targetDay) month += 1; // 25日以降なら来月
  
  let salaryDate = new Date(year, month, targetDay);
  
  // 土日祝前倒しロジック (簡易版: 土日のみ対応)
  const dayOfWeek = salaryDate.getDay();
  if (dayOfWeek === 6) salaryDate.setDate(targetDay - 1); // Sat -> Fri
  if (dayOfWeek === 0) salaryDate.setDate(targetDay - 2); // Sun -> Fri
  
  return salaryDate;
};

const getDaysLeft = () => {
  const now = new Date();
  const nextSalary = getNextSalaryDate();
  const diffTime = Math.abs(nextSalary - now);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/* ==========================================
   3. UI Updates & Rendering
=========================================== */
const updateAllUI = () => {
  renderMain();
  renderTerminalLog();
  renderFixedCosts();
  renderVault();
};

const renderMain = () => {
  const daysLeft = getDaysLeft();
  document.getElementById('days-left').innerText = daysLeft;

  let spentF = 0, spentD = 0, spentO = 0;
  
  // 今月の支出集計 (簡易的に全ログから計算。本来は期間フィルター実装推奨)
  logs.forEach(log => {
    if(log.type === 'F') spentF += log.amount;
    if(log.type === 'D') spentD += log.amount;
    if(log.type === 'O') spentO += log.amount;
  });

  // Transfer計算
  const currentFoodBudget = settings.foodBudget - settings.transferD - settings.transferO;
  const currentDrinkBudget = settings.drinkBudget + settings.transferD;
  const currentOtherBudget = settings.otherBudget + settings.transferO;

  // 当日予算
  const remainingFood = currentFoodBudget - spentF;
  const dailyBudget = Math.floor(remainingFood / (daysLeft || 1));
  const dailyEl = document.getElementById('daily-budget');
  dailyEl.innerText = `¥${dailyBudget.toLocaleString()}`;
  if (dailyBudget < 1000) dailyEl.classList.add('red');
  else dailyEl.classList.remove('red');

  // メーター更新関数
  const updateBar = (id, spent, total) => {
    const percent = Math.min((spent / total) * 100, 100) || 0;
    document.getElementById(`${id}-bar`).style.width = `${percent}%`;
    document.getElementById(`${id}-stats`).innerText = `¥${spent.toLocaleString()} / ¥${total.toLocaleString()}`;
  };

  updateBar('food', spentF, currentFoodBudget);
  updateBar('drink', spentD, currentDrinkBudget);
  updateBar('other', spentO, currentOtherBudget);

  // チケット計算
  const ticketStatusEl = document.getElementById('ticket-status');
  ticketStatusEl.innerText = `🎫 チケット残り: ${settings.drinkTickets}回`;
  if (settings.drinkTickets <= 1) ticketStatusEl.classList.add('red');
  else ticketStatusEl.classList.remove('red');
};

/* ==========================================
   4. TERMINAL (Stealth Mode) Logic
=========================================== */
let termInput = "";
let termType = "";

const setTermType = (type) => {
  termType = type;
  document.getElementById('term-type-indicator').innerText = `TARGET:[TYPE_${type}] AWAITING_VALUE...`;
};

const inputNum = (num) => {
  termInput += num.toString();
  document.getElementById('term-display').innerText = termInput;
};

const clearNum = () => {
  termInput = "";
  document.getElementById('term-display').innerText = "_";
};

const undoLastLog = () => {
  if (logs.length > 0) {
    logs.pop();
    saveData();
    clearNum();
    document.getElementById('term-type-indicator').innerText = "LAST_ENTRY_REVERTED.";
  }
};

const submitLog = () => {
  if (!termType || termInput === "") return;
  const amount = parseInt(termInput, 10);
  const memo = document.getElementById('term-memo').value || "NO_MEMO";
  
  const newLog = {
    id: Date.now().toString(),
    date: new Date().toISOString(),
    type: termType,
    amount: amount,
    memo: memo,
    isPending: false
  };

  logs.push(newLog);
  
  // Dタイプならチケット消費
  if (termType === 'D' && settings.drinkTickets > 0) settings.drinkTickets--;
  
  saveData();
  clearNum();
  document.getElementById('term-memo').value = "";
  termType = "";
  document.getElementById('term-type-indicator').innerText = "LOG_SAVED. [AWAITING_INPUT...]";
};

const renderTerminalLog = () => {
  const miniList = document.getElementById('mini-log-list');
  const fullList = document.getElementById('full-log-list');
  miniList.innerHTML = "";
  fullList.innerHTML = "";

  const recentLogs = [...logs].reverse();

  recentLogs.forEach((log, index) => {
    // Mini Log (Dashboard) - Top 3
    if (index < 3) {
      const li = document.createElement('li');
      li.className = log.isPending ? 'pending' : '';
      li.innerText = `[${log.type}] ${log.amount} | ${log.memo}`;
      miniList.appendChild(li);
    }

    // Full Log (Modal)
    const fli = document.createElement('li');
    fli.className = log.isPending ? 'pending' : '';
    fli.innerHTML = `
      <span>[${log.type}] ${log.amount} | ${log.memo}</span>
      <div class="term-act-btns">
        <button class="pending-btn" onclick="togglePending('${log.id}')">FLAG</button>
        <button onclick="editLog('${log.id}')">EDIT</button>
        <button class="del-btn" onclick="deleteLog('${log.id}')">DEL</button>
      </div>
    `;
    fullList.appendChild(fli);
  });
};

const togglePending = (id) => {
  const log = logs.find(l => l.id === id);
  if (log) log.isPending = !log.isPending;
  saveData();
};

const deleteLog = (id) => {
  logs = logs.filter(l => l.id !== id);
  saveData();
};

const editLog = (id) => {
  const log = logs.find(l => l.id === id);
  if (log) {
    setTermType(log.type);
    termInput = log.amount.toString();
    document.getElementById('term-display').innerText = termInput;
    document.getElementById('term-memo').value = log.memo;
    deleteLog(id); // 既存を消して再入力待機状態にする
    closeModal('modal-log');
  }
};

/* ==========================================
   5. FIXD (Fixed Costs) Logic
=========================================== */
const renderFixedCosts = () => {
  const list = document.getElementById('fixed-list');
  list.innerHTML = "";
  fixedCosts.sort((a, b) => a.day - b.day).forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${item.day}日: ${item.name} (¥${parseInt(item.amount).toLocaleString()})</span>
      <div class="actions">
        <button onclick="editFixed('${item.id}')">編集</button>
        <button onclick="deleteFixed('${item.id}')" style="color:var(--danger)">削除</button>
      </div>
    `;
    list.appendChild(li);
  });
};

const saveFixedCost = (e) => {
  e.preventDefault();
  const id = document.getElementById('fixed-id').value;
  const day = document.getElementById('fixed-day').value;
  const name = document.getElementById('fixed-name').value;
  const amount = document.getElementById('fixed-amount').value;

  if (id) {
    const idx = fixedCosts.findIndex(f => f.id === id);
    if(idx > -1) fixedCosts[idx] = { id, day, name, amount };
  } else {
    fixedCosts.push({ id: Date.now().toString(), day, name, amount });
  }

  document.getElementById('fixed-form').reset();
  document.getElementById('fixed-id').value = "";
  saveData();
};

const editFixed = (id) => {
  const item = fixedCosts.find(f => f.id === id);
  if (item) {
    document.getElementById('fixed-id').value = item.id;
    document.getElementById('fixed-day').value = item.day;
    document.getElementById('fixed-name').value = item.name;
    document.getElementById('fixed-amount').value = item.amount;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

const deleteFixed = (id) => {
  fixedCosts = fixedCosts.filter(f => f.id !== id);
  saveData();
};

/* ==========================================
   6. VAULT (Cash Positions) Logic
=========================================== */
const renderVault = () => {
  const list = document.getElementById('vault-list');
  list.innerHTML = "";
  let total = 0;

  vaults.forEach((v, index) => {
    total += parseInt(v.balance || 0, 10);
    const div = document.createElement('div');
    div.className = 'vault-row';
    div.innerHTML = `
      <input type="text" value="${v.name}" onchange="updateVault('${v.id}', 'name', this.value)">
      <input type="number" value="${v.balance}" oninput="updateVault('${v.id}', 'balance', this.value)">
      <button class="del-btn" onclick="deleteVault('${v.id}')">×</button>
    `;
    list.appendChild(div);
  });

  document.getElementById('vault-total').innerText = `¥${total.toLocaleString()}`;
};

const addVaultAccount = () => {
  vaults.push({ id: Date.now().toString(), name: '新規口座', balance: 0 });
  saveData();
};

const updateVault = (id, field, value) => {
  const account = vaults.find(v => v.id === id);
  if (account) {
    account[field] = value;
    saveData();
  }
};

const deleteVault = (id) => {
  vaults = vaults.filter(v => v.id !== id);
  saveData();
};

/* ==========================================
   7. CSV Export / Import (3 Systems Separation)
=========================================== */
const generateCSV = (dataArray, headers, fields) => {
  const bom = "\uFEFF"; // Excel用BOM
  const rows = dataArray.map(obj => fields.map(f => `"${String(obj[f]).replace(/"/g, '""')}"`).join(","));
  return bom + headers.join(",") + "\n" + rows.join("\n");
};

const exportCSV = (type) => {
  let csvContent = "";
  let fileName = "";

  if (type === 'log') {
    csvContent = generateCSV(logs, ['ID', 'Date', 'Type', 'Amount', 'Memo', 'Pending'], ['id', 'date', 'type', 'amount', 'memo', 'isPending']);
    fileName = "ACTIVITY_LOG.csv";
  } else if (type === 'fixed') {
    csvContent = generateCSV(fixedCosts, ['ID', 'Day', 'Name', 'Amount'], ['id', 'day', 'name', 'amount']);
    fileName = "FIXED_COST.csv";
  } else if (type === 'vault') {
    csvContent = generateCSV(vaults, ['ID', 'Name', 'Balance'], ['id', 'name', 'balance']);
    fileName = "VAULT_DATA.csv";
  }

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
};

const importCSV = (e, type) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const text = event.target.result;
    const lines = text.split('\n').filter(l => l.trim() !== '');
    if (lines.length <= 1) return; // Header only

    // 簡易CSVパーサー (複雑なカンマエスケープは非対応のシンプル版)
    const parseLine = (line) => line.split(',').map(val => val.replace(/^"|"$/g, '').trim());

    if (type === 'log') {
      logs = lines.slice(1).map(line => {
        const [id, date, logType, amount, memo, isPending] = parseLine(line);
        return { id, date, type: logType, amount: parseInt(amount, 10), memo, isPending: isPending === 'true' };
      });
    } else if (type === 'fixed') {
      fixedCosts = lines.slice(1).map(line => {
        const [id, day, name, amount] = parseLine(line);
        return { id, day: parseInt(day, 10), name, amount: parseInt(amount, 10) };
      });
    } else if (type === 'vault') {
      vaults = lines.slice(1).map(line => {
        const [id, name, balance] = parseLine(line);
        return { id, name, balance: parseInt(balance, 10) };
      });
    }
    
    saveData();
    alert(`[${type}] データのインポートが完了しました。`);
  };
  reader.readAsText(file);
  e.target.value = ''; // Reset input
};

/* ==========================================
   8. Events, Navigation & Modals
=========================================== */
const switchTab = (tabId) => {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  
  document.getElementById(`tab-${tabId}`).classList.add('active');
  event.currentTarget.classList.add('active');

  if (tabId === 'terminal') setInterval(updateTermClock, 1000);
};

const updateTermClock = () => {
  const now = new Date();
  document.getElementById('term-clock').innerText = now.toISOString().split('T')[1].split('.')[0];
};

const showModal = (id) => document.getElementById(id).classList.add('active');
const closeModal = (id) => document.getElementById(id).classList.remove('active');
const showLogModal = () => showModal('modal-log');

const executeTransfer = () => {
  const to = document.getElementById('transfer-to').value;
  const amt = parseInt(document.getElementById('transfer-amount').value, 10);
  if (!amt || amt <= 0) return;

  if (to === 'D') settings.transferD += amt;
  if (to === 'O') settings.transferO += amt;
  
  saveData();
  closeModal('modal-transfer');
  document.getElementById('transfer-amount').value = '';
};

// Long Press Logic for Main Budgets
let pressTimer;
document.querySelectorAll('.long-press-target').forEach(el => {
  el.addEventListener('touchstart', () => {
    pressTimer = setTimeout(() => showModal('modal-transfer'), 800);
  });
  el.addEventListener('touchend', () => clearTimeout(pressTimer));
  el.addEventListener('mousedown', () => {
    pressTimer = setTimeout(() => showModal('modal-transfer'), 800);
  });
  el.addEventListener('mouseup', () => clearTimeout(pressTimer));
  el.addEventListener('mouseleave', () => clearTimeout(pressTimer));
});

// Initialize
window.onload = updateAllUI;

