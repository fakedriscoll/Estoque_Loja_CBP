function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div'); toast.className = `toast toast-${type}`; toast.textContent = message;
    container.appendChild(toast); setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 250); }, 3600);
}

// ===== CONFIGURAÇÃO DO FIREBASE =====
const firebaseConfig = {
  apiKey: "AIzaSyAVL1-2YEdZNYCwR5siLM0zZpdHGVlg0jc",
  authDomain: "cbp-estoque.firebaseapp.com",
  projectId: "cbp-estoque",
  storageBucket: "cbp-estoque.firebasestorage.app",
  messagingSenderId: "770580270100",
  appId: "1:770580270100:web:7f298f139c8a5d3e5ceb01"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let inventory = [];
let currentInventoryType = null;
let currentUser = null;
let inventoryUnsubscribe = null;
let activityUnsubscribe = null;

const selectionScreen = document.getElementById('selection-screen');
const managementScreen = document.getElementById('management-screen');
const inventoryBody = document.getElementById('inventory-body');
const totalItemsEl = document.getElementById('total-items');
const totalValueEl = document.getElementById('total-value');
const lowStockCountEl = document.getElementById('low-stock-count');
const totalSalesEl = document.getElementById('total-sales');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const brandFilter = document.getElementById('brand-filter');
const statusFilter = document.getElementById('status-filter');
const sortFilter = document.getElementById('sort-filter');
const reportSeller = document.getElementById('report-seller');
const reportPayment = document.getElementById('report-payment');
const reportCustomer = document.getElementById('report-customer');
const quickSaleModal = document.getElementById('quick-sale-modal');
const quickSaleForm = document.getElementById('quick-sale-form');
let currentInventoryPage = 1;
const INVENTORY_PAGE_SIZE = 10;
const btnAddProduct = document.getElementById('btn-add-product');
const btnBackSelection = document.getElementById('btn-back-selection');
const modal = document.getElementById('product-modal');
const salesModal = document.getElementById('sales-modal');
const resetPasswordModal = document.getElementById('reset-password-modal');
const closeModals = document.querySelectorAll('.close');
const productForm = document.getElementById('product-form');
const salesForm = document.getElementById('sales-form');
const resetPasswordForm = document.getElementById('reset-password-form');
const modalTitle = document.getElementById('modal-title');
const reportMonth = document.getElementById('report-month');
const btnExportReport = document.getElementById('btn-export-report');
const currentInventoryName = document.getElementById('current-inventory-name');

document.addEventListener('DOMContentLoaded', () => {
    setupAuthListeners();
    checkAuthState();
    setupSearchAndFilter();
    setupResetPasswordListener();
});

// ===== AUTENTICAÇÃO =====
function setupAuthListeners() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegister = document.getElementById('show-register');
    const showLogin = document.getElementById('show-login');
    const btnLogout = document.getElementById('btn-logout');
    const btnLogoutAdmin = document.getElementById('btn-logout-admin');
    const btnAdminInventory = document.getElementById('btn-admin-inventory');
    const btnBackAdmin = document.getElementById('btn-back-admin');

    if (showRegister) {
        showRegister.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('login-form-container').style.display = 'none';
            document.getElementById('register-form-container').style.display = 'block';
        });
    }

    if (showLogin) {
        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('login-form-container').style.display = 'block';
            document.getElementById('register-form-container').style.display = 'none';
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value.trim();
            const email = username + "@pckl.com";
            const password = document.getElementById('login-password').value;
            
            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                let userDoc = await db.collection('users').doc(user.uid).get();
                
                if (!userDoc.exists) {
                    const role = username === 'admin' ? 'admin' : 'user';
                    const status = username === 'admin' ? 'approved' : 'pending';
                    await db.collection('users').doc(user.uid).set({
                        username: username,
                        role: role,
                        status: status,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    userDoc = await db.collection('users').doc(user.uid).get();
                }

                const userData = userDoc.data();

                if (!userData) {
                    showToast('Erro ao carregar dados do usuário.');
                    auth.signOut();
                    return;
                }

                if (userData.status === 'pending') {
                    showToast('Sua conta ainda está pendente de aprovação.');
                    auth.signOut();
                } else if (userData.status === 'rejected') {
                    showToast('Sua solicitação foi recusada.');
                    auth.signOut();
                } else {
                    currentUser = { ...userData, uid: user.uid };
                    handleLoginSuccess();
                }
            } catch (error) {
                showToast('Erro ao entrar: ' + error.message);
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('reg-username').value.trim();
            const email = username + "@pckl.com";
            const password = document.getElementById('reg-password').value;
            
            if (password.length < 6) {
                showToast("A senha deve ter pelo menos 6 caracteres!");
                return;
            }
            
            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                await db.collection('users').doc(user.uid).set({
                    username: username,
                    role: 'user',
                    status: 'pending',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                showToast('Solicitação enviada! Aguarde a aprovação do administrador.');
                auth.signOut();
                if (showLogin) showLogin.click();
            } catch (error) {
                showToast('Erro ao registrar: ' + error.message);
            }
        });
    }

    if (btnLogout) btnLogout.addEventListener('click', () => auth.signOut());
    if (btnLogoutAdmin) btnLogoutAdmin.addEventListener('click', () => auth.signOut());
    if (btnAdminInventory) btnAdminInventory.addEventListener('click', (e) => {
        e.preventDefault();
        showInventorySelectionForAdmin();
    });
    if (btnBackAdmin) btnBackAdmin.addEventListener('click', () => {
        selectionScreen.style.display = 'none';
        managementScreen.style.display = 'none';
        document.getElementById('admin-screen').style.display = 'flex';
        btnBackAdmin.style.display = 'none';
    });
}

function checkAuthState() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                let userDoc = await db.collection('users').doc(user.uid).get();
                
                if (!userDoc.exists) {
                    await db.collection('users').doc(user.uid).set({
                        username: user.email.split('@')[0],
                        role: 'user',
                        status: 'pending',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    userDoc = await db.collection('users').doc(user.uid).get();
                }
                
                if (userDoc.exists) {
                    currentUser = { ...userDoc.data(), uid: user.uid };
                    handleLoginSuccess();
                }
            } catch (error) {
                handleLogout();
            }
        } else {
            handleLogout();
        }
    });
}

async function handleLoginSuccess() {
    document.getElementById('login-screen').style.display = 'none';
    
    if (currentUser.uid && currentUser.role === 'admin') {
        await db.collection('users').doc(currentUser.uid).set({
            username: 'admin',
            role: 'admin',
            status: 'approved'
        }, { merge: true });
    }

    if (currentUser.role === 'admin') {
        showAdminPanel();
    } else {
        selectionScreen.style.display = 'flex';
        const backAdmin = document.getElementById('btn-back-admin');
        if (backAdmin) backAdmin.style.display = 'none';
        updateSelectionCounts();
    }
}

function handleLogout() {
    currentUser = null;
    document.getElementById('login-screen').style.display = 'flex';
    selectionScreen.style.display = 'none';
    managementScreen.style.display = 'none';
    document.getElementById('admin-screen').style.display = 'none';
}

// ===== PAINEL ADMIN =====
function showAdminPanel() {
    document.getElementById('admin-screen').style.display = 'flex';
    selectionScreen.style.display = 'none';
    managementScreen.style.display = 'none';
    const backAdmin = document.getElementById('btn-back-admin');
    if (backAdmin) backAdmin.style.display = 'none';
    db.collection('users').onSnapshot(snapshot => {
        const requestsBody = document.getElementById('users-requests-body');
        if (!requestsBody) return;
        requestsBody.innerHTML = '';
        snapshot.forEach(doc => {
            const user = doc.data();
            if (user.role !== 'admin') {
                const row = document.createElement('tr');
                const userBrand = user.allowedBrand || 'Todas';
                row.innerHTML = `
                    <td>${user.username}</td>
                    <td><span class="status-badge status-${user.status}">${user.status}</span> <br> <small>Marca: ${userBrand}</small></td>
                    <td>
                        <button class="btn-reset-password edit-user-btn" data-id="${doc.id}" data-username="${user.username}" data-brand="${user.allowedBrand || ''}" data-role="${user.role || 'user'}"><i class="fas fa-key"></i> Editar</button>
                        ${user.status === 'pending' ? `
                            <button class="btn-approve" onclick="updateUserStatus('${doc.id}', 'approved')">Aprovar</button>
                            <button class="btn-reject" onclick="updateUserStatus('${doc.id}', 'rejected')">Recusar</button>
                        ` : `
                            <button class="btn-delete" onclick="deleteUser('${doc.id}')"><i class="fas fa-trash-alt"></i></button>
                        `}
                    </td>
                `;
                requestsBody.appendChild(row);
            }
        });

        // Adiciona listeners para os botões de editar (forma mais segura que onclick inline)
        document.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.onclick = () => {
                const uid = btn.getAttribute('data-id');
                const username = btn.getAttribute('data-username');
                const brand = btn.getAttribute('data-brand');
                const role = btn.getAttribute('data-role') || 'user';
                openResetPasswordModal(uid, username, brand, role);
            };
        });
    });
}

function showInventorySelectionForAdmin() {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('Apenas administradores podem acessar os estoques por este menu.');
        return;
    }
    document.getElementById('admin-screen').style.display = 'none';
    managementScreen.style.display = 'none';
    selectionScreen.style.display = 'flex';
    const backAdmin = document.getElementById('btn-back-admin');
    if (backAdmin) backAdmin.style.display = 'inline-flex';
    updateSelectionCounts();
}

window.updateUserStatus = (uid, status) => {
    db.collection('users').doc(uid).update({ status: status });
};

window.deleteUser = (uid) => {
    if (confirm('Tem certeza que deseja excluir este usuário?')) {
        db.collection('users').doc(uid).delete();
    }
};

window.openResetPasswordModal = (uid, username, brand, role = 'user') => {
    const idInput = document.getElementById('reset-user-id');
    const nameInput = document.getElementById('edit-username');
    const brandInput = document.getElementById('edit-brand');
    const roleInput = document.getElementById('edit-role');
    if (idInput) idInput.value = uid;
    if (nameInput) nameInput.value = username;
    if (brandInput) brandInput.value = brand || '';
    if (roleInput) roleInput.value = role;
    if (resetPasswordModal) resetPasswordModal.style.display = 'block';
};

function setupResetPasswordListener() {
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const uid = document.getElementById('reset-user-id').value;
            const newUsername = document.getElementById('edit-username').value.trim();

            try {
                const updateData = { 
                    username: newUsername,
                    allowedBrand: document.getElementById('edit-brand').value,
                    role: document.getElementById('edit-role').value
                };
                
                await db.collection('users').doc(uid).update(updateData);
                showToast('Usuário atualizado com sucesso!');
                if (resetPasswordModal) resetPasswordModal.style.display = 'none';
                resetPasswordForm.reset();
            } catch (error) {
                showToast('Erro ao atualizar usuário: ' + error.message);
            }
        });
    }
}

// ===== UTILITÁRIOS, HISTÓRICO E BACKUP =====
function formatMoney(value) {
    return `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function logActivity(type, description, details = {}) {
    if (!currentUser || !currentInventoryType) return;
    try {
        await db.collection(`activities_${currentInventoryType}`).add({
            type, description, details, username: currentUser.username || 'usuário',
            userId: currentUser.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) { console.warn('Não foi possível registrar a atividade:', error); }
}

function renderActivities(snapshot) {
    const list = document.getElementById('activity-list');
    if (!list) return;
    const docs = [];
    snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
    list.innerHTML = docs.length ? docs.slice(0, 8).map(item => {
        const date = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString('pt-BR') : 'agora';
        return `<div class="activity-item"><span class="activity-dot"></span><div><strong>${item.description || item.type}</strong><small>${item.username || 'usuário'} • ${date}</small></div></div>`;
    }).join('') : '<p class="empty-state">Nenhuma movimentação registrada ainda.</p>';
}

function renderMonthlySalesHistory() {
    const body = document.getElementById('monthly-sales-body');
    const totalEl = document.getElementById('monthly-sales-total');
    const periodEl = document.getElementById('monthly-sales-period');
    if (!body || !currentInventoryType) return;

    const now = getSelectedMonthDate() || new Date();
    const monthName = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    if (periodEl) periodEl.innerText = `Vendas realizadas em ${monthName}`;
    const rows = [];
    inventory.forEach(product => {
        getProductSales(product).forEach((sale, saleIndex) => {
            const seller = sale.seller || sale.vendedor || 'N/A';
            const payment = sale.payment || sale.pagamento || 'Não informado';
            const customer = sale.customer || sale.cliente || '';
            if (!isSaleInMonth(sale, now) || (reportSeller?.value && seller !== reportSeller.value) || (reportPayment?.value && payment !== reportPayment.value) || (reportCustomer?.value && !customer.toLowerCase().includes(reportCustomer.value.toLowerCase()))) return;
            const totals = getSaleTotals(product, sale);
            rows.push({
                productId: product.id,
                saleIndex,
                date: sale.date || sale.data || sale.saleDate || sale.dataVenda || '',
                time: sale.time || sale.hora || '',
                product: product.name,
                seller: sale.seller || sale.vendedor || 'N/A',
                customer: sale.customer || sale.cliente || '—',
                payment: sale.payment || sale.pagamento || 'Não informado',
                quantity: totals.quantity,
                total: totals.totalWithDiscount
            });
        });
    });
    rows.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    if (totalEl) totalEl.innerText = formatMoney(total);
    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhuma venda registrada neste mês.</td></tr>';
        return;
    }
    body.innerHTML = rows.slice(0, 50).map(row => `<tr>
        <td>${row.date}${row.time ? ` <small>${row.time}</small>` : ''}</td>
        <td>${row.product}</td>
        <td>${row.seller}</td>
        <td>${row.customer}</td>
        <td>${row.payment}</td>
        <td>${row.quantity}</td>
        <td><strong>${formatMoney(row.total)}</strong></td>
        <td>${currentUser?.role === 'admin' ? `<button class="btn-delete-sale" type="button" onclick="deleteSale('${row.productId}', ${row.saleIndex})" title="Excluir venda"><i class="fas fa-trash-alt"></i></button>` : '<span class="muted-text">—</span>'}</td>
    </tr>`).join('');
}

function loadActivities() {
    if (!currentInventoryType) return;
    if (activityUnsubscribe) activityUnsubscribe();
    const inventoryType = currentInventoryType;
    activityUnsubscribe = db.collection(`activities_${inventoryType}`).orderBy('createdAt', 'desc').limit(8).onSnapshot(snapshot => {
        if (currentInventoryType === inventoryType) renderActivities(snapshot);
    }, () => {});
}

function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

async function backupInventory() {
    if (!currentInventoryType) return;
    const products = inventory.map(({ id, ...data }) => ({ id, ...data }));
    const activities = [];
    try { const snap = await db.collection(`activities_${currentInventoryType}`).get(); snap.forEach(doc => activities.push({ id: doc.id, ...doc.data() })); } catch (error) {}
    downloadJson(`backup_${currentInventoryType}_${new Date().toISOString().slice(0, 10)}.json`, { version: 1, inventoryType: currentInventoryType, exportedAt: new Date().toISOString(), products, activities });
    showToast('Backup exportado com sucesso.');
}

async function restoreInventory(file) {
    if (!currentInventoryType || !file || currentUser?.role !== 'admin') { showToast('Apenas administradores podem restaurar um backup.'); return; }
    try {
        const payload = JSON.parse(await file.text());
        if (!Array.isArray(payload.products)) throw new Error('Formato de backup inválido.');
        if (!confirm('A restauração substituirá os produtos deste estoque. Deseja continuar?')) return;
        const collection = db.collection(`inventory_${currentInventoryType}`);
        const existing = await collection.get(); let batch = db.batch(); let operations = 0;
        existing.forEach(doc => { batch.delete(doc.ref); operations++; });
        for (const product of payload.products) {
            const { id, ...data } = product; const ref = id ? collection.doc(id) : collection.doc(); batch.set(ref, data); operations++;
            if (operations >= 450) { await batch.commit(); batch = db.batch(); operations = 0; }
        }
        if (operations) await batch.commit();
        await logActivity('backup_restaurado', `${payload.products.length} produtos restaurados`);
        showToast('Backup restaurado com sucesso.');
    } catch (error) { showToast('Não foi possível restaurar o backup: ' + error.message); }
}

// ===== GESTÃO DE ESTOQUE =====
window.selectInventory = (type) => {
    currentInventoryType = type;
    selectionScreen.style.display = 'none';
    managementScreen.style.display = 'flex';
    
    if (currentInventoryName) {
        currentInventoryName.innerText = type === 'loja' ? 'ESTOQUE LOJA' : 'ESTOQUE VITRINE';
    }
    
    loadInventory();
    loadActivities();
    renderMonthlySalesHistory();
    setCurrentMonth();
};

if (btnBackSelection) {
    btnBackSelection.onclick = () => {
        managementScreen.style.display = 'none';
        selectionScreen.style.display = 'flex';
        const backAdmin = document.getElementById('btn-back-admin');
        if (backAdmin) backAdmin.style.display = currentUser?.role === 'admin' ? 'inline-flex' : 'none';
        updateSelectionCounts();
    };
}

async function updateSelectionCounts() {
    const lojaSnap = await db.collection('inventory_loja').get();
    const vitrineSnap = await db.collection('inventory_vitrine').get();
    
    const lojaCount = document.getElementById('loja-count');
    const vitrineCount = document.getElementById('vitrine-count');
    
    if (lojaCount) lojaCount.innerText = `${lojaSnap.size} produtos`;
    if (vitrineCount) vitrineCount.innerText = `${vitrineSnap.size} produtos`;
}

function loadInventory() {
    if (!currentInventoryType) return;
    if (inventoryUnsubscribe) inventoryUnsubscribe();
    const inventoryType = currentInventoryType;
    inventoryUnsubscribe = db.collection(`inventory_${inventoryType}`).onSnapshot(snapshot => {
        if (currentInventoryType !== inventoryType) return;
        inventory = [];
        snapshot.forEach(doc => inventory.push({ id: doc.id, ...doc.data() }));
        updateInventoryTable();
        populateReportFilters();
        renderMonthlySalesHistory();
        if (document.getElementById('relatorio').style.display !== 'none') updateReportCharts();
    }, error => {
        console.error('Erro ao carregar estoque:', error);
        showToast('Não foi possível atualizar este estoque. Verifique sua conexão e as regras do Firebase.');
    });
}

function updateInventoryTable() {
    if (!inventoryBody) return;
    
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const category = categoryFilter ? categoryFilter.value : '';
    const brand = brandFilter ? brandFilter.value : '';
    const status = statusFilter ? statusFilter.value : '';
    const sort = sortFilter ? sortFilter.value : 'name';
    
    const filtered = inventory.filter(item => {
        const searchable = [item.name, item.category, item.brand, item.sku, item.barcode, item.supplier, item.location].filter(Boolean).join(' ').toLowerCase();
        const matchesSearch = searchable.includes(searchTerm);
        const matchesCategory = category === '' || item.category === category;
        
        // Restrição de Marca para Usuários
        let matchesBrand = brand === '' || item.brand === brand;
        if (currentUser && currentUser.role !== 'admin' && currentUser.allowedBrand) matchesBrand = item.brand === currentUser.allowedBrand;
        const itemStatus = item.quantity <= 0 ? 'empty' : (item.quantity <= (item.minQuantity || 5) ? 'low' : 'ok');
        const matchesStatus = status === '' || status === itemStatus;
        return matchesSearch && matchesCategory && matchesBrand && matchesStatus;
    });

    filtered.sort((a, b) => {
        if (sort === 'quantity-asc') return Number(a.quantity || 0) - Number(b.quantity || 0);
        if (sort === 'quantity-desc') return Number(b.quantity || 0) - Number(a.quantity || 0);
        if (sort === 'price-desc') return Number(b.price || 0) - Number(a.price || 0);
        if (sort === 'sales-desc') return getProductSales(b).reduce((n, s) => n + Number(s.quantity || s.quantidade || 0), 0) - getProductSales(a).reduce((n, s) => n + Number(s.quantity || s.quantidade || 0), 0);
        return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    });
    
    const start = (currentInventoryPage - 1) * INVENTORY_PAGE_SIZE;
    renderInventory(filtered.slice(start, start + INVENTORY_PAGE_SIZE));
    renderPagination(filtered.length);
    updateStats(filtered);
}

function renderPagination(total) {
    const el = document.getElementById('inventory-pagination'); if (!el) return;
    const pages = Math.max(1, Math.ceil(total / INVENTORY_PAGE_SIZE)); if (currentInventoryPage > pages) currentInventoryPage = pages;
    el.innerHTML = `<button ${currentInventoryPage===1?'disabled':''} data-page="prev">‹</button><span>Página ${currentInventoryPage} de ${pages} · ${total} produtos</span><button ${currentInventoryPage===pages?'disabled':''} data-page="next">›</button>`;
    el.querySelectorAll('button').forEach(btn => btn.onclick = () => { if (btn.dataset.page==='prev' && currentInventoryPage>1) currentInventoryPage--; if (btn.dataset.page==='next' && currentInventoryPage<pages) currentInventoryPage++; updateInventoryTable(); });
}

function renderInventory(items) {
    if (!inventoryBody) return;
    inventoryBody.innerHTML = '';
    
    items.forEach(item => {
        const status = item.quantity <= 0 ? 'empty' : (item.quantity <= (item.minQuantity || 5) ? 'low' : 'ok');
        const statusText = item.quantity <= 0 ? 'Esgotado' : (item.quantity <= (item.minQuantity || 5) ? 'Baixo' : 'Normal');
        
        const salesMonth = item.sales ? item.sales.filter(s => {
            const d = new Date(s.date);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).reduce((sum, s) => sum + s.quantity, 0) : 0;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="product-cell">${item.imageUrl ? `<img class="product-thumb" src="${item.imageUrl}" alt="">` : '<span class="product-thumb product-thumb-empty"><i class="fas fa-box"></i></span>'}<div><div style="font-weight: 600;">${item.name}${item.size ? ` (${item.size})` : ''}</div>
                <div class="product-subtitle">${item.brand || 'Sem Marca'}${item.sku ? ` • SKU: ${item.sku}` : ''}</div></div></td>
            <td>${item.category}</td>
            <td>R$ ${(item.price || 0).toFixed(2)}</td>
            <td>R$ ${(item.cost || 0).toFixed(2)}</td>
            <td>${item.quantity}</td>
            <td>${salesMonth}</td>
            <td><span class="status-badge status-${status}">${statusText}</span></td>
            <td>
                <button class="btn-sales" onclick="openSalesModal('${item.id}')" title="Registrar Venda"><i class="fas fa-shopping-cart"></i></button>
                <button class="btn-edit" onclick="editProduct('${item.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" onclick="deleteProduct('${item.id}')" title="Excluir"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        inventoryBody.appendChild(row);
    });
}

function updateStats(items) {
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0);
    const lowStock = items.filter(item => item.quantity <= (item.minQuantity || 5)).length;
    
    let totalSales = 0;
    items.forEach(item => {
        if (item.sales) {
            totalSales += item.sales.reduce((sum, s) => sum + s.quantity, 0);
        }
    });

    if (totalItemsEl) totalItemsEl.innerText = totalItems;
    if (totalValueEl) totalValueEl.innerText = `R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (lowStockCountEl) lowStockCountEl.innerText = lowStock;
    if (totalSalesEl) totalSalesEl.innerText = totalSales;
    const totalProfit = items.reduce((sum, item) => sum + (Number(item.quantity || 0) * (Number(item.price || 0) - Number(item.cost || 0))), 0);
    const profitEl = document.getElementById('total-profit');
    if (profitEl) profitEl.innerText = formatMoney(totalProfit);
}

// ===== BUSCA E FILTRO =====
function setupSearchAndFilter() {
    if (searchInput) searchInput.addEventListener('input', () => { currentInventoryPage = 1; updateInventoryTable(); });
    if (categoryFilter) categoryFilter.addEventListener('change', updateInventoryTable);
    if (brandFilter) brandFilter.addEventListener('change', updateInventoryTable);
    if (statusFilter) statusFilter.addEventListener('change', updateInventoryTable);
    if (sortFilter) sortFilter.addEventListener('change', updateInventoryTable);
}

// ===== MODAIS E FORMULÁRIOS =====
if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('product-id').value;
            const productData = {
                name: document.getElementById('name').value,
                category: document.getElementById('category').value,
                brand: document.getElementById('brand').value,
                size: document.getElementById('category').value === 'Vestuário' ? document.getElementById('size').value : '',
                sku: document.getElementById('sku').value.trim(),
                barcode: document.getElementById('barcode').value.trim(),
                supplier: document.getElementById('supplier').value.trim(),
                imageUrl: document.getElementById('image-url')?.value.trim() || '',
                location: document.getElementById('location').value.trim(),
                price: parseFloat(document.getElementById('price').value),
                cost: parseFloat(document.getElementById('cost').value),
                quantity: parseInt(document.getElementById('quantity').value),
                minQuantity: parseInt(document.getElementById('min-quantity').value),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

        if (!currentUser || !['admin', 'manager'].includes(currentUser.role)) { showToast('Você não tem permissão para alterar produtos.'); return; }
        if (!productData.name || !productData.category || !Number.isFinite(productData.price) || !Number.isFinite(productData.cost) || productData.price < 0 || productData.cost < 0 || !Number.isInteger(productData.quantity) || productData.quantity < 0 || !Number.isInteger(productData.minQuantity) || productData.minQuantity < 0) {
            showToast('Revise os dados: preço, custo, quantidade e mínimo não podem ser negativos.'); return;
        }
        try {
            if (id) {
                await db.collection(`inventory_${currentInventoryType}`).doc(id).update(productData);
                await logActivity('produto_atualizado', productData.name, { productId: id });
                showToast('Produto atualizado com sucesso!');
            } else {
                productData.sales = [];
                productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                const ref = await db.collection(`inventory_${currentInventoryType}`).add(productData);
                await logActivity('produto_criado', productData.name, { productId: ref.id });
                showToast('Produto adicionado com sucesso!');
            }
            // Atualização imediata: o listener também continuará sincronizando alterações futuras.
            const freshSnapshot = await db.collection(`inventory_${currentInventoryType}`).get();
            inventory = freshSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateInventoryTable();
            renderMonthlySalesHistory();
            if (modal) modal.style.display = 'none';
            productForm.reset();
        } catch (error) {
            showToast('Erro ao salvar produto: ' + error.message);
        }
    });
}

if (salesForm) {
    salesForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const productId = document.getElementById('sale-product-id').value;
        const quantity = parseInt(document.getElementById('sale-quantity').value);
        const date = document.getElementById('sale-date').value;
        const time = document.getElementById('sale-time').value;
        const seller = document.getElementById('sale-seller').value.trim();
        const customer = document.getElementById('sale-customer')?.value.trim() || '';
        const payment = document.getElementById('sale-payment')?.value || 'Não informado';
        const discount = parseFloat(document.getElementById('sale-discount').value) || 0;
        const description = document.getElementById('sale-description').value.trim();
        
        try {
            const productRef = db.collection(`inventory_${currentInventoryType}`).doc(productId);
            const doc = await productRef.get();
            const product = doc.data();
            
            if (!currentUser || !['admin', 'manager', 'user'].includes(currentUser.role) || !Number.isInteger(quantity) || quantity <= 0) { showToast('Informe uma quantidade válida.'); return; }
            if (product.quantity < quantity) {
                showToast('Quantidade insuficiente em estoque!');
                return;
            }
            
            const unitPrice = product.price || 0;
            const totalOriginal = unitPrice * quantity;
            const totalWithDiscount = totalOriginal * (1 - (discount / 100));
            
            const newSales = product.sales || [];
            newSales.push({
                date,
                time,
                quantity,
                seller,
                customer,
                payment,
                discount,
                totalOriginal,
                totalWithDiscount,
                description
            });
            
            await productRef.update({
                quantity: product.quantity - quantity,
                sales: newSales,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await logActivity('venda_registrada', product.name, { quantity, total: totalWithDiscount, productId });
            showToast('Venda registrada com sucesso!');
            if (salesModal) salesModal.style.display = 'none';
            salesForm.reset();
        } catch (error) {
            showToast('Erro ao registrar venda: ' + error.message);
        }
    });
}

window.deleteSale = async (productId, saleIndex) => {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('Apenas administradores podem remover vendas.');
        return;
    }
    if (!confirm('Tem certeza que deseja remover esta venda? O estoque será devolvido.')) return;
    try {
        const productRef = db.collection(`inventory_${currentInventoryType}`).doc(productId);
        const doc = await productRef.get();
        if (!doc.exists) throw new Error('Produto não encontrado.');
        const product = doc.data();
        const sales = getProductSales(product);
        const sale = sales[saleIndex];
        if (!sale) throw new Error('Venda não encontrada.');
        const quantity = Number(sale.quantity || sale.quantidade || 0);
        sales.splice(saleIndex, 1);
        await db.collection(`trash_${currentInventoryType}`).add({
            type: 'sale', productId, productName: product.name, sale, saleIndex,
            deletedBy: currentUser.username || currentUser.uid,
            deletedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await productRef.update({
            sales,
            quantity: Number(product.quantity || 0) + quantity,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await logActivity('venda_removida', `${product.name} — ${quantity} unidade(s)`, { productId, saleIndex });
        showToast('Venda removida e estoque devolvido com sucesso.');
    } catch (error) {
        showToast('Não foi possível remover a venda: ' + error.message);
    }
};

window.deleteProduct = (id) => {
    if (!currentUser || currentUser.role !== 'admin') { showToast('Apenas administradores podem excluir produtos.'); return; }
    if (confirm('Tem certeza que deseja excluir este produto? Ele ficará disponível na lixeira administrativa.')) {
        const productRef = db.collection(`inventory_${currentInventoryType}`).doc(id);
        productRef.get().then(async doc => {
            if (!doc.exists) throw new Error('Produto não encontrado.');
            await db.collection(`trash_${currentInventoryType}`).add({
                type: 'product', productId: id, product: doc.data(),
                deletedBy: currentUser.username || currentUser.uid,
                deletedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await productRef.delete();
            await logActivity('produto_excluido', doc.data().name, { productId: id });
            showToast('Produto movido para a lixeira administrativa.');
        }).catch(error => showToast('Erro ao excluir: ' + error.message));
    }
};

window.editProduct = (id) => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    
    if (modalTitle) modalTitle.innerText = 'Editar Produto';
    const idInput = document.getElementById('product-id');
    const nameInput = document.getElementById('name');
    const catInput = document.getElementById('category');
    const brandInput = document.getElementById('brand');
    const sizeInput = document.getElementById('size');
    const sizeGroup = document.getElementById('size-group');
    const priceInput = document.getElementById('price');
    const qtyInput = document.getElementById('quantity');
    const minQtyInput = document.getElementById('min-quantity');
    const skuInput = document.getElementById('sku');
    const barcodeInput = document.getElementById('barcode');
    const costInput = document.getElementById('cost');
    const supplierInput = document.getElementById('supplier');
    const locationInput = document.getElementById('location');
    const imageInput = document.getElementById('image-url');
    if (imageInput) imageInput.value = item.imageUrl || '';
    
    if (idInput) idInput.value = item.id;
    if (nameInput) nameInput.value = item.name;
    if (catInput) catInput.value = item.category;
    if (brandInput) brandInput.value = item.brand || '';
    if (skuInput) skuInput.value = item.sku || '';
    if (barcodeInput) barcodeInput.value = item.barcode || '';
    if (costInput) costInput.value = item.cost ?? 0;
    if (supplierInput) supplierInput.value = item.supplier || '';
    if (locationInput) locationInput.value = item.location || '';
    
    if (item.category === 'Vestuário') {
        if (sizeGroup) sizeGroup.style.display = 'block';
        if (sizeInput) sizeInput.value = item.size || '';
    } else {
        if (sizeGroup) sizeGroup.style.display = 'none';
        if (sizeInput) sizeInput.value = '';
    }

    if (priceInput) priceInput.value = item.price;
    if (qtyInput) qtyInput.value = item.quantity;
    if (minQtyInput) minQtyInput.value = item.minQuantity;
    
    if (modal) modal.style.display = 'block';
};

window.openSalesModal = (id) => {
    const product = inventory.find(p => p.id === id);
    if (!product) return;
    
    const idInput = document.getElementById('sale-product-id');
    const nameDisplay = document.getElementById('sale-product-name');
    const qtyInput = document.getElementById('sale-quantity');
    const dateInput = document.getElementById('sale-date');
    const timeInput = document.getElementById('sale-time');
    const discountInput = document.getElementById('sale-discount');
    const descriptionInput = document.getElementById('sale-description');
    
    if (idInput) idInput.value = id;
    if (nameDisplay) nameDisplay.innerText = product.name;
    if (qtyInput) qtyInput.value = '';
    if (dateInput) dateInput.valueAsDate = new Date();
    if (timeInput) timeInput.value = new Date().toTimeString().slice(0, 5);
    if (discountInput) discountInput.value = 0;
    if (descriptionInput) descriptionInput.value = '';
    
    updateSalePreview();
    
    if (salesModal) salesModal.style.display = 'block';
};

// ===== FUNÇÃO PARA ATUALIZAR PREVIEW DE DESCONTO =====
function updateSalePreview() {
    const productId = document.getElementById('sale-product-id').value;
    const product = inventory.find(p => p.id === productId);
    if (!product) return;

    const quantity = parseInt(document.getElementById('sale-quantity').value) || 0;
    const discount = parseFloat(document.getElementById('sale-discount').value) || 0;
    const unitPrice = product.price || 0;
    
    const totalOriginal = unitPrice * quantity;
    const totalWithDiscount = totalOriginal * (1 - (discount / 100));
    
    const saleTotalPreview = document.getElementById('sale-total-preview');
    if (saleTotalPreview) {
        saleTotalPreview.innerText = `R$ ${totalWithDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.replace('R$', 'R$').trim();
    }
}

// Adicionar listeners para atualizar o preview em tempo real
const saleQtyInput = document.getElementById('sale-quantity');
const saleDiscountInput = document.getElementById('sale-discount');

if (saleQtyInput) saleQtyInput.addEventListener('input', updateSalePreview);
if (saleDiscountInput) saleDiscountInput.addEventListener('input', updateSalePreview);

// ===== RELATÓRIOS E EXPORTAÇÃO =====
let salesByProductChart, monthlySalesChart;

function setCurrentMonth() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    if (reportMonth) reportMonth.value = `${year}-${month}`;
}

function getSaleDateParts(value) {
    if (!value) return null;

    if (typeof value === 'object' && typeof value.toDate === 'function') {
        const date = value.toDate();
        return { year: date.getFullYear(), month: date.getMonth() };
    }

    const text = String(value).trim();
    let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) return { year: Number(match[1]), month: Number(match[2]) - 1 };

    match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (match) return { year: Number(match[3]), month: Number(match[2]) - 1 };

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return { year: parsed.getFullYear(), month: parsed.getMonth() };
}

function isSaleInMonth(sale, selectedDate) {
    const saleDate = getSaleDateParts(sale.date || sale.data || sale.saleDate || sale.dataVenda);
    return Boolean(saleDate && saleDate.year === selectedDate.getFullYear() && saleDate.month === selectedDate.getMonth());
}

function getSelectedMonthDate() {
    if (!reportMonth || !/^\d{4}-\d{2}$/.test(reportMonth.value)) return null;
    const [year, month] = reportMonth.value.split('-').map(Number);
    return new Date(year, month - 1, 1);
}

function getProductSales(product) {
    const rawSales = product.sales ?? product.vendas ?? [];
    if (Array.isArray(rawSales)) return rawSales;
    if (typeof rawSales === 'string') {
        try {
            const parsed = JSON.parse(rawSales);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }
    return [];
}

function getFilteredSales(product, date) {
    return getProductSales(product).filter(s => {
        if (!isSaleInMonth(s, date)) return false;
        const seller = s.seller || s.vendedor || 'N/A'; const payment = s.payment || s.pagamento || 'Não informado'; const customer = s.customer || s.cliente || '';
        return (!reportSeller?.value || seller === reportSeller.value) && (!reportPayment?.value || payment === reportPayment.value) && (!reportCustomer?.value || customer.toLowerCase().includes(reportCustomer.value.toLowerCase()));
    });
}

function populateReportFilters() {
    const sellers = new Set(), payments = new Set(); inventory.forEach(p => getProductSales(p).forEach(s => { sellers.add(s.seller || s.vendedor || 'N/A'); payments.add(s.payment || s.pagamento || 'Não informado'); }));
    if (reportSeller) reportSeller.innerHTML = '<option value="">Todos</option>' + [...sellers].sort().map(x => `<option>${x}</option>`).join('');
    if (reportPayment) reportPayment.innerHTML = '<option value="">Todos</option>' + [...payments].sort().map(x => `<option>${x}</option>`).join('');
}

function updateReportCharts() {
    if (!reportMonth || !reportMonth.value) return;
    const selectedDate = getSelectedMonthDate();
    if (!selectedDate) return;
    const productNames = inventory.map(p => p.name);
    const productSales = inventory.map(p => {
        return getFilteredSales(p, selectedDate)
            .reduce((sum, s) => sum + Number(s.quantity || s.quantidade || 0), 0);
    });

    const canvas1 = document.getElementById('salesByProductChart');
    if (canvas1) {
        const ctx1 = canvas1.getContext('2d');
        if (salesByProductChart) salesByProductChart.destroy();
        salesByProductChart = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: productNames.length > 0 ? productNames : ['Sem dados'],
                datasets: [{ 
                    label: 'Vendas', 
                    data: productSales.length > 0 ? productSales : [0], 
                    backgroundColor: '#003399',
                    borderColor: '#001a4d',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    updateMonthlySalesChart(selectedDate);
    updateReportSummary(selectedDate);
}

function updateMonthlySalesChart(selectedDate) {
    const months = [];
    const monthlySalesData = [];
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date(selectedDate);
        date.setMonth(date.getMonth() - i);
        const monthLabel = date.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
        months.push(monthLabel);
        
        let totalSales = 0;
        inventory.forEach(p => {
            totalSales += getFilteredSales(p, date)
                .reduce((sum, s) => sum + Number(s.quantity || s.quantidade || 0), 0);
        });
        monthlySalesData.push(totalSales);
    }

    const canvas2 = document.getElementById('monthlySalesChart');
    if (canvas2) {
        const ctx2 = canvas2.getContext('2d');
        if (monthlySalesChart) monthlySalesChart.destroy();
        monthlySalesChart = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Vendas Mensais',
                    data: monthlySalesData,
                    borderColor: '#008000',
                    backgroundColor: 'rgba(0, 128, 0, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

function updateReportSummary(date) {
    let totalSales = 0;
    let totalRevenue = 0;
    let topProduct = '-';
    let topProductQty = 0;
    
    inventory.forEach(p => {
        const monthSales = getFilteredSales(p, date);
        const qty = monthSales.reduce((sum, s) => sum + Number(s.quantity || s.quantidade || 0), 0);
        totalSales += qty;
        totalRevenue += monthSales.reduce((sum, s) => {
            const quantity = Number(s.quantity || s.quantidade || 0);
            const originalTotal = Number(s.totalOriginal ?? ((p.price || 0) * quantity));
            const discountedTotal = Number(s.totalWithDiscount ?? originalTotal);
            return sum + (Number.isFinite(discountedTotal) ? discountedTotal : originalTotal);
        }, 0);
        
        if (qty > topProductQty) {
            topProductQty = qty;
            topProduct = p.name;
        }
    });
    
    const totalProfit = inventory.reduce((sum, p) => sum + getFilteredSales(p, date).reduce((inner, s) => {
        const q = Number(s.quantity || s.quantidade || 0);
        const revenue = Number(s.totalWithDiscount ?? s.totalComDesconto ?? ((p.price || 0) * q));
        return inner + revenue - (Number(p.cost || 0) * q);
    }, 0), 0);
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
    const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    
    const tsEl = document.getElementById('report-total-sales');
    const trEl = document.getElementById('report-total-revenue');
    const tpEl = document.getElementById('report-top-product');
    const atEl = document.getElementById('report-avg-ticket');
    const profitEl = document.getElementById('report-total-profit');
    const marginEl = document.getElementById('report-profit-margin');
    
    if (tsEl) tsEl.innerText = totalSales;
    if (trEl) trEl.innerText = `R$ ${totalRevenue.toFixed(2)}`;
    if (tpEl) tpEl.innerText = topProduct;
    if (atEl) atEl.innerText = formatMoney(avgTicket);
    if (profitEl) profitEl.innerText = formatMoney(totalProfit);
    if (marginEl) marginEl.innerText = `${margin.toFixed(1)}%`;
}

function csvEscape(value) {
    return `"${String(value ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
}

function getSaleTotals(product, sale) {
    const quantity = Number(sale.quantity || sale.quantidade || 0);
    const unitPrice = Number(product.price || 0);
    const originalTotal = Number(sale.totalOriginal ?? (unitPrice * quantity));
    const discount = Number(sale.discount ?? sale.desconto ?? 0);
    const totalWithDiscount = Number(sale.totalWithDiscount ?? sale.totalComDesconto ?? (originalTotal * (1 - discount / 100)));

    return {
        quantity,
        unitPrice,
        originalTotal: Number.isFinite(originalTotal) ? originalTotal : 0,
        discount: Number.isFinite(discount) ? discount : 0,
        totalWithDiscount: Number.isFinite(totalWithDiscount) ? totalWithDiscount : 0
    };
}

if (btnExportReport) {
    btnExportReport.addEventListener('click', () => {
        if (!reportMonth || !reportMonth.value) {
            showToast('Selecione o mês do relatório.');
            return;
        }

        const selectedDate = getSelectedMonthDate();
        if (!selectedDate) {
            showToast('Selecione um mês válido para exportar o relatório.');
            return;
        }
        const headers = [
            'Data', 'Horário', 'Produto', 'Vendedor', 'Categoria', 'Preço Unitário',
            'Quantidade', 'Total Original', 'Desconto (%)', 'Total com Desconto', 'Descrição / Observação'
        ];
        const rows = [
            'sep=;',
            headers.map(csvEscape).join(';')
        ];

        inventory.forEach(product => {
            getProductSales(product).forEach(sale => {
                if (!isSaleInMonth(sale, selectedDate)) return;

                const totals = getSaleTotals(product, sale);
                rows.push([
                    sale.date || sale.data || sale.saleDate || sale.dataVenda || '',
                    sale.time || sale.hora || '',
                    product.name,
                    sale.seller || sale.vendedor || 'N/A',
                    sale.customer || sale.cliente || '',
                    sale.payment || sale.pagamento || 'Não informado',
                    product.category || '',
                    totals.unitPrice.toFixed(2),
                    totals.quantity,
                    totals.originalTotal.toFixed(2),
                    totals.discount.toFixed(2),
                    totals.totalWithDiscount.toFixed(2),
                    sale.description || sale.observacao || sale.observation || ''
                ].map(csvEscape).join(';'));
            });
        });

        if (rows.length === 2) {
            showToast(`Nenhuma venda encontrada para ${reportMonth.value}. Verifique o mês selecionado e a data cadastrada na venda.`);
            return;
        }

        const blob = new Blob(["\uFEFF" + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `relatorio_${currentInventoryType}_${reportMonth.value}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    });
}

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = link.getAttribute('href');
        if (!target || target === '#') return;
        
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        document.querySelectorAll('.section-content').forEach(s => s.style.display = 'none');
        const targetSection = document.querySelector(target);
        if (targetSection) {
            targetSection.style.display = 'block';
            if (target === '#relatorio') { populateReportFilters(); updateReportCharts(); renderMonthlySalesHistory(); }
            if (target === '#lixeira') loadTrash();
        }
    });
});

closeModals.forEach(c => c.onclick = () => { 
    if (modal) modal.style.display = 'none'; 
    if (salesModal) salesModal.style.display = 'none'; 
    if (resetPasswordModal) resetPasswordModal.style.display = 'none';
    if (quickSaleModal) quickSaleModal.style.display = 'none';
});

window.onclick = (e) => { 
    if (e.target == modal || e.target == salesModal || e.target == resetPasswordModal || e.target == quickSaleModal) { 
        if (modal) modal.style.display = 'none'; 
        if (salesModal) salesModal.style.display = 'none'; 
        if (resetPasswordModal) resetPasswordModal.style.display = 'none';
        if (quickSaleModal) quickSaleModal.style.display = 'none';
    } 
};

if (btnAddProduct) {
    btnAddProduct.onclick = () => { 
        if (modalTitle) modalTitle.innerText = 'Novo Produto';
        if (productForm) productForm.reset();
        const costInput = document.getElementById('cost');
        if (costInput) costInput.value = '0';
        const sizeGroup = document.getElementById('size-group');
        if (sizeGroup) sizeGroup.style.display = 'none';
        const idInput = document.getElementById('product-id');
        if (idInput) idInput.value = ''; 
        if (modal) modal.style.display = 'block'; 
    };
}


    if (reportMonth) reportMonth.onchange = () => { updateReportCharts(); renderMonthlySalesHistory(); };

    // Lógica para mostrar/esconder campo de tamanho
    const categorySelect = document.getElementById('category');
    const sizeGroup = document.getElementById('size-group');
    if (categorySelect && sizeGroup) {
        categorySelect.addEventListener('change', () => {
            if (categorySelect.value === 'Vestuário') {
                sizeGroup.style.display = 'block';
            } else {
                sizeGroup.style.display = 'none';
                document.getElementById('size').value = '';
            }
        });
    }


const backupButton = document.getElementById('btn-backup');
const restoreButton = document.getElementById('btn-restore');
const restoreFile = document.getElementById('restore-file');
if (backupButton) backupButton.addEventListener('click', backupInventory);
if (restoreButton && restoreFile) restoreButton.addEventListener('click', () => restoreFile.click());
if (restoreFile) restoreFile.addEventListener('change', e => restoreInventory(e.target.files[0]));



function openQuickSale() {
    if (!quickSaleModal) return; const select = document.getElementById('quick-sale-product');
    select.innerHTML = inventory.filter(p => Number(p.quantity) > 0).map(p => `<option value="${p.id}">${p.name} — ${p.quantity} disponíveis</option>`).join('');
    quickSaleModal.style.display = 'block';
}

const quickSaleClose = document.getElementById('quick-sale-close');
if (quickSaleClose) quickSaleClose.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (quickSaleModal) { quickSaleModal.style.display = 'none'; quickSaleModal.classList.remove('show'); }
});
if (document.getElementById('btn-quick-sale')) document.getElementById('btn-quick-sale').onclick = e => { e.preventDefault(); openQuickSale(); };
if (quickSaleForm) quickSaleForm.addEventListener('submit', async e => {
    e.preventDefault(); const id=document.getElementById('quick-sale-product').value, q=Number(document.getElementById('quick-sale-quantity').value); const product=inventory.find(p=>p.id===id);
    if (!product || q<1 || product.quantity<q) return showToast('Quantidade indisponível para este produto.', 'error');
    const sale={date:new Date().toISOString().slice(0,10),time:new Date().toTimeString().slice(0,5),quantity:q,seller:currentUser?.username||'usuário',customer:document.getElementById('quick-sale-customer').value.trim(),payment:document.getElementById('quick-sale-payment').value,totalOriginal:(product.price||0)*q,totalWithDiscount:(product.price||0)*q,discount:0};
    try { await db.collection(`inventory_${currentInventoryType}`).doc(id).update({quantity:Number(product.quantity)-q,sales:[...getProductSales(product),sale],updatedAt:firebase.firestore.FieldValue.serverTimestamp()}); await logActivity('venda_rapida',product.name,{quantity:q}); quickSaleModal.style.display='none'; quickSaleForm.reset(); showToast('Venda rápida registrada.', 'success'); } catch(err) { showToast('Erro ao registrar venda: '+err.message,'error'); }
});


function loadTrash() {
    const body = document.getElementById('trash-body');
    if (!body || !currentInventoryType || currentUser?.role !== 'admin') return;
    db.collection(`trash_${currentInventoryType}`).orderBy('deletedAt', 'desc').limit(100).get().then(snapshot => {
        if (snapshot.empty) { body.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum item na lixeira.</td></tr>'; return; }
        body.innerHTML = snapshot.docs.map(doc => { const item=doc.data(); const name=item.type==='product'?(item.product?.name||'Produto'):(item.productName||'Venda'); const date=item.deletedAt?.toDate ? item.deletedAt.toDate().toLocaleString('pt-BR') : 'agora'; return `<tr><td>${item.type==='product'?'Produto':'Venda'}</td><td>${name}</td><td>${item.deletedBy||'admin'}</td><td>${date}</td><td><button class="btn-restore-trash" onclick="restoreTrashItem('${doc.id}')"><i class="fas fa-undo"></i> Restaurar</button></td></tr>`; }).join('');
    }).catch(err => showToast('Não foi possível carregar a lixeira: '+err.message, 'error'));
}

window.restoreTrashItem = async (trashId) => {
    if (currentUser?.role !== 'admin') return showToast('Apenas administradores podem restaurar itens.', 'error');
    try {
        const ref=db.collection(`trash_${currentInventoryType}`).doc(trashId), snap=await ref.get(); if(!snap.exists) throw new Error('Item não encontrado.'); const item=snap.data();
        if(item.type==='product') await db.collection(`inventory_${currentInventoryType}`).doc(item.productId).set(item.product);
        else { const productRef=db.collection(`inventory_${currentInventoryType}`).doc(item.productId), productSnap=await productRef.get(); if(!productSnap.exists) throw new Error('Produto da venda não encontrado.'); const product=productSnap.data(); await productRef.update({sales:[...getProductSales(product),item.sale],quantity:Number(product.quantity||0)-Number(item.sale.quantity||item.sale.quantidade||0)}); }
        await ref.delete(); await logActivity('item_restaurado', item.type==='product'?(item.product?.name||'Produto'):(item.productName||'Venda')); loadTrash(); showToast('Item restaurado com sucesso.', 'success');
    } catch(err) { showToast('Erro ao restaurar: '+err.message, 'error'); }
};

[reportSeller, reportPayment, reportCustomer].forEach(el => { if (el) el.addEventListener('input', () => { updateReportCharts(); renderMonthlySalesHistory(); }); });
const imageUrlInput=document.getElementById('image-url'), imagePreview=document.getElementById('product-image-preview');
if(imageUrlInput) imageUrlInput.addEventListener('input', () => { if(imagePreview){ imagePreview.src=imageUrlInput.value; imagePreview.style.display=imageUrlInput.value?'block':'none'; } });
