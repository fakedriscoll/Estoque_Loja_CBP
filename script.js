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

const selectionScreen = document.getElementById('selection-screen');
const managementScreen = document.getElementById('management-screen');
const inventoryBody = document.getElementById('inventory-body');
const totalItemsEl = document.getElementById('total-items');
const totalValueEl = document.getElementById('total-value');
const lowStockCountEl = document.getElementById('low-stock-count');
const totalSalesEl = document.getElementById('total-sales');
const priorityRestockCountEl = document.getElementById('priority-restock-count');
const restockListEl = document.getElementById('restock-list');
const btnRefreshRestock = document.getElementById('btn-refresh-restock');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const brandFilter = document.getElementById('brand-filter');
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
                if (username === 'admin' && password === 'admin123') {
                    try {
                        await auth.createUserWithEmailAndPassword(email, password);
                    } catch (err) {}
                }

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
                    alert('Erro ao carregar dados do usuário.');
                    auth.signOut();
                    return;
                }

                if (userData.status === 'pending') {
                    alert('Sua conta ainda está pendente de aprovação.');
                    auth.signOut();
                } else if (userData.status === 'rejected') {
                    alert('Sua solicitação foi recusada.');
                    auth.signOut();
                } else {
                    currentUser = { ...userData, uid: user.uid };
                    handleLoginSuccess();
                }
            } catch (error) {
                alert('Erro ao entrar: ' + error.message);
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
                alert("A senha deve ter pelo menos 6 caracteres!");
                return;
            }
            
            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                await db.collection('users').doc(user.uid).set({
                    username: username,
                    password: password,
                    role: 'user',
                    status: 'pending',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                alert('Solicitação enviada! Aguarde a aprovação do administrador.');
                auth.signOut();
                if (showLogin) showLogin.click();
            } catch (error) {
                alert('Erro ao registrar: ' + error.message);
            }
        });
    }

    if (btnLogout) btnLogout.addEventListener('click', () => auth.signOut());
    if (btnLogoutAdmin) btnLogoutAdmin.addEventListener('click', () => auth.signOut());
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
    db.collection('users').onSnapshot(snapshot => {
        const requestsBody = document.getElementById('users-requests-body');
        if (!requestsBody) return;
        requestsBody.innerHTML = '';
        snapshot.forEach(doc => {
            const user = doc.data();
            if (user.role !== 'admin') {
                const row = document.createElement('tr');
                const userPassword = user.password || '***';
                const userBrand = user.allowedBrand || 'Todas';
                row.innerHTML = `
                    <td>${user.username}</td>
                    <td><span class="password-display">${userPassword}</span></td>
                    <td><span class="status-badge status-${user.status}">${user.status}</span> <br> <small>Marca: ${userBrand}</small></td>
                    <td>
                        <button class="btn-reset-password edit-user-btn" data-id="${doc.id}" data-username="${user.username}" data-brand="${user.allowedBrand || ''}"><i class="fas fa-key"></i> Editar</button>
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
                openResetPasswordModal(uid, username, brand);
            };
        });
    });
}

window.updateUserStatus = (uid, status) => {
    db.collection('users').doc(uid).update({ status: status });
};

window.deleteUser = (uid) => {
    if (confirm('Tem certeza que deseja excluir este usuário?')) {
        db.collection('users').doc(uid).delete();
    }
};

window.openResetPasswordModal = (uid, username, brand) => {
    const idInput = document.getElementById('reset-user-id');
    const nameInput = document.getElementById('edit-username');
    const brandInput = document.getElementById('edit-brand');
    if (idInput) idInput.value = uid;
    if (nameInput) nameInput.value = username;
    if (brandInput) brandInput.value = brand || '';
    if (resetPasswordModal) resetPasswordModal.style.display = 'block';
};

function setupResetPasswordListener() {
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const uid = document.getElementById('reset-user-id').value;
            const newUsername = document.getElementById('edit-username').value.trim();
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (newPassword && newPassword !== confirmPassword) {
                alert('As senhas não coincidem!');
                return;
            }

            try {
                const updateData = { 
                    username: newUsername,
                    allowedBrand: document.getElementById('edit-brand').value
                };
                if (newPassword) updateData.password = newPassword;
                
                await db.collection('users').doc(uid).update(updateData);
                alert('Usuário atualizado com sucesso!');
                if (resetPasswordModal) resetPasswordModal.style.display = 'none';
                resetPasswordForm.reset();
            } catch (error) {
                alert('Erro ao atualizar usuário: ' + error.message);
            }
        });
    }
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
    setCurrentMonth();
};

if (btnBackSelection) {
    btnBackSelection.onclick = () => {
        managementScreen.style.display = 'none';
        selectionScreen.style.display = 'flex';
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
    db.collection(`inventory_${currentInventoryType}`).onSnapshot(snapshot => {
        inventory = [];
        snapshot.forEach(doc => {
            inventory.push({ id: doc.id, ...doc.data() });
        });
        updateInventoryTable();
        updateRestockSuggestions();

        if (document.getElementById('relatorio').style.display !== 'none') {
            updateReportCharts();
        }
    });
}

function updateInventoryTable() {
    if (!inventoryBody) return;
    
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const category = categoryFilter ? categoryFilter.value : '';
    const brand = brandFilter ? brandFilter.value : '';
    
    const filtered = inventory.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm) || 
                            item.category.toLowerCase().includes(searchTerm);
        const matchesCategory = category === '' || item.category === category;
        
        // Restrição de Marca para Usuários
        let matchesBrand = brand === '' || item.brand === brand;
        if (currentUser && currentUser.role !== 'admin' && currentUser.allowedBrand) {
            matchesBrand = item.brand === currentUser.allowedBrand;
        }
        
        return matchesSearch && matchesCategory && matchesBrand;
    });

    // Ordenação alfabética pelo nome
    filtered.sort((a, b) => a.name.localeCompare(b.name));
    
    renderInventory(filtered);
    updateStats(filtered);
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
                <div style="font-weight: 600;">${item.name}${item.size ? ` (${item.size})` : ''}</div>
                <div style="font-size: 0.75rem; color: #666;">${item.brand || 'Sem Marca'}</div>
            </td>
            <td>${item.category}</td>
            <td>R$ ${(item.price || 0).toFixed(2)}</td>
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
}

function updateRestockSuggestions() {
    if (!restockListEl || !priorityRestockCountEl) return;

    const now = new Date();

    const restockItems = inventory.map(item => {
        const minQty = item.minQuantity || 5;
        const currentQty = item.quantity || 0;

        const monthlySales = item.sales ? item.sales.filter(s => {
            const d = new Date(s.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).reduce((sum, s) => sum + s.quantity, 0) : 0;

        let urgencyScore = 0;
        let urgencyLabel = 'Acompanhar';
        let urgencyClass = 'monitor';

        if (currentQty <= minQty) urgencyScore += 5;
        if (currentQty <= 0) urgencyScore += 5;
        if (monthlySales >= 5) urgencyScore += 3;
        if (monthlySales >= 10) urgencyScore += 2;
        if (currentQty <= Math.ceil(minQty / 2)) urgencyScore += 2;

        if (urgencyScore >= 9) {
            urgencyLabel = 'Repor urgente';
            urgencyClass = 'urgent';
        } else if (urgencyScore >= 6) {
            urgencyLabel = 'Atenção';
            urgencyClass = 'attention';
        } else if (urgencyScore >= 4) {
            urgencyLabel = 'Acompanhar';
            urgencyClass = 'monitor';
        } else {
            urgencyLabel = 'Estável';
            urgencyClass = 'stable';
        }

        return {
            ...item,
            monthlySales,
            urgencyScore,
            urgencyLabel,
            urgencyClass
        };
    })
    .filter(item => item.urgencyScore >= 4)
    .sort((a, b) => b.urgencyScore - a.urgencyScore || a.quantity - b.quantity);

    priorityRestockCountEl.innerText = restockItems.length;

    if (restockItems.length === 0) {
        restockListEl.innerHTML = `
            <p class="empty-restock">Nenhum produto precisa de atenção no momento.</p>
        `;
        return;
    }

    restockListEl.innerHTML = '';

    restockItems.slice(0, 8).forEach(item => {
        const div = document.createElement('div');
        div.className = `restock-item ${item.urgencyClass}`;

        div.innerHTML = `
            <div class="restock-info">
                <h4>${item.name}${item.size ? ` (${item.size})` : ''}</h4>
                <p>${item.category} • ${item.brand || 'Sem Marca'}</p>
            </div>
            <div class="restock-meta">
                <span class="restock-stock">Estoque: <strong>${item.quantity}</strong></span>
                <span class="restock-min">Mínimo: <strong>${item.minQuantity || 5}</strong></span>
                <span class="restock-sales">Vendas mês: <strong>${item.monthlySales}</strong></span>
                <span class="restock-badge ${item.urgencyClass}">${item.urgencyLabel}</span>
            </div>
        `;

        restockListEl.appendChild(div);
    });
}

// ===== BUSCA E FILTRO =====
function setupSearchAndFilter() {
    if (searchInput) searchInput.addEventListener('input', updateInventoryTable);
    if (categoryFilter) categoryFilter.addEventListener('change', updateInventoryTable);
    if (brandFilter) brandFilter.addEventListener('change', updateInventoryTable);
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
                price: parseFloat(document.getElementById('price').value),
                quantity: parseInt(document.getElementById('quantity').value),
                minQuantity: parseInt(document.getElementById('min-quantity').value),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

        try {
            if (id) {
                await db.collection(`inventory_${currentInventoryType}`).doc(id).update(productData);
                alert('Produto atualizado com sucesso!');
            } else {
                productData.sales = [];
                await db.collection(`inventory_${currentInventoryType}`).add(productData);
                alert('Produto adicionado com sucesso!');
            }
            if (modal) modal.style.display = 'none';
            productForm.reset();
        } catch (error) {
            alert('Erro ao salvar produto: ' + error.message);
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
        const brand = document.getElementById('sale-brand').value;
        const seller = document.getElementById('sale-seller').value;
        
        try {
            const productRef = db.collection(`inventory_${currentInventoryType}`).doc(productId);
            const doc = await productRef.get();
            const product = doc.data();
            
            if (product.quantity < quantity) {
                alert('Quantidade insuficiente em estoque!');
                return;
            }
            
            const newSales = product.sales || [];
            newSales.push({ date, time, quantity, seller, brand });
            
            await productRef.update({
                quantity: product.quantity - quantity,
                sales: newSales
            });
            
            updateInventoryTable();
            
            alert('Venda registrada com sucesso!');
            if (salesModal) salesModal.style.display = 'none';
            salesForm.reset();
            
            if (document.getElementById('relatorio').style.display !== 'none') {
                updateReportCharts();
            }
        } catch (error) {
            alert('Erro ao registrar venda: ' + error.message);
        }
    });
}

window.deleteProduct = (id) => {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
        db.collection(`inventory_${currentInventoryType}`).doc(id).delete()
            .then(() => alert('Produto deletado com sucesso!'))
            .catch(error => alert('Erro ao deletar: ' + error.message));
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
    
    if (idInput) idInput.value = item.id;
    if (nameInput) nameInput.value = item.name;
    if (catInput) catInput.value = item.category;
    if (brandInput) brandInput.value = item.brand || '';
    
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
    const brandInput = document.getElementById('sale-brand');
    
    if (idInput) idInput.value = id;
    if (nameDisplay) nameDisplay.innerText = product.name;
    if (qtyInput) qtyInput.value = '';
    
    const now = new Date();
    if (dateInput) dateInput.valueAsDate = now;
    
    if (timeInput) {
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        timeInput.value = `${hours}:${minutes}`;
    }
    
    if (brandInput) brandInput.value = product.brand || '';
    
    if (salesModal) salesModal.style.display = 'block';
};

// ===== RELATÓRIOS E EXPORTAÇÃO =====
let salesByProductChart, monthlySalesChart;

function setCurrentMonth() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    if (reportMonth) reportMonth.value = `${year}-${month}`;
}

function updateReportCharts() {
    if (!reportMonth || !reportMonth.value) return;
    const selectedDate = new Date(reportMonth.value + '-01');
    const productNames = inventory.map(p => p.name);
    const productSales = inventory.map(p => {
        if (!p.sales) return 0;
        return p.sales.filter(s => {
            const d = new Date(s.date);
            return d.getFullYear() === selectedDate.getFullYear() && d.getMonth() === selectedDate.getMonth();
        }).reduce((sum, s) => sum + s.quantity, 0);
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
            if (p.sales) {
                totalSales += p.sales.filter(s => {
                    const saleDate = new Date(s.date);
                    return saleDate.getFullYear() === date.getFullYear() && 
                           saleDate.getMonth() === date.getMonth();
                }).reduce((sum, s) => sum + s.quantity, 0);
            }
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
        if (!p.sales) return;
        const monthSales = p.sales.filter(s => {
            const d = new Date(s.date);
            return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth();
        });
        const qty = monthSales.reduce((sum, s) => sum + s.quantity, 0);
        totalSales += qty;
        totalRevenue += qty * (p.price || 0);
        
        if (qty > topProductQty) {
            topProductQty = qty;
            topProduct = p.name;
        }
    });
    
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
    
    const tsEl = document.getElementById('report-total-sales');
    const trEl = document.getElementById('report-total-revenue');
    const tpEl = document.getElementById('report-top-product');
    const atEl = document.getElementById('report-avg-ticket');
    
    if (tsEl) tsEl.innerText = totalSales;
    if (trEl) trEl.innerText = `R$ ${totalRevenue.toFixed(2)}`;
    if (tpEl) tpEl.innerText = topProduct;
    if (atEl) atEl.innerText = `R$ ${avgTicket.toFixed(2)}`;
}

        if (btnExportReport) {
    btnExportReport.addEventListener('click', () => {
        const selectedDate = new Date(reportMonth.value + '-01');
        let csvContent = "sep=,\nData,Horário,Produto,Marca,Vendedor,Categoria,Preço,Quantidade,Faturamento\n";
        inventory.forEach(p => {
            if (p.sales) {
                p.sales.forEach(s => {
                    const d = new Date(s.date);
                    if (d.getFullYear() === selectedDate.getFullYear() && d.getMonth() === selectedDate.getMonth()) {
                        const seller = s.seller || "N/A";
                        const time = s.time || "--:--";
                        const brand = s.brand || "N/A";
                        csvContent += `${s.date},${time},"${p.name}","${brand}","${seller}",${p.category},${(p.price || 0).toFixed(2)},${s.quantity},${(s.quantity * (p.price || 0)).toFixed(2)}\n`;
                    }
                });
            }
        });
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio_${currentInventoryType}_${reportMonth.value}.csv`;
        a.click();
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
            if (target === '#relatorio') updateReportCharts();
        }
    });
});

closeModals.forEach(c => c.onclick = () => { 
    if (modal) modal.style.display = 'none'; 
    if (salesModal) salesModal.style.display = 'none'; 
    if (resetPasswordModal) resetPasswordModal.style.display = 'none';
});

window.onclick = (e) => { 
    if (e.target == modal || e.target == salesModal || e.target == resetPasswordModal) { 
        if (modal) modal.style.display = 'none'; 
        if (salesModal) salesModal.style.display = 'none'; 
        if (resetPasswordModal) resetPasswordModal.style.display = 'none';
    } 
};

if (btnAddProduct) {
    btnAddProduct.onclick = () => { 
        if (modalTitle) modalTitle.innerText = 'Novo Produto';
        if (productForm) productForm.reset(); 
        const sizeGroup = document.getElementById('size-group');
        if (sizeGroup) sizeGroup.style.display = 'none';
        const idInput = document.getElementById('product-id');
        if (idInput) idInput.value = ''; 
        if (modal) modal.style.display = 'block'; 
    };
}

// 👇 COLE AQUI
if (btnRefreshRestock) {
    btnRefreshRestock.addEventListener('click', updateRestockSuggestions);
}


if (reportMonth) reportMonth.onchange = updateReportCharts;

    if (reportMonth) reportMonth.onchange = updateReportCharts;

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
// ===== AGENTE DE IA INTEGRADO =====
const aiChatToggle = document.getElementById('ai-chat-toggle');
const aiChatContainer = document.getElementById('ai-chat-container');
const aiChatClose = document.getElementById('ai-chat-close');
const aiChatMessages = document.getElementById('ai-chat-messages');
const aiUserInput = document.getElementById('ai-user-input');
const aiSendBtn = document.getElementById('ai-send-btn');

if (aiChatToggle) {
    aiChatToggle.addEventListener('click', () => {
        aiChatContainer.style.display = aiChatContainer.style.display === 'none' ? 'flex' : 'none';
    });
}

if (aiChatClose) {
    aiChatClose.addEventListener('click', () => {
        aiChatContainer.style.display = 'none';
    });
}

async function handleAiMessage() {
    const text = aiUserInput.value.trim();
    if (!text) return;

    // Adiciona mensagem do usuário
    appendMessage('user', text);
    aiUserInput.value = '';

    // Simula processamento da IA
    const typingMsg = appendMessage('ai', 'Pensando...');
    
    setTimeout(() => {
        typingMsg.remove();
        const response = generateAiResponse(text);
        appendMessage('ai', response);
    }, 1000);
}

function appendMessage(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}-message`;
    msgDiv.innerText = text;
    aiChatMessages.appendChild(msgDiv);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
    return msgDiv;
}

function generateAiResponse(input) {
    const query = input.toLowerCase();
    
    // Dados para a IA analisar
    const lowStock = inventory.filter(p => p.quantity <= p.minQuantity);
    const totalValue = inventory.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    
    if (query.includes('promoção') || query.includes('promocao') || query.includes('vender')) {
        if (inventory.length === 0) return "Ainda não carreguei o estoque. Selecione um estoque primeiro!";
        
        const highStock = [...inventory].sort((a, b) => b.quantity - a.quantity).slice(0, 2);
        return `Sugestão de Promoção: Notei que você tem bastante estoque de "${highStock[0].name}" (${highStock[0].quantity} unidades). Que tal um desconto de 15% para movimentar esse item?`;
    }
    
    if (query.includes('estoque') || query.includes('repor')) {
        if (lowStock.length > 0) {
            return `Atenção! Você tem ${lowStock.length} produtos com estoque baixo. Recomendo repor urgentemente o item "${lowStock[0].name}".`;
        }
        return "O estoque parece saudável no momento! Todos os itens estão acima da quantidade mínima.";
    }

    if (query.includes('olá') || query.includes('oi')) {
        return "Olá! Sou o assistente da PCKL. Posso analisar seu estoque e sugerir promoções. O que deseja saber?";
    }

    return "Interessante! Posso te ajudar a analisar quais produtos estão parados ou sugerir uma estratégia de vendas baseada no seu estoque atual. Tente perguntar sobre 'promoções' ou 'estoque baixo'.";
}

if (aiSendBtn) aiSendBtn.addEventListener('click', handleAiMessage);
if (aiUserInput) {
    aiUserInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAiMessage();
    });
}
