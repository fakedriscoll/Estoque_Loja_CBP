// ===== CONFIGURAÇÃO DO FIREBASE =====
// COLOQUE SUAS CHAVES AQUI:
const firebaseConfig = {
  apiKey: "AIzaSyAVL1-2YEdZNYCwR5siLM0zZpdHGVlg0jc",
  authDomain: "cbp-estoque.firebaseapp.com",
  projectId: "cbp-estoque",
  storageBucket: "cbp-estoque.firebasestorage.app",
  messagingSenderId: "770580270100",
  appId: "1:770580270100:web:7f298f139c8a5d3e5ceb01"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Variáveis globais
let inventory = [];
let currentInventoryType = null;
let currentUser = null;

// Elementos do DOM
const selectionScreen = document.getElementById('selection-screen');
const managementScreen = document.getElementById('management-screen');
const inventoryBody = document.getElementById('inventory-body');
const totalItemsEl = document.getElementById('total-items');
const totalValueEl = document.getElementById('total-value');
const lowStockCountEl = document.getElementById('low-stock-count');
const totalSalesEl = document.getElementById('total-sales');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const btnAddProduct = document.getElementById('btn-add-product');
const btnBackSelection = document.getElementById('btn-back-selection');
const modal = document.getElementById('product-modal');
const salesModal = document.getElementById('sales-modal');
const closeModals = document.querySelectorAll('.close');
const productForm = document.getElementById('product-form');
const salesForm = document.getElementById('sales-form');
const modalTitle = document.getElementById('modal-title');
const reportMonth = document.getElementById('report-month');
const btnExportReport = document.getElementById('btn-export-report');
const currentInventoryName = document.getElementById('current-inventory-name');

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    setupAuthListeners();
    checkAuthState();
    setupFilters(); // Adicionado: Configura os filtros de busca e categoria
});

// ===== AUTENTICAÇÃO =====
function setupAuthListeners() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegister = document.getElementById('show-register');
    const showLogin = document.getElementById('show-login');
    const btnLogout = document.getElementById('btn-logout');
    const btnLogoutAdmin = document.getElementById('btn-logout-admin');

    showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form-container').style.display = 'none';
        document.getElementById('register-form-container').style.display = 'block';
    });

    showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form-container').style.display = 'block';
        document.getElementById('register-form-container').style.display = 'none';
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const email = username + "@cbp.com";
        const password = document.getElementById('login-password').value;
        
        console.log("Tentando login para:", email);
        
        try {
            if (username === 'admin' && password === 'admin123') {
                console.log("Verificando conta admin...");
                try {
                    await auth.createUserWithEmailAndPassword(email, password);
                    console.log("Conta admin criada no Auth pela primeira vez.");
                } catch (err) {
                    console.log("Conta admin já existe no Auth ou erro menor:", err.code);
                }
            }

            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            console.log("Login no Auth realizado com sucesso. UID:", user.uid);
            
            let userDoc = await db.collection('users').doc(user.uid).get();
            
            if (!userDoc.exists && username === 'admin') {
                console.log("Criando documento admin no Firestore...");
                await db.collection('users').doc(user.uid).set({
                    username: 'admin',
                    role: 'admin',
                    status: 'approved'
                });
                userDoc = await db.collection('users').doc(user.uid).get();
            }

            const userData = userDoc.data();

            if (!userData) {
                console.error("Documento do usuário não encontrado no Firestore.");
                alert('Erro ao carregar dados do usuário no banco de dados.');
                auth.signOut();
                return;
            }

            console.log("Dados do usuário carregados:", userData);

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
            console.error("Erro no processo de login:", error);
            alert('Erro ao entrar: ' + error.message);
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('reg-username').value.trim();
        const email = username + "@cbp.com";
        const password = document.getElementById('reg-password').value;
        
        if (password.length < 6) {
            alert("A senha deve ter pelo menos 6 caracteres!");
            return;
        }
        
        console.log("Tentando registrar novo usuário:", email);
        
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            console.log("Usuário criado no Auth. UID:", user.uid);

            console.log("Salvando dados no Firestore...");
            await db.collection('users').doc(user.uid).set({
                username: username,
                role: 'user',
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("Dados salvos no Firestore com sucesso.");

            alert('Solicitação enviada! Aguarde a aprovação do administrador.');
            auth.signOut();
            showLogin.click();
        } catch (error) {
            console.error("Erro ao registrar:", error);
            alert('Erro ao registrar: ' + error.message);
        }
    });

    btnLogout.addEventListener('click', () => auth.signOut());
    btnLogoutAdmin.addEventListener('click', () => auth.signOut());
}

function checkAuthState() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                currentUser = { ...userDoc.data(), uid: user.uid };
                handleLoginSuccess();
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
        requestsBody.innerHTML = '';
        snapshot.forEach(doc => {
            const user = doc.data();
            if (user.role !== 'admin') {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.username}</td>
                    <td><span class="status-badge ${user.status === 'approved' ? 'status-ok' : (user.status === 'pending' ? 'status-low' : 'status-empty')}">${user.status}</span></td>
                    <td>
                        ${user.status === 'pending' ? `
                            <button class="btn-approve" onclick="updateUserStatus('${doc.id}', 'approved')">Aceitar</button>
                            <button class="btn-reject" onclick="updateUserStatus('${doc.id}', 'rejected')">Recusar</button>
                        ` : `
                            <button class="btn-delete" onclick="deleteUser('${doc.id}')"><i class="fas fa-trash-alt"></i></button>
                        `}
                    </td>
                `;
                requestsBody.appendChild(row);
            }
        });
    });
}

window.updateUserStatus = (uid, status) => {
    db.collection('users').doc(uid).update({ status: status });
};

window.deleteUser = (uid) => {
    if (confirm('Deseja excluir este usuário?')) {
        db.collection('users').doc(uid).delete();
    }
};

// ===== GESTÃO DE ESTOQUE (FIRESTORE) =====
async function updateSelectionCounts() {
    const lojaSnap = await db.collection('inventory_loja').get();
    const vitrineSnap = await db.collection('inventory_vitrine').get();
    
    document.getElementById('loja-count').innerText = `${lojaSnap.size} produtos`;
    document.getElementById('vitrine-count').innerText = `${vitrineSnap.size} produtos`;
}

window.selectInventory = (type) => {
    currentInventoryType = type;
    currentInventoryName.innerText = type === 'loja' ? 'LOJA OFICIAL' : 'VITRINE';
    
    selectionScreen.style.display = 'none';
    managementScreen.style.display = 'flex';
    
    // Configura o mês atual apenas uma vez ao selecionar o estoque
    setCurrentMonth();

    // Escutar mudanças em tempo real
    db.collection(`inventory_${type}`).onSnapshot(snapshot => {
        inventory = [];
        snapshot.forEach(doc => {
            inventory.push({ id: doc.id, ...doc.data() });
        });
        
        // Aplica filtros atuais ao renderizar após mudança no banco
        filterInventory();
        updateStats();
        
        // Se o relatório estiver visível, atualiza os gráficos automaticamente
        const reportSection = document.getElementById('relatorio');
        if (reportSection && reportSection.style.display === 'block') {
            updateReportCharts();
        }
    });
};

btnBackSelection.addEventListener('click', (e) => {
    e.preventDefault();
    selectionScreen.style.display = 'flex';
    managementScreen.style.display = 'none';
    updateSelectionCounts();
});

// Funções de Filtro e Busca
function setupFilters() {
    searchInput.addEventListener('input', filterInventory);
    categoryFilter.addEventListener('change', filterInventory);
}

function filterInventory() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedCategory = categoryFilter.value;

    const filtered = inventory.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm) || 
                              item.category.toLowerCase().includes(searchTerm);
        const matchesCategory = selectedCategory === '' || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    renderInventory(filtered);
}

function renderInventory(items = inventory) {
    inventoryBody.innerHTML = '';
    items.forEach(item => {
        const status = getStatus(item.quantity, item.minQuantity);
        const monthlySales = getSalesForMonth(item);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${item.name}</strong></td>
            <td>${item.category}</td>
            <td>R$ ${item.price.toFixed(2)}</td>
            <td>${item.quantity}</td>
            <td>${monthlySales}</td>
            <td><span class="status-badge ${status.class}">${status.label}</span></td>
            <td>
                <button class="btn-sales" onclick="openSalesModal('${item.id}')"><i class="fas fa-shopping-cart"></i></button>
                <button class="btn-edit" onclick="editProduct('${item.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" onclick="deleteProduct('${item.id}')"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        inventoryBody.appendChild(row);
    });
}

function getStatus(qty, min) {
    if (qty <= 0) return { label: 'Esgotado', class: 'status-empty' };
    if (qty <= min) return { label: 'Baixo Estoque', class: 'status-low' };
    return { label: 'Disponível', class: 'status-ok' };
}

function getSalesForMonth(product) {
    if (!product.sales) return 0;
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    return product.sales.filter(sale => {
        const saleDate = new Date(sale.date);
        return saleDate.getFullYear() === year && saleDate.getMonth() === month;
    }).reduce((sum, sale) => sum + sale.quantity, 0);
}

function updateStats() {
    const totalItems = inventory.reduce((acc, item) => acc + item.quantity, 0);
    const totalValue = inventory.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const lowStock = inventory.filter(item => item.quantity <= item.minQuantity).length;
    const totalSales = inventory.reduce((acc, item) => acc + (item.sales ? item.sales.length : 0), 0);
    
    totalItemsEl.innerText = totalItems;
    totalValueEl.innerText = `R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    lowStockCountEl.innerText = lowStock;
    totalSalesEl.innerText = totalSales;
}

// ===== MODAIS E FORMULÁRIOS =====
productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('product-id').value;
    const productData = {
        name: document.getElementById('name').value,
        category: document.getElementById('category').value,
        price: parseFloat(document.getElementById('price').value),
        quantity: parseInt(document.getElementById('quantity').value),
        minQuantity: parseInt(document.getElementById('min-quantity').value)
    };

    if (id) {
        await db.collection(`inventory_${currentInventoryType}`).doc(id).update(productData);
    } else {
        productData.sales = [];
        await db.collection(`inventory_${currentInventoryType}`).add(productData);
    }
    modal.style.display = 'none';
});

salesForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const productId = document.getElementById('sale-product-id').value;
    const quantity = parseInt(document.getElementById('sale-quantity').value);
    const date = document.getElementById('sale-date').value;
    
    const productRef = db.collection(`inventory_${currentInventoryType}`).doc(productId);
    const doc = await productRef.get();
    const product = doc.data();
    
    const newSales = product.sales || [];
    newSales.push({ date, quantity });
    
    await productRef.update({
        quantity: product.quantity - quantity,
        sales: newSales
    });
    
    salesModal.style.display = 'none';
});

window.deleteProduct = (id) => {
    if (confirm('Excluir produto?')) {
        db.collection(`inventory_${currentInventoryType}`).doc(id).delete();
    }
};

window.editProduct = (id) => {
    const item = inventory.find(i => i.id === id);
    modalTitle.innerText = 'Editar Produto';
    document.getElementById('product-id').value = item.id;
    document.getElementById('name').value = item.name;
    document.getElementById('category').value = item.category;
    document.getElementById('price').value = item.price;
    document.getElementById('quantity').value = item.quantity;
    document.getElementById('min-quantity').value = item.minQuantity;
    modal.style.display = 'block';
};

window.openSalesModal = (id) => {
    const product = inventory.find(p => p.id === id);
    document.getElementById('sale-product-id').value = id;
    document.getElementById('sale-product-name').innerText = product.name;
    document.getElementById('sale-quantity').value = '';
    document.getElementById('sale-date').valueAsDate = new Date();
    salesModal.style.display = 'block';
};

// ===== RELATÓRIOS E EXPORTAÇÃO =====
let salesByProductChart;

function setCurrentMonth() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    // Só altera o valor se ele estiver vazio ou se for a primeira carga
    if (!reportMonth.value) {
        reportMonth.value = `${year}-${month}`;
    }
}

function updateReportCharts() {
    if (!reportMonth.value) return;
    
    const selectedDate = new Date(reportMonth.value + '-01');
    const productNames = inventory.map(p => p.name);
    const productSales = inventory.map(p => {
        if (!p.sales) return 0;
        return p.sales.filter(s => {
            const d = new Date(s.date);
            return d.getFullYear() === selectedDate.getFullYear() && d.getMonth() === selectedDate.getMonth();
        }).reduce((sum, s) => sum + s.quantity, 0);
    });

    const canvas = document.getElementById('salesByProductChart');
    if (!canvas) return;
    
    const ctx1 = canvas.getContext('2d');
    if (salesByProductChart) salesByProductChart.destroy();
    salesByProductChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: productNames,
            datasets: [{ label: 'Vendas', data: productSales, backgroundColor: '#003399' }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
    updateReportSummary(selectedDate);
}

function updateReportSummary(date) {
    let totalSales = 0;
    let totalRevenue = 0;
    inventory.forEach(p => {
        if (!p.sales) return;
        const monthSales = p.sales.filter(s => {
            const d = new Date(s.date);
            return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth();
        });
        const qty = monthSales.reduce((sum, s) => sum + s.quantity, 0);
        totalSales += qty;
        totalRevenue += qty * p.price;
    });
    document.getElementById('report-total-sales').innerText = totalSales;
    document.getElementById('report-total-revenue').innerText = `R$ ${totalRevenue.toFixed(2)}`;
}

btnExportReport.addEventListener('click', () => {
    const selectedDate = new Date(reportMonth.value + '-01');
    let csvContent = "sep=,\nProduto,Categoria,Preço,Vendas,Faturamento\n";
    inventory.forEach(p => {
        const qty = p.sales ? p.sales.filter(s => {
            const d = new Date(s.date);
            return d.getFullYear() === selectedDate.getFullYear() && d.getMonth() === selectedDate.getMonth();
        }).reduce((sum, s) => sum + s.quantity, 0) : 0;
        csvContent += `"${p.name}",${p.category},${p.price.toFixed(2)},${qty},${(qty * p.price).toFixed(2)}\n`;
    });
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_${currentInventoryType}_${reportMonth.value}.csv`;
    a.click();
});

// Navegação de abas
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = link.getAttribute('href');
        if (target === '#' || !target) return;
        
        document.querySelectorAll('.section-content').forEach(s => s.style.display = 'none');
        const targetSection = document.querySelector(target);
        if (targetSection) {
            targetSection.style.display = 'block';
            if (target === '#relatorio') updateReportCharts();
        }
    });
});

// Fechar modais
closeModals.forEach(c => c.onclick = () => { modal.style.display = 'none'; salesModal.style.display = 'none'; });
window.onclick = (e) => { if (e.target == modal || e.target == salesModal) { modal.style.display = 'none'; salesModal.style.display = 'none'; } };
btnAddProduct.onclick = () => { productForm.reset(); document.getElementById('product-id').value = ''; modalTitle.innerText = 'Novo Produto'; modal.style.display = 'block'; };
reportMonth.onchange = updateReportCharts;
