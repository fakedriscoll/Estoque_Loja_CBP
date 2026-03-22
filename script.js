// Dados iniciais (simulando um banco de dados local)
let inventory = JSON.parse(localStorage.getItem('cbp_inventory')) || [
    { id: 1, name: 'Raquete Pro Pickleball Carbon', category: 'Raquetes', price: 850.00, quantity: 12, minQuantity: 5 },
    { id: 2, name: 'Bola Pickleball Outdoor (Pack 6)', category: 'Bolas', price: 120.00, quantity: 45, minQuantity: 10 },
    { id: 3, name: 'Camiseta Oficial CBP - Azul', category: 'Vestuário', price: 149.90, quantity: 3, minQuantity: 5 },
    { id: 4, name: 'Munhequeira CBP Branca', category: 'Acessórios', price: 35.00, quantity: 20, minQuantity: 5 }
];

// Elementos do DOM
const inventoryBody = document.getElementById('inventory-body');
const totalItemsEl = document.getElementById('total-items');
const totalValueEl = document.getElementById('total-value');
const lowStockCountEl = document.getElementById('low-stock-count');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const btnAddProduct = document.getElementById('btn-add-product');
const modal = document.getElementById('product-modal');
const closeModal = document.querySelector('.close');
const productForm = document.getElementById('product-form');
const modalTitle = document.getElementById('modal-title');

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    renderInventory();
    updateStats();
});

// Função para renderizar a tabela
function renderInventory(items = inventory) {
    inventoryBody.innerHTML = '';
    
    items.forEach(item => {
        const status = getStatus(item.quantity, item.minQuantity);
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td><strong>${item.name}</strong></td>
            <td>${item.category}</td>
            <td>R$ ${item.price.toFixed(2)}</td>
            <td>${item.quantity}</td>
            <td><span class="status-badge ${status.class}">${status.label}</span></td>
            <td>
                <button class="btn-edit" onclick="editProduct(${item.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" onclick="deleteProduct(${item.id})"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        inventoryBody.appendChild(row);
    });
}

// Função para definir status do estoque
function getStatus(qty, min) {
    if (qty <= 0) return { label: 'Esgotado', class: 'status-empty' };
    if (qty <= min) return { label: 'Baixo Estoque', class: 'status-low' };
    return { label: 'Disponível', class: 'status-ok' };
}

// Atualizar estatísticas
function updateStats() {
    const totalItems = inventory.reduce((acc, item) => acc + item.quantity, 0);
    const totalValue = inventory.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const lowStock = inventory.filter(item => item.quantity <= item.minQuantity).length;
    
    totalItemsEl.innerText = totalItems;
    totalValueEl.innerText = `R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    lowStockCountEl.innerText = lowStock;
    
    // Salvar no localStorage
    localStorage.setItem('cbp_inventory', JSON.stringify(inventory));
}

// Busca e Filtro
function filterItems() {
    const searchTerm = searchInput.value.toLowerCase();
    const category = categoryFilter.value;
    
    const filtered = inventory.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm) || 
                              item.category.toLowerCase().includes(searchTerm);
        const matchesCategory = category === 'all' || item.category === category;
        return matchesSearch && matchesCategory;
    });
    
    renderInventory(filtered);
}

searchInput.addEventListener('input', filterItems);
categoryFilter.addEventListener('change', filterItems);

// Modal e Formulário
btnAddProduct.onclick = () => {
    modalTitle.innerText = 'Novo Produto';
    productForm.reset();
    document.getElementById('product-id').value = '';
    modal.style.display = 'block';
};

closeModal.onclick = () => modal.style.display = 'none';
window.onclick = (event) => { if (event.target == modal) modal.style.display = 'none'; };

productForm.onsubmit = (e) => {
    e.preventDefault();
    
    const id = document.getElementById('product-id').value;
    const newProduct = {
        id: id ? parseInt(id) : Date.now(),
        name: document.getElementById('name').value,
        category: document.getElementById('category').value,
        price: parseFloat(document.getElementById('price').value),
        quantity: parseInt(document.getElementById('quantity').value),
        minQuantity: parseInt(document.getElementById('min-quantity').value)
    };
    
    if (id) {
        // Editar
        const index = inventory.findIndex(item => item.id == id);
        inventory[index] = newProduct;
    } else {
        // Adicionar
        inventory.push(newProduct);
    }
    
    modal.style.display = 'none';
    renderInventory();
    updateStats();
};

// Funções Globais (chamadas por botões na tabela)
window.editProduct = (id) => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    
    modalTitle.innerText = 'Editar Produto';
    document.getElementById('product-id').value = item.id;
    document.getElementById('name').value = item.name;
    document.getElementById('category').value = item.category;
    document.getElementById('price').value = item.price;
    document.getElementById('quantity').value = item.quantity;
    document.getElementById('min-quantity').value = item.minQuantity;
    
    modal.style.display = 'block';
};

window.deleteProduct = (id) => {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
        inventory = inventory.filter(item => item.id !== id);
        renderInventory();
        updateStats();
    }
};