/* ===================================================================
   스마트 가계부 - Main Application JS
   =================================================================== */

// ===== Global State =====
const APP = {
    categories: [],
    transactions: [],
    budgets: [],
    recurring: [],
    currentTab: 'dashboard',
    listPage: 1,
    listPageSize: 15,
    listSort: { field: 'date', dir: 'desc' },
    statsType: 'expense',
    adminType: 'expense',
    charts: {},
};

// ===== Utility Helpers =====
const Utils = {
    formatNumber(n) {
        return Number(n || 0).toLocaleString('ko-KR');
    },
    formatCurrency(n) {
        return this.formatNumber(n) + '원';
    },
    today() {
        const d = new Date();
        return d.toISOString().split('T')[0];
    },
    currentYM() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    },
    parseAmount(s) {
        return parseInt(String(s).replace(/[^0-9]/g, '')) || 0;
    },
    uuid() {
        return 'xxxx-xxxx-xxxx'.replace(/x/g, ()=>((Math.random()*16)|0).toString(16));
    },
    paymentLabel(v) {
        return {card:'카드', cash:'현금', transfer:'이체', etc:'기타'}[v] || v;
    },
    typeLabel(v) {
        return {expense:'지출', income:'수입'}[v] || v;
    },
    debounce(fn, ms=300) {
        let t;
        return (...a) => { clearTimeout(t); t = setTimeout(()=>fn(...a), ms); };
    },
    getMonthRange(ym) {
        const [y,m] = ym.split('-').map(Number);
        const start = `${y}-${String(m).padStart(2,'0')}-01`;
        const end = new Date(y, m, 0);
        const endStr = `${y}-${String(m).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;
        return { start, end: endStr };
    },
    getYearRange(y) {
        return { start: `${y}-01-01`, end: `${y}-12-31` };
    }
};

// ===== Default Categories =====
const DEFAULT_CATEGORIES = [
    {id:"cat_exp_food",type:"expense",name:"식비",keywords:["식당","마트","편의점","배달","치킨","피자","카페","커피","스타벅스","맥도날드","버거킹","김밥","떡볶이","배민","요기요","쿠팡이츠"],sort_order:1,is_default:true,deleted:false},
    {id:"cat_exp_transport",type:"expense",name:"교통",keywords:["택시","버스","지하철","주유","주차","톨게이트","KTX","고속버스","카카오택시","티머니"],sort_order:2,is_default:true,deleted:false},
    {id:"cat_exp_housing",type:"expense",name:"주거/통신",keywords:["월세","관리비","전기","가스","수도","인터넷","통신","SKT","KT","LG","넷플릭스","유튜브"],sort_order:3,is_default:true,deleted:false},
    {id:"cat_exp_medical",type:"expense",name:"의료/건강",keywords:["병원","약국","치과","안과","피부과","한의원","건강검진","약","헬스","PT","운동"],sort_order:4,is_default:true,deleted:false},
    {id:"cat_exp_shopping",type:"expense",name:"쇼핑",keywords:["옷","신발","가방","쿠팡","네이버쇼핑","11번가","G마켓","무신사","올리브영","다이소","백화점"],sort_order:5,is_default:true,deleted:false},
    {id:"cat_exp_culture",type:"expense",name:"문화/여가",keywords:["영화","공연","여행","호텔","숙소","에어비앤비","게임","도서","책"],sort_order:6,is_default:true,deleted:false},
    {id:"cat_exp_education",type:"expense",name:"교육",keywords:["학원","학비","수업료","인강","강의","교재","시험"],sort_order:7,is_default:true,deleted:false},
    {id:"cat_exp_insurance",type:"expense",name:"보험/세금",keywords:["보험","세금","국민연금","건강보험","자동차보험","재산세","소득세"],sort_order:8,is_default:true,deleted:false},
    {id:"cat_exp_other",type:"expense",name:"기타지출",keywords:[],sort_order:99,is_default:true,deleted:false},
    {id:"cat_inc_salary",type:"income",name:"급여",keywords:["급여","월급","연봉","보너스","상여금","성과급"],sort_order:1,is_default:true,deleted:false},
    {id:"cat_inc_side",type:"income",name:"부수입",keywords:["프리랜서","알바","부업","아르바이트","외주"],sort_order:2,is_default:true,deleted:false},
    {id:"cat_inc_invest",type:"income",name:"투자수익",keywords:["이자","배당","주식","펀드","적금","예금"],sort_order:3,is_default:true,deleted:false},
    {id:"cat_inc_other",type:"income",name:"기타수입",keywords:["용돈","환급","캐시백","포인트"],sort_order:4,is_default:true,deleted:false}
];

// ===== localStorage Storage Layer =====
const Store = {
    _getTable(table) {
        try {
            const raw = localStorage.getItem(`smartbook_${table}`);
            return raw ? JSON.parse(raw) : null;
        } catch(e) {
            return null;
        }
    },
    _setTable(table, data) {
        localStorage.setItem(`smartbook_${table}`, JSON.stringify(data));
    },
    getAll(table) {
        let data = this._getTable(table);
        // 카테고리 테이블에 데이터가 없으면 기본값 세팅
        if (!data && table === 'categories') {
            data = [...DEFAULT_CATEGORIES];
            this._setTable(table, data);
        }
        return data || [];
    },
    create(table, row) {
        const data = this.getAll(table);
        if (!row.id) row.id = Utils.uuid();
        row.created_at = Date.now();
        row.updated_at = Date.now();
        data.push(row);
        this._setTable(table, data);
        return row;
    },
    update(table, id, newRow) {
        const data = this.getAll(table);
        const idx = data.findIndex(r => r.id === id);
        if (idx === -1) return null;
        newRow.id = id;
        newRow.updated_at = Date.now();
        newRow.created_at = data[idx].created_at || Date.now();
        data[idx] = newRow;
        this._setTable(table, data);
        return newRow;
    },
    patch(table, id, partial) {
        const data = this.getAll(table);
        const idx = data.findIndex(r => r.id === id);
        if (idx === -1) return null;
        Object.assign(data[idx], partial, { updated_at: Date.now() });
        this._setTable(table, data);
        return data[idx];
    },
    remove(table, id) {
        const data = this.getAll(table);
        const idx = data.findIndex(r => r.id === id);
        if (idx !== -1) {
            data[idx].deleted = true;
            data[idx].updated_at = Date.now();
            this._setTable(table, data);
        }
    },
    clearTable(table) {
        localStorage.removeItem(`smartbook_${table}`);
    },
    exportAll() {
        return {
            categories: this.getAll('categories'),
            transactions: this.getAll('transactions'),
            budgets: this.getAll('budgets'),
            recurring: this.getAll('recurring')
        };
    },
    importAll(backup) {
        if (backup.categories) this._setTable('categories', backup.categories);
        if (backup.transactions) this._setTable('transactions', backup.transactions);
        if (backup.budgets) this._setTable('budgets', backup.budgets);
        if (backup.recurring) this._setTable('recurring', backup.recurring);
    }
};

// ===== Backward-compatible API (wraps Store) =====
const API = {
    async get(table)            { return Store.getAll(table); },
    async create(table, data)   { return Store.create(table, data); },
    async update(table, id, d)  { return Store.update(table, id, d); },
    async patch(table, id, d)   { return Store.patch(table, id, d); },
    async remove(table, id)     { return Store.remove(table, id); }
};

// ===== Data Loading =====
async function loadAllData() {
    try {
        const cats      = await API.get('categories');
        const txs       = await API.get('transactions');
        const budgets   = await API.get('budgets');
        const recurring = await API.get('recurring');

        APP.categories  = cats.filter(c => !c.deleted);
        APP.transactions = txs.filter(t => !t.deleted);
        APP.budgets     = budgets.filter(b => !b.deleted);
        APP.recurring   = recurring.filter(r => !r.deleted);
    } catch(e) {
        console.error('Data load error:', e);
    }
}

// ===== Theme =====
function initTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeBtn(saved);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeBtn(next);
    // Redraw charts
    Object.values(APP.charts).forEach(c => c && c.update && c.update());
}

function updateThemeBtn(theme) {
    const btn = document.getElementById('themeToggle');
    btn.innerHTML = theme === 'light' 
        ? '<i class="fas fa-moon"></i><span>다크 모드</span>' 
        : '<i class="fas fa-sun"></i><span>라이트 모드</span>';
}

// ===== Navigation =====
function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = item.getAttribute('data-tab');
            switchTab(tab);
            // Close mobile sidebar
            document.getElementById('sidebar').classList.remove('open');
            document.querySelector('.sidebar-overlay')?.classList.remove('active');
        });
    });

    document.getElementById('hamburger').addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('open');
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
            overlay.addEventListener('click', () => {
                document.getElementById('sidebar').classList.remove('open');
                overlay.classList.remove('active');
            });
        }
        overlay.classList.add('active');
    });

    document.getElementById('sidebarClose').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('open');
        document.querySelector('.sidebar-overlay')?.classList.remove('active');
    });

    document.getElementById('quickAddBtn').addEventListener('click', () => switchTab('add'));
}

const PAGE_TITLES = {
    dashboard: '대시보드', add: '내역 입력', list: '내역 목록',
    stats: '통계', budget: '예산 관리', recurring: '반복 거래',
    admin: '분류 관리', data: '데이터 관리'
};

function switchTab(tab) {
    APP.currentTab = tab;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.getAttribute('data-tab') === tab));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.toggle('active', tc.id === `tab-${tab}`));
    document.getElementById('pageTitle').textContent = PAGE_TITLES[tab] || '';
    
    // Tab-specific refresh
    switch(tab) {
        case 'dashboard': renderDashboard(); break;
        case 'add': refreshCategorySelect(); break;
        case 'list': renderList(); break;
        case 'stats': renderStats(); break;
        case 'budget': renderBudget(); break;
        case 'recurring': renderRecurring(); break;
        case 'admin': renderAdmin(); break;
    }
}

// ===== Toast =====
function showToast(msg, type='info') {
    const icons = {success:'fa-check-circle', error:'fa-exclamation-circle', warning:'fa-exclamation-triangle', info:'fa-info-circle'};
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== Modal =====
function openModal(title, bodyHTML, footerHTML='') {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHTML;
    document.getElementById('modalFooter').innerHTML = footerHTML;
    document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

// ===== Auto Classification =====
function autoClassify(description, type) {
    if (!description) return null;
    const desc = description.toLowerCase();
    const cats = APP.categories.filter(c => c.type === type);
    for (const cat of cats) {
        const keywords = cat.keywords || [];
        for (const kw of keywords) {
            if (kw && desc.includes(kw.toLowerCase())) {
                return cat;
            }
        }
    }
    return null;
}

// ===== Transaction Form =====
function initTransactionForm() {
    const form = document.getElementById('transactionForm');
    const dateInput = document.getElementById('txDate');
    dateInput.value = Utils.today();

    // Type toggle
    document.querySelectorAll('.type-btn[data-type]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.type-btn[data-type]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            refreshCategorySelect();
        });
    });

    // Auto-classify on description input
    const descInput = document.getElementById('txDescription');
    descInput.addEventListener('input', Utils.debounce(() => {
        const type = document.querySelector('.type-btn[data-type].active').getAttribute('data-type');
        const result = autoClassify(descInput.value, type);
        const hint = document.getElementById('autoClassifyHint');
        const catSelect = document.getElementById('txCategory');
        if (result) {
            hint.style.display = 'flex';
            document.getElementById('autoClassifyResult').textContent = result.name;
            catSelect.value = result.id;
        } else {
            hint.style.display = 'none';
        }
    }, 200));

    // Amount formatting
    const amountInput = document.getElementById('txAmount');
    amountInput.addEventListener('input', () => {
        const raw = amountInput.value.replace(/[^0-9]/g, '');
        amountInput.value = raw ? Number(raw).toLocaleString('ko-KR') : '';
    });

    // Reset
    document.getElementById('txReset').addEventListener('click', resetTransactionForm);

    // Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = document.querySelector('.type-btn[data-type].active').getAttribute('data-type');
        const catId = document.getElementById('txCategory').value;
        const cat = APP.categories.find(c => c.id === catId);
        
        const data = {
            date: dateInput.value,
            type,
            category: catId,
            category_name: cat ? cat.name : '',
            description: descInput.value.trim(),
            amount: Utils.parseAmount(amountInput.value),
            payment_method: document.getElementById('txPayment').value,
            memo: document.getElementById('txMemo').value.trim(),
            is_recurring: false,
            recurring_id: '',
            deleted: false
        };

        if (!data.amount) {
            showToast('금액을 입력해주세요.', 'warning');
            return;
        }

        const editId = document.getElementById('editId').value;
        try {
            if (editId) {
                await API.update('transactions', editId, data);
                showToast('내역이 수정되었습니다.', 'success');
            } else {
                await API.create('transactions', data);
                showToast('내역이 저장되었습니다.', 'success');
            }
            await loadAllData();
            resetTransactionForm();
        } catch(err) {
            showToast('저장 중 오류가 발생했습니다.', 'error');
        }
    });
}

function resetTransactionForm() {
    document.getElementById('editId').value = '';
    document.getElementById('txDate').value = Utils.today();
    document.getElementById('txDescription').value = '';
    document.getElementById('txAmount').value = '';
    document.getElementById('txMemo').value = '';
    document.getElementById('txPayment').value = 'card';
    document.getElementById('autoClassifyHint').style.display = 'none';
    document.getElementById('txSubmitBtn').innerHTML = '<i class="fas fa-save"></i> 저장';
    refreshCategorySelect();
}

function refreshCategorySelect() {
    const type = document.querySelector('.type-btn[data-type].active')?.getAttribute('data-type') || 'expense';
    const select = document.getElementById('txCategory');
    const cats = APP.categories.filter(c => c.type === type).sort((a,b) => a.sort_order - b.sort_order);
    select.innerHTML = '<option value="">선택하세요</option>' + 
        cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    // Also update search category
    const searchCat = document.getElementById('searchCategory');
    if (searchCat) {
        const searchType = document.getElementById('searchType').value;
        const fCats = searchType ? APP.categories.filter(c => c.type === searchType) : APP.categories;
        searchCat.innerHTML = '<option value="">전체</option>' + 
            fCats.sort((a,b) => a.sort_order - b.sort_order).map(c => `<option value="${c.id}">${c.name} (${Utils.typeLabel(c.type)})</option>`).join('');
    }
}

function editTransaction(id) {
    const tx = APP.transactions.find(t => t.id === id);
    if (!tx) return;
    switchTab('add');
    setTimeout(() => {
        document.getElementById('editId').value = tx.id;
        document.getElementById('txDate').value = tx.date;
        document.getElementById('txDescription').value = tx.description;
        document.getElementById('txAmount').value = Utils.formatNumber(tx.amount);
        document.getElementById('txMemo').value = tx.memo || '';
        document.getElementById('txPayment').value = tx.payment_method;
        // Set type
        document.querySelectorAll('.type-btn[data-type]').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-type') === tx.type);
        });
        refreshCategorySelect();
        setTimeout(() => {
            document.getElementById('txCategory').value = tx.category;
        }, 50);
        document.getElementById('txSubmitBtn').innerHTML = '<i class="fas fa-save"></i> 수정';
    }, 100);
}

async function deleteTransaction(id) {
    openModal('삭제 확인', '<p>이 내역을 삭제하시겠습니까?</p>',
        `<button class="btn btn-secondary" onclick="closeModal()">취소</button>
         <button class="btn btn-danger" id="confirmDeleteTx">삭제</button>`);
    document.getElementById('confirmDeleteTx').onclick = async () => {
        try {
            await API.patch('transactions', id, { deleted: true });
            await loadAllData();
            renderList();
            showToast('내역이 삭제되었습니다.', 'success');
        } catch(e) {
            showToast('삭제 중 오류가 발생했습니다.', 'error');
        }
        closeModal();
    };
}

// ===== Transaction List =====
function initList() {
    const now = new Date();
    document.getElementById('searchDateFrom').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    document.getElementById('searchDateTo').value = Utils.today();

    document.getElementById('searchBtn').addEventListener('click', () => { APP.listPage = 1; renderList(); });
    document.getElementById('searchReset').addEventListener('click', () => {
        document.getElementById('searchDateFrom').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
        document.getElementById('searchDateTo').value = Utils.today();
        document.getElementById('searchType').value = '';
        document.getElementById('searchCategory').value = '';
        document.getElementById('searchKeyword').value = '';
        document.getElementById('searchAmountMin').value = '';
        document.getElementById('searchAmountMax').value = '';
        document.getElementById('searchPayment').value = '';
        APP.listPage = 1;
        renderList();
    });

    document.getElementById('searchType').addEventListener('change', refreshCategorySelect);

    // Sortable headers
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.getAttribute('data-sort');
            if (APP.listSort.field === field) {
                APP.listSort.dir = APP.listSort.dir === 'asc' ? 'desc' : 'asc';
            } else {
                APP.listSort = { field, dir: 'desc' };
            }
            renderList();
        });
    });

    // Excel download
    document.getElementById('excelDownload').addEventListener('click', downloadExcel);
}

function getFilteredTransactions() {
    let data = [...APP.transactions];
    const from = document.getElementById('searchDateFrom').value;
    const to = document.getElementById('searchDateTo').value;
    const type = document.getElementById('searchType').value;
    const cat = document.getElementById('searchCategory').value;
    const keyword = document.getElementById('searchKeyword').value.trim().toLowerCase();
    const amtMin = Utils.parseAmount(document.getElementById('searchAmountMin').value);
    const amtMax = Utils.parseAmount(document.getElementById('searchAmountMax').value);
    const payment = document.getElementById('searchPayment').value;

    if (from) data = data.filter(t => t.date >= from);
    if (to) data = data.filter(t => t.date <= to);
    if (type) data = data.filter(t => t.type === type);
    if (cat) data = data.filter(t => t.category === cat);
    if (keyword) data = data.filter(t => 
        (t.description && t.description.toLowerCase().includes(keyword)) ||
        (t.category_name && t.category_name.toLowerCase().includes(keyword)) ||
        (t.memo && t.memo.toLowerCase().includes(keyword))
    );
    if (amtMin) data = data.filter(t => t.amount >= amtMin);
    if (amtMax) data = data.filter(t => t.amount <= amtMax);
    if (payment) data = data.filter(t => t.payment_method === payment);

    // Sort
    data.sort((a, b) => {
        const f = APP.listSort.field;
        const dir = APP.listSort.dir === 'asc' ? 1 : -1;
        if (f === 'amount') return (a.amount - b.amount) * dir;
        return (a.date > b.date ? 1 : -1) * dir;
    });

    return data;
}

function renderList() {
    const data = getFilteredTransactions();
    const total = data.length;
    const incomeSum = data.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
    const expenseSum = data.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);

    document.getElementById('listTotal').textContent = Utils.formatNumber(total);
    document.getElementById('listIncomeSum').textContent = Utils.formatCurrency(incomeSum);
    document.getElementById('listExpenseSum').textContent = Utils.formatCurrency(expenseSum);

    const start = (APP.listPage - 1) * APP.listPageSize;
    const pageData = data.slice(start, start + APP.listPageSize);
    const tbody = document.getElementById('txListBody');

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-inbox"></i><p>내역이 없습니다.</p></div></td></tr>`;
    } else {
        tbody.innerHTML = pageData.map(t => `
            <tr>
                <td>${t.date}</td>
                <td><span class="badge badge-${t.type}">${t.category_name || Utils.typeLabel(t.type)}</span></td>
                <td>${t.description}</td>
                <td class="amount-cell ${t.type === 'income' ? 'text-income' : 'text-expense'}">
                    ${t.type === 'income' ? '+' : '-'}${Utils.formatCurrency(t.amount)}
                </td>
                <td>${Utils.paymentLabel(t.payment_method)}</td>
                <td>${t.memo || '-'}</td>
                <td>
                    <div class="td-actions">
                        <button class="btn-icon edit" onclick="editTransaction('${t.id}')" title="수정"><i class="fas fa-pen"></i></button>
                        <button class="btn-icon delete" onclick="deleteTransaction('${t.id}')" title="삭제"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    renderPagination(total);
}

function renderPagination(total) {
    const totalPages = Math.ceil(total / APP.listPageSize) || 1;
    const container = document.getElementById('txPagination');
    let html = '';

    html += `<button ${APP.listPage <= 1 ? 'disabled' : ''} onclick="goToPage(${APP.listPage-1})"><i class="fas fa-chevron-left"></i></button>`;

    const startPage = Math.max(1, APP.listPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="${i === APP.listPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }

    html += `<button ${APP.listPage >= totalPages ? 'disabled' : ''} onclick="goToPage(${APP.listPage+1})"><i class="fas fa-chevron-right"></i></button>`;
    container.innerHTML = html;
}

function goToPage(p) {
    APP.listPage = p;
    renderList();
}

function downloadExcel() {
    const data = getFilteredTransactions();
    const rows = data.map(t => ({
        '날짜': t.date,
        '구분': Utils.typeLabel(t.type),
        '분류': t.category_name,
        '사용처': t.description,
        '금액': t.amount,
        '결제수단': Utils.paymentLabel(t.payment_method),
        '메모': t.memo || ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '가계부');
    XLSX.writeFile(wb, `가계부_${Utils.today()}.xlsx`);
    showToast('엑셀 파일이 다운로드되었습니다.', 'success');
}

// ===== Dashboard =====
function renderDashboard() {
    const ym = Utils.currentYM();
    const range = Utils.getMonthRange(ym);
    const monthTx = APP.transactions.filter(t => t.date >= range.start && t.date <= range.end);
    
    const income = monthTx.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
    const expense = monthTx.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
    const balance = income - expense;

    document.getElementById('dashIncome').textContent = Utils.formatCurrency(income);
    document.getElementById('dashExpense').textContent = Utils.formatCurrency(expense);
    document.getElementById('dashBalance').textContent = Utils.formatCurrency(balance);
    document.getElementById('dashBalance').className = `stat-value ${balance >= 0 ? 'text-income' : 'text-expense'}`;

    // Budget usage
    const totalBudget = APP.budgets.find(b => b.year_month === ym && b.category_id === 'total');
    if (totalBudget) {
        const pct = Math.round((expense / totalBudget.amount) * 100);
        document.getElementById('dashBudget').textContent = pct + '%';
        document.getElementById('dashBudget').className = `stat-value ${pct > 100 ? 'text-expense' : pct > 80 ? 'text-expense' : ''}`;
    } else {
        document.getElementById('dashBudget').textContent = '미설정';
    }

    // Donut chart
    renderDashDonut(monthTx);
    // Trend chart
    renderDashTrend();
    // Recent list
    renderDashRecent();
}

function renderDashDonut(monthTx) {
    const expTx = monthTx.filter(t => t.type === 'expense');
    const catMap = {};
    expTx.forEach(t => {
        catMap[t.category_name || '기타'] = (catMap[t.category_name || '기타'] || 0) + t.amount;
    });

    const labels = Object.keys(catMap);
    const values = Object.values(catMap);
    const colors = ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#06b6d4'];

    if (APP.charts.dashDonut) APP.charts.dashDonut.destroy();
    
    const ctx = document.getElementById('dashDonutChart').getContext('2d');
    APP.charts.dashDonut = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 0, hoverOffset: 8 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { font: { family: 'Noto Sans KR', size: 12 }, padding: 12, usePointStyle: true } },
                tooltip: {
                    callbacks: { label: (ctx) => `${ctx.label}: ${Utils.formatCurrency(ctx.raw)} (${Math.round(ctx.raw/values.reduce((a,b)=>a+b,1)*100)}%)` }
                }
            },
            cutout: '65%'
        }
    });
}

function renderDashTrend() {
    const now = new Date();
    const months = [];
    const incomes = [];
    const expenses = [];
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const range = Utils.getMonthRange(ym);
        const mTx = APP.transactions.filter(t => t.date >= range.start && t.date <= range.end);
        months.push(`${d.getMonth()+1}월`);
        incomes.push(mTx.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0));
        expenses.push(mTx.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0));
    }

    if (APP.charts.dashTrend) APP.charts.dashTrend.destroy();
    const ctx = document.getElementById('dashTrendChart').getContext('2d');
    APP.charts.dashTrend = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                { label: '수입', data: incomes, backgroundColor: '#10b98180', borderColor: '#10b981', borderWidth: 2, borderRadius: 6 },
                { label: '지출', data: expenses, backgroundColor: '#ef444480', borderColor: '#ef4444', borderWidth: 2, borderRadius: 6 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { font: { family: 'Noto Sans KR', size: 12 }, usePointStyle: true } },
                tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${Utils.formatCurrency(ctx.raw)}` } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: v => Utils.formatNumber(v) }, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderDashRecent() {
    const recent = [...APP.transactions].sort((a,b) => b.date > a.date ? 1 : -1).slice(0, 8);
    const tbody = document.getElementById('dashRecentList');
    if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><p>최근 거래 내역이 없습니다.</p></div></td></tr>';
        return;
    }
    tbody.innerHTML = recent.map(t => `
        <tr>
            <td>${t.date}</td>
            <td><span class="badge badge-${t.type}">${t.category_name || Utils.typeLabel(t.type)}</span></td>
            <td>${t.description}</td>
            <td class="amount-cell ${t.type === 'income' ? 'text-income' : 'text-expense'}">
                ${t.type === 'income' ? '+' : '-'}${Utils.formatCurrency(t.amount)}
            </td>
            <td>${Utils.paymentLabel(t.payment_method)}</td>
        </tr>
    `).join('');
}

// ===== Statistics =====
function initStats() {
    const yearSel = document.getElementById('statsYear');
    const monthSel = document.getElementById('statsMonth');
    const now = new Date();
    
    for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) {
        yearSel.innerHTML += `<option value="${y}">${y}년</option>`;
    }
    for (let m = 1; m <= 12; m++) {
        monthSel.innerHTML += `<option value="${m}">${m}월</option>`;
    }
    monthSel.value = now.getMonth() + 1;

    yearSel.addEventListener('change', renderStats);
    monthSel.addEventListener('change', renderStats);

    document.querySelectorAll('.type-btn[data-stats-type]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.type-btn[data-stats-type]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            APP.statsType = btn.getAttribute('data-stats-type');
            renderStats();
        });
    });
}

function renderStats() {
    const year = document.getElementById('statsYear').value;
    const month = document.getElementById('statsMonth').value;
    const type = APP.statsType;

    let filtered;
    let titleSuffix;
    if (month) {
        const ym = `${year}-${String(month).padStart(2,'0')}`;
        const range = Utils.getMonthRange(ym);
        filtered = APP.transactions.filter(t => t.date >= range.start && t.date <= range.end && t.type === type);
        titleSuffix = `${year}년 ${month}월 ${Utils.typeLabel(type)}`;
    } else {
        const range = Utils.getYearRange(year);
        filtered = APP.transactions.filter(t => t.date >= range.start && t.date <= range.end && t.type === type);
        titleSuffix = `${year}년 ${Utils.typeLabel(type)}`;
    }

    document.getElementById('statsPieTitle').textContent = `${titleSuffix} 분류별 비중`;
    document.getElementById('statsBarTitle').textContent = `${titleSuffix} 분류별 금액`;

    renderStatsPie(filtered);
    renderStatsBar(filtered);
    renderStatsTrend(year, type);
    renderStatsFlow(year);
    renderComparison(year, month, type);
}

function renderStatsPie(data) {
    const catMap = {};
    data.forEach(t => { catMap[t.category_name || '기타'] = (catMap[t.category_name || '기타'] || 0) + t.amount; });
    const labels = Object.keys(catMap);
    const values = Object.values(catMap);
    const colors = ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#06b6d4'];

    if (APP.charts.statsPie) APP.charts.statsPie.destroy();
    APP.charts.statsPie = new Chart(document.getElementById('statsPieChart').getContext('2d'), {
        type: 'doughnut',
        data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { font: { family: 'Noto Sans KR', size: 12 }, padding: 12, usePointStyle: true } },
                tooltip: { callbacks: { label: ctx => `${ctx.label}: ${Utils.formatCurrency(ctx.raw)} (${Math.round(ctx.raw/Math.max(values.reduce((a,b)=>a+b,0),1)*100)}%)` } }
            },
            cutout: '60%'
        }
    });
}

function renderStatsBar(data) {
    const catMap = {};
    data.forEach(t => { catMap[t.category_name || '기타'] = (catMap[t.category_name || '기타'] || 0) + t.amount; });
    const sorted = Object.entries(catMap).sort((a,b) => b[1]-a[1]);
    const labels = sorted.map(e=>e[0]);
    const values = sorted.map(e=>e[1]);
    const colors = ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#06b6d4'];

    if (APP.charts.statsBar) APP.charts.statsBar.destroy();
    APP.charts.statsBar = new Chart(document.getElementById('statsBarChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{ data: values, backgroundColor: colors, borderRadius: 6, borderWidth: 0 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => Utils.formatCurrency(ctx.raw) } }
            },
            scales: {
                x: { beginAtZero: true, ticks: { callback: v => Utils.formatNumber(v) }, grid: { color: 'rgba(0,0,0,0.05)' } },
                y: { grid: { display: false } }
            }
        }
    });
}

function renderStatsTrend(year, type) {
    const months = [];
    const values = [];
    for (let m = 1; m <= 12; m++) {
        const ym = `${year}-${String(m).padStart(2,'0')}`;
        const range = Utils.getMonthRange(ym);
        const sum = APP.transactions.filter(t => t.date >= range.start && t.date <= range.end && t.type === type)
            .reduce((s,t) => s + t.amount, 0);
        months.push(`${m}월`);
        values.push(sum);
    }

    const color = type === 'expense' ? '#ef4444' : '#10b981';
    if (APP.charts.statsTrend) APP.charts.statsTrend.destroy();
    APP.charts.statsTrend = new Chart(document.getElementById('statsTrendChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: Utils.typeLabel(type), data: values,
                borderColor: color, backgroundColor: color + '20',
                fill: true, tension: 0.4, pointRadius: 5, pointHoverRadius: 7,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => Utils.formatCurrency(ctx.raw) } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: v => Utils.formatNumber(v) }, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderStatsFlow(year) {
    const months = [];
    const incomes = [];
    const expenses = [];
    const balances = [];
    let cumBalance = 0;

    for (let m = 1; m <= 12; m++) {
        const ym = `${year}-${String(m).padStart(2,'0')}`;
        const range = Utils.getMonthRange(ym);
        const mTx = APP.transactions.filter(t => t.date >= range.start && t.date <= range.end);
        const inc = mTx.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
        const exp = mTx.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
        cumBalance += (inc - exp);
        months.push(`${m}월`);
        incomes.push(inc);
        expenses.push(exp);
        balances.push(cumBalance);
    }

    if (APP.charts.statsFlow) APP.charts.statsFlow.destroy();
    APP.charts.statsFlow = new Chart(document.getElementById('statsFlowChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                { type: 'bar', label: '수입', data: incomes, backgroundColor: '#10b98160', borderColor: '#10b981', borderWidth: 2, borderRadius: 4, order: 2 },
                { type: 'bar', label: '지출', data: expenses, backgroundColor: '#ef444460', borderColor: '#ef4444', borderWidth: 2, borderRadius: 4, order: 2 },
                { type: 'line', label: '누적잔액', data: balances, borderColor: '#3b82f6', backgroundColor: '#3b82f620', fill: true, tension: 0.4, borderWidth: 3, pointRadius: 4, order: 1 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { labels: { font: { family: 'Noto Sans KR', size: 12 }, usePointStyle: true } },
                tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${Utils.formatCurrency(ctx.raw)}` } }
            },
            scales: {
                y: { ticks: { callback: v => Utils.formatNumber(v) }, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderComparison(year, month, type) {
    const grid = document.getElementById('comparisonGrid');
    if (!month) {
        grid.innerHTML = '<p class="hint">월을 선택하면 전월/전년 동기 비교를 볼 수 있습니다.</p>';
        return;
    }

    const ym = `${year}-${String(month).padStart(2,'0')}`;
    const range = Utils.getMonthRange(ym);
    const currentTx = APP.transactions.filter(t => t.date >= range.start && t.date <= range.end && t.type === type);
    const currentTotal = currentTx.reduce((s,t) => s + t.amount, 0);

    // Previous month
    const prevDate = new Date(year, month - 2, 1);
    const prevYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`;
    const prevRange = Utils.getMonthRange(prevYM);
    const prevTx = APP.transactions.filter(t => t.date >= prevRange.start && t.date <= prevRange.end && t.type === type);
    const prevTotal = prevTx.reduce((s,t) => s + t.amount, 0);
    const prevDiff = currentTotal - prevTotal;
    const prevPct = prevTotal > 0 ? Math.round((prevDiff / prevTotal) * 100) : 0;

    // Same month last year
    const lyYM = `${year-1}-${String(month).padStart(2,'0')}`;
    const lyRange = Utils.getMonthRange(lyYM);
    const lyTx = APP.transactions.filter(t => t.date >= lyRange.start && t.date <= lyRange.end && t.type === type);
    const lyTotal = lyTx.reduce((s,t) => s + t.amount, 0);
    const lyDiff = currentTotal - lyTotal;
    const lyPct = lyTotal > 0 ? Math.round((lyDiff / lyTotal) * 100) : 0;

    // Category comparison
    const catMap = {};
    currentTx.forEach(t => { catMap[t.category_name || '기타'] = (catMap[t.category_name || '기타'] || 0) + t.amount; });
    const prevCatMap = {};
    prevTx.forEach(t => { prevCatMap[t.category_name || '기타'] = (prevCatMap[t.category_name || '기타'] || 0) + t.amount; });

    const catRows = Object.keys(catMap).map(name => {
        const cur = catMap[name] || 0;
        const prev = prevCatMap[name] || 0;
        const diff = cur - prev;
        return `<div class="comparison-row">
            <span>${name}</span>
            <span>${Utils.formatCurrency(cur)}</span>
            <span class="${diff > 0 ? 'change-negative' : diff < 0 ? 'change-positive' : ''}">
                ${diff > 0 ? '▲' : diff < 0 ? '▼' : '-'} ${Utils.formatCurrency(Math.abs(diff))}
            </span>
        </div>`;
    }).join('');

    grid.innerHTML = `
        <div class="comparison-card">
            <h4>전월 대비 (${prevDate.getMonth()+1}월 → ${month}월)</h4>
            <div class="comparison-row">
                <span>전월</span><span>${Utils.formatCurrency(prevTotal)}</span><span></span>
            </div>
            <div class="comparison-row">
                <span>이번 달</span><span>${Utils.formatCurrency(currentTotal)}</span><span></span>
            </div>
            <div class="comparison-row">
                <span>차이</span>
                <span class="${prevDiff > 0 ? (type==='expense'?'change-negative':'change-positive') : (type==='expense'?'change-positive':'change-negative')}">
                    ${prevDiff > 0 ? '▲' : '▼'} ${Utils.formatCurrency(Math.abs(prevDiff))} (${prevPct > 0 ? '+' : ''}${prevPct}%)
                </span>
                <span></span>
            </div>
        </div>
        <div class="comparison-card">
            <h4>전년 동기 대비 (${year-1}년 ${month}월)</h4>
            <div class="comparison-row">
                <span>전년 동월</span><span>${Utils.formatCurrency(lyTotal)}</span><span></span>
            </div>
            <div class="comparison-row">
                <span>이번 달</span><span>${Utils.formatCurrency(currentTotal)}</span><span></span>
            </div>
            <div class="comparison-row">
                <span>차이</span>
                <span class="${lyDiff > 0 ? (type==='expense'?'change-negative':'change-positive') : (type==='expense'?'change-positive':'change-negative')}">
                    ${lyDiff > 0 ? '▲' : '▼'} ${Utils.formatCurrency(Math.abs(lyDiff))} (${lyPct > 0 ? '+' : ''}${lyPct}%)
                </span>
                <span></span>
            </div>
        </div>
        <div class="comparison-card" style="grid-column: 1 / -1;">
            <h4>전월 대비 분류별 변화</h4>
            ${catRows || '<div class="empty-state"><p>데이터가 없습니다.</p></div>'}
        </div>
    `;
}

// ===== Budget =====
function initBudget() {
    const yearSel = document.getElementById('budgetYear');
    const monthSel = document.getElementById('budgetMonth');
    const now = new Date();
    
    for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) {
        yearSel.innerHTML += `<option value="${y}">${y}년</option>`;
    }
    for (let m = 1; m <= 12; m++) {
        monthSel.innerHTML += `<option value="${m}">${m}월</option>`;
    }
    monthSel.value = now.getMonth() + 1;

    yearSel.addEventListener('change', renderBudget);
    monthSel.addEventListener('change', renderBudget);

    document.getElementById('saveTotalBudget').addEventListener('click', saveTotalBudget);
    document.getElementById('addCategoryBudget').addEventListener('click', addCategoryBudgetModal);

    // Amount formatting
    document.getElementById('budgetTotalAmount').addEventListener('input', function() {
        const raw = this.value.replace(/[^0-9]/g, '');
        this.value = raw ? Number(raw).toLocaleString('ko-KR') : '';
    });
}

function getBudgetYM() {
    return `${document.getElementById('budgetYear').value}-${String(document.getElementById('budgetMonth').value).padStart(2,'0')}`;
}

async function saveTotalBudget() {
    const ym = getBudgetYM();
    const amount = Utils.parseAmount(document.getElementById('budgetTotalAmount').value);
    if (!amount) { showToast('예산 금액을 입력하세요.', 'warning'); return; }
    
    const existing = APP.budgets.find(b => b.year_month === ym && b.category_id === 'total');
    try {
        if (existing) {
            await API.update('budgets', existing.id, { ...existing, amount });
        } else {
            await API.create('budgets', { year_month: ym, category_id: 'total', category_name: '총 예산', amount, deleted: false });
        }
        await loadAllData();
        renderBudget();
        showToast('총 예산이 저장되었습니다.', 'success');
    } catch(e) {
        showToast('저장 중 오류가 발생했습니다.', 'error');
    }
}

function renderBudget() {
    const ym = getBudgetYM();
    const range = Utils.getMonthRange(ym);
    const monthExpense = APP.transactions.filter(t => t.date >= range.start && t.date <= range.end && t.type === 'expense')
        .reduce((s,t) => s + t.amount, 0);

    // Total budget
    const totalBudget = APP.budgets.find(b => b.year_month === ym && b.category_id === 'total');
    document.getElementById('budgetTotalAmount').value = totalBudget ? Utils.formatNumber(totalBudget.amount) : '';
    
    const progressArea = document.getElementById('budgetTotalProgress');
    if (totalBudget) {
        const pct = Math.min(Math.round((monthExpense / totalBudget.amount) * 100), 100);
        const cls = pct > 90 ? 'danger' : pct > 70 ? 'warn' : 'safe';
        const actualPct = Math.round((monthExpense / totalBudget.amount) * 100);
        progressArea.innerHTML = `
            ${actualPct > 100 ? '<div class="budget-alert"><i class="fas fa-exclamation-triangle"></i> 예산을 초과했습니다!</div>' : ''}
            <div class="budget-progress-bar">
                <div class="budget-progress-fill ${cls}" style="width:${Math.min(pct,100)}%">${actualPct}%</div>
            </div>
            <div class="budget-progress-info">
                <span>사용: ${Utils.formatCurrency(monthExpense)}</span>
                <span>잔여: ${Utils.formatCurrency(Math.max(totalBudget.amount - monthExpense, 0))}</span>
                <span>예산: ${Utils.formatCurrency(totalBudget.amount)}</span>
            </div>
        `;
    } else {
        progressArea.innerHTML = '<p class="hint">총 예산을 설정하면 사용률을 확인할 수 있습니다.</p>';
    }

    // Category budgets
    const catBudgets = APP.budgets.filter(b => b.year_month === ym && b.category_id !== 'total');
    const container = document.getElementById('categoryBudgetList');
    
    if (catBudgets.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-folder-open"></i><p>설정된 중분류 예산이 없습니다.</p></div>';
        return;
    }

    container.innerHTML = catBudgets.map(b => {
        const catExpense = APP.transactions.filter(t => 
            t.date >= range.start && t.date <= range.end && t.type === 'expense' && t.category === b.category_id
        ).reduce((s,t) => s + t.amount, 0);
        const pct = b.amount > 0 ? Math.round((catExpense / b.amount) * 100) : 0;
        const cls = pct > 90 ? 'danger' : pct > 70 ? 'warn' : 'safe';

        return `
            <div class="category-budget-item">
                <span class="cb-name">${b.category_name}</span>
                <div class="cb-progress">
                    ${pct > 100 ? '<div class="budget-alert"><i class="fas fa-exclamation-triangle"></i> 초과!</div>' : ''}
                    <div class="budget-progress-bar">
                        <div class="budget-progress-fill ${cls}" style="width:${Math.min(pct,100)}%">${pct}%</div>
                    </div>
                    <div class="budget-progress-info">
                        <span>${Utils.formatCurrency(catExpense)} / ${Utils.formatCurrency(b.amount)}</span>
                    </div>
                </div>
                <div class="cb-actions">
                    <button class="btn-icon edit" onclick="editCategoryBudget('${b.id}')" title="수정"><i class="fas fa-pen"></i></button>
                    <button class="btn-icon delete" onclick="deleteCategoryBudget('${b.id}')" title="삭제"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

function addCategoryBudgetModal() {
    const expCats = APP.categories.filter(c => c.type === 'expense');
    const ym = getBudgetYM();
    const existing = APP.budgets.filter(b => b.year_month === ym && b.category_id !== 'total').map(b => b.category_id);
    const available = expCats.filter(c => !existing.includes(c.id));

    if (available.length === 0) {
        showToast('모든 분류에 예산이 설정되어 있습니다.', 'info');
        return;
    }

    openModal('중분류 예산 추가',
        `<div class="form-group">
            <label>분류</label>
            <select id="modalBudgetCat">${available.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select>
        </div>
        <div class="form-group">
            <label>예산 금액</label>
            <div class="input-with-unit">
                <input type="text" id="modalBudgetAmt" placeholder="0" inputmode="numeric">
                <span class="unit">원</span>
            </div>
        </div>`,
        `<button class="btn btn-secondary" onclick="closeModal()">취소</button>
         <button class="btn btn-primary" id="saveCatBudget"><i class="fas fa-save"></i> 저장</button>`
    );

    document.getElementById('modalBudgetAmt').addEventListener('input', function() {
        const raw = this.value.replace(/[^0-9]/g, '');
        this.value = raw ? Number(raw).toLocaleString('ko-KR') : '';
    });

    document.getElementById('saveCatBudget').onclick = async () => {
        const catId = document.getElementById('modalBudgetCat').value;
        const cat = APP.categories.find(c => c.id === catId);
        const amount = Utils.parseAmount(document.getElementById('modalBudgetAmt').value);
        if (!amount) { showToast('금액을 입력하세요.', 'warning'); return; }
        
        try {
            await API.create('budgets', { year_month: ym, category_id: catId, category_name: cat.name, amount, deleted: false });
            await loadAllData();
            renderBudget();
            closeModal();
            showToast('중분류 예산이 추가되었습니다.', 'success');
        } catch(e) {
            showToast('저장 중 오류가 발생했습니다.', 'error');
        }
    };
}

function editCategoryBudget(id) {
    const budget = APP.budgets.find(b => b.id === id);
    if (!budget) return;

    openModal('중분류 예산 수정',
        `<div class="form-group">
            <label>분류</label>
            <input type="text" value="${budget.category_name}" disabled>
        </div>
        <div class="form-group">
            <label>예산 금액</label>
            <div class="input-with-unit">
                <input type="text" id="modalBudgetAmt" value="${Utils.formatNumber(budget.amount)}" inputmode="numeric">
                <span class="unit">원</span>
            </div>
        </div>`,
        `<button class="btn btn-secondary" onclick="closeModal()">취소</button>
         <button class="btn btn-primary" id="saveCatBudget"><i class="fas fa-save"></i> 저장</button>`
    );

    document.getElementById('modalBudgetAmt').addEventListener('input', function() {
        const raw = this.value.replace(/[^0-9]/g, '');
        this.value = raw ? Number(raw).toLocaleString('ko-KR') : '';
    });

    document.getElementById('saveCatBudget').onclick = async () => {
        const amount = Utils.parseAmount(document.getElementById('modalBudgetAmt').value);
        if (!amount) { showToast('금액을 입력하세요.', 'warning'); return; }
        try {
            await API.update('budgets', id, { ...budget, amount });
            await loadAllData();
            renderBudget();
            closeModal();
            showToast('예산이 수정되었습니다.', 'success');
        } catch(e) {
            showToast('수정 중 오류가 발생했습니다.', 'error');
        }
    };
}

async function deleteCategoryBudget(id) {
    try {
        await API.patch('budgets', id, { deleted: true });
        await loadAllData();
        renderBudget();
        showToast('예산이 삭제되었습니다.', 'success');
    } catch(e) {
        showToast('삭제 중 오류가 발생했습니다.', 'error');
    }
}

// ===== Recurring =====
function initRecurring() {
    document.getElementById('addRecurring').addEventListener('click', showRecurringModal);
}

function showRecurringModal(editData = null) {
    const isEdit = editData && editData.id;
    const expCats = APP.categories.filter(c => c.type === 'expense').map(c => `<option value="${c.id}" ${isEdit && editData.category === c.id ? 'selected':''}>${c.name}</option>`).join('');
    const incCats = APP.categories.filter(c => c.type === 'income').map(c => `<option value="${c.id}" ${isEdit && editData.category === c.id ? 'selected':''}>${c.name}</option>`).join('');

    const t = isEdit ? editData.type : 'expense';
    const cats = t === 'expense' ? expCats : incCats;

    openModal(isEdit ? '반복 거래 수정' : '반복 거래 등록',
        `<div class="form-group">
            <label>구분</label>
            <select id="modalRecType">
                <option value="expense" ${t==='expense'?'selected':''}>지출</option>
                <option value="income" ${t==='income'?'selected':''}>수입</option>
            </select>
        </div>
        <div class="form-group">
            <label>분류</label>
            <select id="modalRecCat">${cats}</select>
        </div>
        <div class="form-group">
            <label>사용처</label>
            <input type="text" id="modalRecDesc" value="${isEdit ? editData.description : ''}" placeholder="사용처">
        </div>
        <div class="form-group">
            <label>금액</label>
            <div class="input-with-unit">
                <input type="text" id="modalRecAmt" value="${isEdit ? Utils.formatNumber(editData.amount) : ''}" inputmode="numeric">
                <span class="unit">원</span>
            </div>
        </div>
        <div class="form-group">
            <label>결제수단</label>
            <select id="modalRecPay">
                <option value="card" ${isEdit && editData.payment_method==='card'?'selected':''}>카드</option>
                <option value="cash" ${isEdit && editData.payment_method==='cash'?'selected':''}>현금</option>
                <option value="transfer" ${isEdit && editData.payment_method==='transfer'?'selected':''}>이체</option>
                <option value="etc" ${isEdit && editData.payment_method==='etc'?'selected':''}>기타</option>
            </select>
        </div>
        <div class="form-group">
            <label>매월 반복일</label>
            <input type="number" id="modalRecDay" min="1" max="31" value="${isEdit ? editData.day_of_month : 1}">
        </div>
        <div class="form-group">
            <label>시작일</label>
            <input type="date" id="modalRecStart" value="${isEdit ? editData.start_date : Utils.today()}">
        </div>
        <div class="form-group">
            <label>종료일 (비워두면 무기한)</label>
            <input type="date" id="modalRecEnd" value="${isEdit ? editData.end_date || '' : ''}">
        </div>
        <div class="form-group">
            <label>메모</label>
            <textarea id="modalRecMemo" rows="2">${isEdit ? editData.memo || '' : ''}</textarea>
        </div>`,
        `<button class="btn btn-secondary" onclick="closeModal()">취소</button>
         <button class="btn btn-primary" id="saveRecurring"><i class="fas fa-save"></i> 저장</button>`
    );

    // Type change -> update category options
    document.getElementById('modalRecType').addEventListener('change', function() {
        const catSel = document.getElementById('modalRecCat');
        const fCats = APP.categories.filter(c => c.type === this.value);
        catSel.innerHTML = fCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    });

    document.getElementById('modalRecAmt').addEventListener('input', function() {
        const raw = this.value.replace(/[^0-9]/g, '');
        this.value = raw ? Number(raw).toLocaleString('ko-KR') : '';
    });

    document.getElementById('saveRecurring').onclick = async () => {
        const catId = document.getElementById('modalRecCat').value;
        const cat = APP.categories.find(c => c.id === catId);
        const data = {
            type: document.getElementById('modalRecType').value,
            category: catId,
            category_name: cat ? cat.name : '',
            description: document.getElementById('modalRecDesc').value.trim(),
            amount: Utils.parseAmount(document.getElementById('modalRecAmt').value),
            payment_method: document.getElementById('modalRecPay').value,
            memo: document.getElementById('modalRecMemo').value.trim(),
            day_of_month: parseInt(document.getElementById('modalRecDay').value) || 1,
            start_date: document.getElementById('modalRecStart').value,
            end_date: document.getElementById('modalRecEnd').value || '',
            is_active: true,
            last_generated: '',
            deleted: false
        };

        if (!data.amount || !data.description) {
            showToast('필수 항목을 입력해주세요.', 'warning');
            return;
        }

        try {
            if (isEdit) {
                await API.update('recurring', editData.id, data);
            } else {
                await API.create('recurring', data);
            }
            await loadAllData();
            renderRecurring();
            closeModal();
            showToast(isEdit ? '반복 거래가 수정되었습니다.' : '반복 거래가 등록되었습니다.', 'success');
        } catch(e) {
            showToast('저장 중 오류가 발생했습니다.', 'error');
        }
    };
}

function renderRecurring() {
    const tbody = document.getElementById('recurringList');
    if (APP.recurring.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><i class="fas fa-sync-alt"></i><p>등록된 반복 거래가 없습니다.</p></div></td></tr>';
        return;
    }
    tbody.innerHTML = APP.recurring.map(r => `
        <tr>
            <td><span class="badge badge-${r.type}">${Utils.typeLabel(r.type)}</span></td>
            <td>${r.category_name}</td>
            <td>${r.description}</td>
            <td class="amount-cell">${Utils.formatCurrency(r.amount)}</td>
            <td>${Utils.paymentLabel(r.payment_method)}</td>
            <td>${r.day_of_month}일</td>
            <td><span class="badge ${r.is_active ? 'badge-active' : 'badge-inactive'}">${r.is_active ? '활성' : '비활성'}</span></td>
            <td>
                <div class="td-actions">
                    <button class="btn-icon" onclick="generateRecurring('${r.id}')" title="내역 생성"><i class="fas fa-play"></i></button>
                    <button class="btn-icon edit" onclick="editRecurringItem('${r.id}')" title="수정"><i class="fas fa-pen"></i></button>
                    <button class="btn-icon delete" onclick="deleteRecurring('${r.id}')" title="삭제"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function editRecurringItem(id) {
    const r = APP.recurring.find(x => x.id === id);
    if (r) showRecurringModal(r);
}

async function deleteRecurring(id) {
    try {
        await API.patch('recurring', id, { deleted: true });
        await loadAllData();
        renderRecurring();
        showToast('반복 거래가 삭제되었습니다.', 'success');
    } catch(e) {
        showToast('삭제 중 오류가 발생했습니다.', 'error');
    }
}

async function generateRecurring(id) {
    const r = APP.recurring.find(x => x.id === id);
    if (!r) return;

    const ym = Utils.currentYM();
    const [y, m] = ym.split('-').map(Number);
    const day = Math.min(r.day_of_month, new Date(y, m, 0).getDate());
    const date = `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

    // Check if already generated
    const exists = APP.transactions.find(t => t.recurring_id === id && t.date.startsWith(ym));
    if (exists) {
        showToast('이번 달 내역이 이미 생성되어 있습니다.', 'warning');
        return;
    }

    try {
        await API.create('transactions', {
            date,
            type: r.type,
            category: r.category,
            category_name: r.category_name,
            description: r.description,
            amount: r.amount,
            payment_method: r.payment_method,
            memo: r.memo ? `[반복] ${r.memo}` : '[반복]',
            is_recurring: true,
            recurring_id: id,
            deleted: false
        });
        await API.patch('recurring', id, { last_generated: ym });
        await loadAllData();
        renderRecurring();
        showToast(`${date} 내역이 생성되었습니다.`, 'success');
    } catch(e) {
        showToast('생성 중 오류가 발생했습니다.', 'error');
    }
}

// ===== Admin (Category Management) =====
function initAdmin() {
    document.querySelectorAll('.type-btn[data-admin-type]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.type-btn[data-admin-type]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            APP.adminType = btn.getAttribute('data-admin-type');
            renderAdmin();
        });
    });

    document.getElementById('addCategory').addEventListener('click', () => showCategoryModal());
}

function renderAdmin() {
    const cats = APP.categories.filter(c => c.type === APP.adminType).sort((a,b) => a.sort_order - b.sort_order);
    const container = document.getElementById('categoryAdminList');

    if (cats.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-folder-open"></i><p>등록된 분류가 없습니다.</p></div>';
        return;
    }

    container.innerHTML = cats.map(c => `
        <div class="category-admin-item">
            <div class="ca-info">
                <div class="ca-name">
                    ${c.name}
                    ${c.is_default ? '<span class="ca-default-badge">기본</span>' : ''}
                </div>
                <div class="ca-keywords">
                    ${(c.keywords || []).map(k => `<span class="keyword-tag">${k}</span>`).join('') || '<span class="hint">키워드 없음</span>'}
                </div>
            </div>
            <div class="ca-actions">
                <button class="btn-icon edit" onclick="showCategoryModal('${c.id}')" title="수정"><i class="fas fa-pen"></i></button>
                <button class="btn-icon delete" onclick="deleteCategory('${c.id}')" title="삭제"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

function showCategoryModal(editId = null) {
    const cat = editId ? APP.categories.find(c => c.id === editId) : null;
    const isEdit = !!cat;

    openModal(isEdit ? '분류 수정' : '분류 추가',
        `<div class="form-group">
            <label>구분</label>
            <select id="modalCatType" ${isEdit ? 'disabled' : ''}>
                <option value="expense" ${(!isEdit && APP.adminType === 'expense') || (isEdit && cat.type === 'expense') ? 'selected':''}>지출</option>
                <option value="income" ${(!isEdit && APP.adminType === 'income') || (isEdit && cat.type === 'income') ? 'selected':''}>수입</option>
            </select>
        </div>
        <div class="form-group">
            <label>분류명</label>
            <input type="text" id="modalCatName" value="${isEdit ? cat.name : ''}" placeholder="예: 식비">
        </div>
        <div class="form-group">
            <label>키워드 (쉼표로 구분)</label>
            <textarea id="modalCatKeywords" rows="3" placeholder="스타벅스, 카페, 커피">${isEdit ? (cat.keywords || []).join(', ') : ''}</textarea>
            <small class="hint">사용처 입력 시 자동분류에 사용됩니다.</small>
        </div>
        <div class="form-group">
            <label>정렬 순서</label>
            <input type="number" id="modalCatOrder" value="${isEdit ? cat.sort_order : 10}" min="1">
        </div>`,
        `<button class="btn btn-secondary" onclick="closeModal()">취소</button>
         <button class="btn btn-primary" id="saveCat"><i class="fas fa-save"></i> 저장</button>`
    );

    document.getElementById('saveCat').onclick = async () => {
        const name = document.getElementById('modalCatName').value.trim();
        if (!name) { showToast('분류명을 입력하세요.', 'warning'); return; }
        
        const kwText = document.getElementById('modalCatKeywords').value;
        const keywords = kwText.split(',').map(k => k.trim()).filter(k => k);
        
        const data = {
            type: document.getElementById('modalCatType').value,
            name,
            keywords,
            sort_order: parseInt(document.getElementById('modalCatOrder').value) || 10,
            is_default: isEdit ? cat.is_default : false,
            deleted: false
        };

        try {
            if (isEdit) {
                await API.update('categories', editId, data);
                // Update category_name in transactions
                if (cat.name !== name) {
                    const relatedTx = APP.transactions.filter(t => t.category === editId);
                    for (const tx of relatedTx) {
                        await API.patch('transactions', tx.id, { category_name: name });
                    }
                }
            } else {
                await API.create('categories', data);
            }
            await loadAllData();
            renderAdmin();
            closeModal();
            showToast(isEdit ? '분류가 수정되었습니다.' : '분류가 추가되었습니다.', 'success');
        } catch(e) {
            showToast('저장 중 오류가 발생했습니다.', 'error');
        }
    };
}

async function deleteCategory(id) {
    const cat = APP.categories.find(c => c.id === id);
    const relatedCount = APP.transactions.filter(t => t.category === id).length;

    openModal('분류 삭제',
        `<p>"${cat.name}" 분류를 삭제하시겠습니까?</p>
         ${relatedCount > 0 ? `<p class="hint" style="margin-top:10px;color:var(--warning-color);"><i class="fas fa-exclamation-triangle"></i> 이 분류를 사용하는 내역이 ${relatedCount}건 있습니다. 기존 내역의 분류명은 유지됩니다.</p>` : ''}`,
        `<button class="btn btn-secondary" onclick="closeModal()">취소</button>
         <button class="btn btn-danger" id="confirmDeleteCat">삭제</button>`
    );

    document.getElementById('confirmDeleteCat').onclick = async () => {
        try {
            await API.patch('categories', id, { deleted: true });
            await loadAllData();
            renderAdmin();
            closeModal();
            showToast('분류가 삭제되었습니다.', 'success');
        } catch(e) {
            showToast('삭제 중 오류가 발생했습니다.', 'error');
        }
    };
}

// ===== Data Management =====
function initDataManagement() {
    // Import
    const importZone = document.getElementById('importDropZone');
    const importInput = document.getElementById('importFile');
    
    importZone.addEventListener('click', () => importInput.click());
    importZone.addEventListener('dragover', (e) => { e.preventDefault(); importZone.classList.add('drag-over'); });
    importZone.addEventListener('dragleave', () => importZone.classList.remove('drag-over'));
    importZone.addEventListener('drop', (e) => {
        e.preventDefault();
        importZone.classList.remove('drag-over');
        handleImportFile(e.dataTransfer.files[0]);
    });
    importInput.addEventListener('change', () => {
        if (importInput.files[0]) handleImportFile(importInput.files[0]);
    });

    // Backup
    document.getElementById('backupBtn').addEventListener('click', downloadBackup);

    // Restore
    const restoreZone = document.getElementById('restoreDropZone');
    const restoreInput = document.getElementById('restoreFile');
    
    restoreZone.addEventListener('click', () => restoreInput.click());
    restoreZone.addEventListener('dragover', (e) => { e.preventDefault(); restoreZone.classList.add('drag-over'); });
    restoreZone.addEventListener('dragleave', () => restoreZone.classList.remove('drag-over'));
    restoreZone.addEventListener('drop', (e) => {
        e.preventDefault();
        restoreZone.classList.remove('drag-over');
        handleRestoreFile(e.dataTransfer.files[0]);
    });
    restoreInput.addEventListener('change', () => {
        if (restoreInput.files[0]) handleRestoreFile(restoreInput.files[0]);
    });
}

function handleImportFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            let rows;
            if (ext === 'csv') {
                rows = parseCSV(e.target.result);
            } else {
                const wb = XLSX.read(e.target.result, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                rows = XLSX.utils.sheet_to_json(ws);
            }

            if (rows.length === 0) {
                showToast('데이터가 없습니다.', 'warning');
                return;
            }

            // Show preview
            showImportPreview(rows);
        } catch(err) {
            showToast('파일 읽기 오류: ' + err.message, 'error');
        }
    };
    
    if (ext === 'csv') reader.readAsText(file);
    else reader.readAsBinaryString(file);
}

function parseCSV(text) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const obj = {};
        headers.forEach((h, i) => obj[h] = vals[i] || '');
        return obj;
    });
}

function showImportPreview(rows) {
    const preview = document.getElementById('importPreview');
    const cols = Object.keys(rows[0]);
    const sampleRows = rows.slice(0, 5);

    preview.style.display = 'block';
    preview.innerHTML = `
        <h4 style="margin:12px 0 8px;">미리보기 (총 ${rows.length}건)</h4>
        <div class="table-wrapper">
            <table class="data-table">
                <thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
                <tbody>${sampleRows.map(r => `<tr>${cols.map(c=>`<td>${r[c]||''}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>
        </div>
        <p class="hint" style="margin-top:8px;">컬럼 매핑: 날짜, 구분(지출/수입), 분류, 사용처, 금액, 결제수단, 메모</p>
        <div class="import-actions">
            <button class="btn btn-secondary" onclick="document.getElementById('importPreview').style.display='none'">취소</button>
            <button class="btn btn-primary" id="confirmImport"><i class="fas fa-file-import"></i> 가져오기</button>
        </div>
    `;

    document.getElementById('confirmImport').onclick = () => importData(rows);
}

async function importData(rows) {
    const typeMap = { '지출': 'expense', '수입': 'income' };
    const payMap = { '카드': 'card', '현금': 'cash', '이체': 'transfer', '기타': 'etc' };
    let imported = 0;

    for (const row of rows) {
        const keys = Object.keys(row);
        const date = row[keys.find(k => k.includes('날짜') || k.toLowerCase().includes('date'))] || Utils.today();
        const typeStr = row[keys.find(k => k.includes('구분') || k.includes('분류') && k.includes('대') || k.toLowerCase().includes('type'))] || '';
        const catName = row[keys.find(k => (k.includes('분류') && !k.includes('대')) || k.includes('카테고리') || k.toLowerCase().includes('category'))] || '';
        const desc = row[keys.find(k => k.includes('사용처') || k.includes('내용') || k.includes('설명') || k.toLowerCase().includes('description'))] || '';
        const amtStr = row[keys.find(k => k.includes('금액') || k.toLowerCase().includes('amount'))] || '0';
        const payStr = row[keys.find(k => k.includes('결제') || k.toLowerCase().includes('payment'))] || '';
        const memo = row[keys.find(k => k.includes('메모') || k.toLowerCase().includes('memo'))] || '';

        const type = typeMap[typeStr] || (parseInt(String(amtStr).replace(/[^0-9-]/g,'')) < 0 ? 'expense' : 'expense');
        const amount = Math.abs(Utils.parseAmount(amtStr));
        if (!amount) continue;

        // Try to match category
        const matchCat = APP.categories.find(c => c.name === catName && c.type === type);
        const autoCat = !matchCat ? autoClassify(desc, type) : null;
        const finalCat = matchCat || autoCat;

        try {
            await API.create('transactions', {
                date: date.replace(/\//g, '-'),
                type,
                category: finalCat ? finalCat.id : '',
                category_name: catName || (finalCat ? finalCat.name : ''),
                description: desc,
                amount,
                payment_method: payMap[payStr] || 'card',
                memo,
                is_recurring: false,
                recurring_id: '',
                deleted: false
            });
            imported++;
        } catch(e) {
            console.error('Import row error:', e);
        }
    }

    await loadAllData();
    document.getElementById('importPreview').style.display = 'none';
    showToast(`${imported}건이 가져오기 되었습니다.`, 'success');
}

async function downloadBackup() {
    const allData = Store.exportAll();
    const backup = {
        version: '1.0',
        date: new Date().toISOString(),
        ...allData
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `가계부_백업_${Utils.today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('백업 파일이 다운로드되었습니다.', 'success');
}

async function handleRestoreFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const backup = JSON.parse(e.target.result);
            if (!backup.transactions || !backup.categories) {
                showToast('올바른 백업 파일이 아닙니다.', 'error');
                return;
            }

            openModal('데이터 복원',
                `<p>백업 파일의 데이터를 복원하시겠습니까?</p>
                 <ul style="margin:12px 0;padding-left:20px;font-size:0.88rem;color:var(--text-secondary);">
                    <li>거래 내역: ${backup.transactions.length}건</li>
                    <li>분류: ${backup.categories.length}건</li>
                    <li>예산: ${(backup.budgets || []).length}건</li>
                    <li>반복 거래: ${(backup.recurring || []).length}건</li>
                 </ul>
                 <p class="hint" style="color:var(--warning-color);"><i class="fas fa-exclamation-triangle"></i> 기존 데이터에 추가됩니다.</p>`,
                `<button class="btn btn-secondary" onclick="closeModal()">취소</button>
                 <button class="btn btn-primary" id="confirmRestore">복원</button>`
            );

            document.getElementById('confirmRestore').onclick = async () => {
                try {
                    Store.importAll(backup);
                    await loadAllData();
                    closeModal();
                    showToast('데이터가 복원되었습니다.', 'success');
                    switchTab('dashboard');
                } catch(e) {
                    showToast('복원 중 오류가 발생했습니다.', 'error');
                }
            };
        } catch(err) {
            showToast('파일 읽기 오류: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
}

// ===== Modal Close Events =====
function initModal() {
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('modalOverlay')) closeModal();
    });
}

// ===== Auto-generate Recurring Transactions =====
async function autoGenerateRecurring() {
    const ym = Utils.currentYM();
    for (const r of APP.recurring) {
        if (!r.is_active) continue;
        if (r.end_date && r.end_date < Utils.today()) continue;
        if (r.last_generated === ym) continue;

        const exists = APP.transactions.find(t => t.recurring_id === r.id && t.date.startsWith(ym));
        if (exists) continue;

        const [y, m] = ym.split('-').map(Number);
        const day = Math.min(r.day_of_month, new Date(y, m, 0).getDate());
        const date = `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

        // Only auto-generate if the day has passed or is today
        if (date <= Utils.today()) {
            try {
                await API.create('transactions', {
                    date,
                    type: r.type,
                    category: r.category,
                    category_name: r.category_name,
                    description: r.description,
                    amount: r.amount,
                    payment_method: r.payment_method,
                    memo: r.memo ? `[자동반복] ${r.memo}` : '[자동반복]',
                    is_recurring: true,
                    recurring_id: r.id,
                    deleted: false
                });
                await API.patch('recurring', r.id, { last_generated: ym });
            } catch(e) {
                console.error('Auto recurring error:', e);
            }
        }
    }
    // Reload after generation
    await loadAllData();
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initNavigation();
    initModal();
    
    await loadAllData();
    
    initTransactionForm();
    initList();
    initStats();
    initBudget();
    initRecurring();
    initAdmin();
    initDataManagement();

    // Auto-generate recurring
    await autoGenerateRecurring();

    // Default tab
    switchTab('dashboard');

    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
});
