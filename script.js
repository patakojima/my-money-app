:root {
    --bg-main: #f3f4f6;
    --card-bg: #ffffff;
    --text-dark: #1c1c1e;
    --text-gray: #8e8e93;
    --blue: #007aff;
    --green: #34c759;
    --border: #e5e5ea;
}

* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
body { background: var(--bg-main); color: var(--text-dark); padding-bottom: 90px; }

.header { padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; }
.header-title { color: var(--blue); font-weight: 800; font-size: 14px; letter-spacing: 1px; font-family: monospace; }
.header-status { font-size: 10px; color: var(--text-gray); display: flex; align-items: center; font-weight: bold; font-family: monospace; }
.dot { height: 6px; width: 6px; background-color: var(--green); border-radius: 50%; display: inline-block; margin-right: 4px; }

.page { display: none; padding: 0 15px; }
.page.active { display: block; }

.title-area { display: flex; justify-content: center; align-items: center; margin: 10px 0 20px; gap: 10px;}
.title-area h2 { font-size: 20px; font-weight: 800; color: var(--text-dark); }
.edit-btn { background: #e5f0ff; color: var(--blue); border: none; padding: 6px 12px; border-radius: 16px; font-size: 12px; font-weight: bold; cursor: pointer; }

.card { background: var(--card-bg); border-radius: 16px; padding: 20px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }

.balance-card { text-align: center; }
.balance-card .label { font-size: 12px; color: var(--text-gray); font-weight: bold; margin-bottom: 8px; }
.balance-card .amount { font-size: 32px; font-weight: 800; }

.budget-row { background: var(--card-bg); border-radius: 16px; display: flex; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); padding: 20px 0;}
.budget-box { flex: 1; text-align: center; }
.budget-box .label { font-size: 12px; color: var(--text-gray); font-weight: bold; margin-bottom: 8px; }
.budget-box .amount { font-size: 20px; font-weight: 800; }
.divider { width: 1px; background: var(--border); }

.metrics-card { background: #f8fafc; border: 1px solid #e2e8f0; }
.metrics-title { font-size: 11px; font-weight: 800; color: #94a3b8; margin-bottom: 16px; font-family: monospace; }
.metric-row { margin-bottom: 14px; }
.metric-row:last-child { margin-bottom: 0; }
.metric-labels { display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; color: var(--text-gray); margin-bottom: 6px; font-family: monospace; }
.metric-labels span span { margin-left: 5px; color: var(--text-dark); font-family: -apple-system, sans-serif; }
.progress-bg { background: #e2e8f0; height: 8px; border-radius: 4px; overflow: hidden; }
.progress-fill { background: var(--green); height: 100%; width: 100%; transition: 0.3s; }

.manual-record .input-row { display: flex; gap: 10px; margin-bottom: 10px; }
input, select { width: 100%; padding: 14px; background: #f2f2f7; border: 1px solid transparent; border-radius: 8px; font-size: 15px; margin-bottom: 10px; color: var(--text-dark); font-weight: 500; }
input:focus, select:focus { outline: none; border-color: var(--blue); background: #fff; }
.record-btn { background: #34c759; color: white; border: none; padding: 14px; border-radius: 8px; width: 100%; font-size: 16px; font-weight: bold; margin-top: 5px; cursor: pointer; }

.item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
.item:last-child { border-bottom: none; }
.item-amount { font-weight: bold; }
.expense { color: var(--text-dark); }
.income { color: var(--green); }

.tab-bar { position: fixed; bottom: 0; left: 0; width: 100%; background: rgba(255,255,255,0.9); backdrop-filter: blur(10px); border-top: 1px solid var(--border); display: flex; height: 65px; padding-bottom: env(safe-area-inset-bottom); z-index: 100;}
.tab { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 10px; color: var(--text-gray); font-weight: bold; cursor: pointer; }
.tab.active { color: var(--blue); }
.tab .icon { font-size: 20px; margin-bottom: 2px; filter: grayscale(100%); opacity: 0.5;}
.tab.active .icon { filter: none; opacity: 1;}

.modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 1000; padding: 20px; }
.modal-content { background: var(--card-bg); border-radius: 16px; padding: 20px; width: 100%; max-width: 400px; }
.btn { flex: 1; padding: 12px; border-radius: 8px; font-weight: bold; border: none; cursor: pointer; }
.btn-muted { background: var(--border); color: var(--text-dark); }
.btn-blue { background: var(--blue); color: white; }


