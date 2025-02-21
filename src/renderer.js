const { ipcRenderer } = require('electron');


let appData = {
    expenses: [],
    categories: [],
    deletedCategories: [],
    deletedExpenses: []
};

const expenseForm = document.getElementById('expenseForm');
const amountInput = document.getElementById('amount');
const categorySelect = document.getElementById('category');
const dateInput = document.getElementById('date');
const descriptionInput = document.getElementById('description');
const addExpenseButton = document.getElementById('addExpense');
const expensesTable = document.getElementById('expensesTable');
const newCategoryInput = document.getElementById('newCategory');
const addCategoryButton = document.getElementById('addCategory');
const categoriesList = document.querySelector('.categories-list');

// Graphiques
let pieChart;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    ipcRenderer.send('load-data');
    dateInput.valueAsDate = new Date();
    initializeValidation();
});

// Gestion des données
ipcRenderer.on('data-loaded', (event, data) => {
    appData = data;
    updateUI();
});

ipcRenderer.on('expense-saved', (event, data) => {
    appData = data;
    updateUI();
    clearForm();
});

ipcRenderer.on('category-added', (event, data) => {
    appData = data;
    updateUI();
    newCategoryInput.value = '';
});

ipcRenderer.on('category-deleted', (event, data) => {
    appData = data;
    updateUI();
});

// maj de l'interface
function updateUI() {
    updateCategoriesDropdown();
    updateExpensesTable();
    updateCategoriesList();
    updateCharts();
}

function updateCategoriesDropdown() {
    categorySelect.innerHTML = '';
    appData.categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        categorySelect.appendChild(option);
    });
}

function updateExpensesTable() {
    const tbody = expensesTable.querySelector('tbody');
    tbody.innerHTML = '';
    
    appData.expenses.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(expense => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">${new Date(expense.date).toLocaleDateString()}</td>
            <td class="px-6 py-4 whitespace-nowrap">${appData.categories.find(c => c.id === expense.categoryId)?.name}</td>
            <td class="px-6 py-4 whitespace-nowrap">${expense.description}</td>
            <td class="px-6 py-4 whitespace-nowrap relative">
                ${formatCurrency(expense.amount)}
                <button onclick="deleteExpense(${expense.id})" class="absolute right-0 top-1/2 transform -translate-y-1/2 text-red-500 hover:text-red-700 mr-2">
                    <i class="fas fa-times-circle"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function deleteExpense(expenseId) {
    try {
        // Validate input
        if (!expenseId) {
            console.error('Invalid expense ID');
            return;
        }

        // Ensure appData is properly initialized
        if (!appData) {
            console.error('App data is not initialized');
            return;
        }

        // Ensure expenses array exists
        if (!Array.isArray(appData.expenses)) {
            appData.expenses = [];
        }

        // Find the expense to delete
        const expenseToDelete = appData.expenses.find(e => e.id === expenseId);
    
        if (expenseToDelete) {
            // Remove from expenses
            appData.expenses = appData.expenses.filter(e => e.id !== expenseId);
        
            // Ensure deletedExpenses array exists
            if (!Array.isArray(appData.deletedExpenses)) {
                appData.deletedExpenses = [];
            }
        
            // Add to deleted expenses with timestamp
            const deletedExpense = {
                ...expenseToDelete,
                deletedAt: new Date().toISOString()
            };
            appData.deletedExpenses.push(deletedExpense);
        
            // Send to main process to save deletion
            ipcRenderer.send('delete-expense', {
                expenses: appData.expenses,
                categories: appData.categories,
                deletedExpenses: appData.deletedExpenses,
                // Include other necessary properties
                deletedCategories: appData.deletedCategories || []
            });

            // Update UI immediately
            updateUI();
        } else {
            console.error('Expense not found:', expenseId);
        }
    } catch (error) {
        console.error('Error deleting expense:', error);
    }
}
// New event listener for expense deletion confirmation
ipcRenderer.on('expense-deleted', (event, data) => {
    appData = data;
    updateUI();
    playDeleteSound(); 
});

// Add this to your existing IPC event listeners
ipcRenderer.on('data-loaded', (event, data) => {
    appData = data;
    updateUI();
});


function updateCategoriesList() {
    categoriesList.innerHTML = '';
    appData.categories.forEach(category => {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-3 bg-gray-50 rounded';

        // Ajout du nom de la catégorie et des boutons
        div.innerHTML = `
            <span class="font-medium">${category.name}</span>
            ${!category.isDefault ? `
                <div class="flex items-center space-x-2">
                    <button onclick="deleteCategory(${category.id})"
                        class="bg-red-500 text-white py-1 px-3 rounded hover:bg-red-600 flex items-center">
                        <i class="fas fa-trash-alt mr-2"></i> 
                    </button>
                    <button onclick="enableRename(${category.id})"
                        class="bg-yellow-500 text-white py-1 px-3 rounded hover:bg-yellow-600 flex items-center">
                        <i class="fas fa-pencil-alt mr-2"></i> 
                    </button>
                </div>
                <div id="rename-input-${category.id}" style="display:none;" class="mt-2">
                    <input type="text" id="newName-${category.id}" value="${category.name}" class="p-2 border rounded"/>
                    <button onclick="renameCategory(${category.id})" class="bg-blue-500 text-white py-1 px-3 rounded hover:bg-blue-600">
                        Valider
                    </button>
                    <button onclick="cancelRename(${category.id})" class="bg-gray-500 text-white py-1 px-3 rounded hover:bg-gray-600">
                        Annuler
                    </button>
                </div>
            ` : ''}
        `;
        categoriesList.appendChild(div);
    });
}


function enableRename(categoryId) {
    const renameInput = document.getElementById(`rename-input-${categoryId}`);
    renameInput.style.display = 'block';  // Affiche le champ de saisie
}

function renameCategory(categoryId) {
    const newName = document.getElementById(`newName-${categoryId}`).value.trim();
    if (newName) {
        const category = appData.categories.find(c => c.id === categoryId);
        if (category) {
            category.name = newName;  // Mise à jour du nom de la catégorie
            updateUI();  // Actualise l'interface utilisateur
            ipcRenderer.send('category-renamed', appData);  // Envoie l'événement au processus principal
        }
    }
}

function cancelRename(categoryId) {
    const renameInput = document.getElementById(`rename-input-${categoryId}`);
    renameInput.style.display = 'none';  // Cache le champ de saisie
}




function updateCharts() {
    updatePieChart();
    updateProgressBar();
}

function updatePieChart() {
    const ctx = document.getElementById('expensesPieChart').getContext('2d');
    
    const categoryTotals = appData.categories.map(category => {
        return {
            category: category.name,
            total: appData.expenses
                .filter(e => e.categoryId === category.id)
                .reduce((sum, e) => sum + e.amount, 0)
        };
    });

    if (pieChart) {
        pieChart.destroy();
    }

    pieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: categoryTotals.map(c => c.category),
            datasets: [{
                data: categoryTotals.map(c => c.total),
                backgroundColor: [
                    '#2ecc71',
                    '#3498db',
                    '#e74c3c',
                    '#f1c40f',
                    '#9b59b6',
                    '#34495e',
                    '#95a5a6',
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function updateProgressBar() {
    const totalBudget = 2000; 
    const currentTotal = appData.expenses.reduce((sum, e) => sum + e.amount, 0);
    const percentage = Math.min((currentTotal / totalBudget) * 100, 100);
    
    const progressBar = document.getElementById('budgetProgress');
    progressBar.style.width = `${percentage}%`;
    
    if (percentage < 60) {
        progressBar.style.backgroundColor = '#2ecc71';
    } else if (percentage < 80) {
        progressBar.style.backgroundColor = '#f1c40f'; 
    } else {
        progressBar.style.backgroundColor = '#e74c3c'; 
    }

    // Afficher le montant restant
    const remainingBudget = formatCurrency(totalBudget - currentTotal);
    progressBar.setAttribute('title', `Budget restant : ${remainingBudget}`);
}

function validateBudget(newExpenseAmount) {
    const totalBudget = 2000;
    const currentTotal = appData.expenses.reduce((sum, e) => sum + e.amount, 0);
    const potentialTotal = currentTotal + newExpenseAmount;

    if (potentialTotal > totalBudget) {
        const exceedAmount = potentialTotal - totalBudget;
        alert(`Attention ! Cette dépense ferait dépasser votre budget de ${formatCurrency(exceedAmount)}. 
Votre budget actuel est de ${formatCurrency(totalBudget)}, et vous avez déjà dépensé ${formatCurrency(currentTotal)}.`);
        return false;
    }

    if (potentialTotal > totalBudget * 0.8) {
        const warningAmount = totalBudget - potentialTotal;
        alert(`Attention ! Vous vous approchez de la limite de votre budget. 
Il vous reste ${formatCurrency(warningAmount)} avant d'atteindre la limite de ${formatCurrency(totalBudget)}.`);
    }

    return true;
}

// Modifier l'événement de soumission du formulaire
expenseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const expenseAmount = parseFloat(amountInput.value);
    
    // Vérifier le budget avant d'enregistrer
    if (!validateBudget(expenseAmount)) {
        return; 
    }

    const expense = {
        id: Date.now(),
        amount: expenseAmount,
        categoryId: parseInt(categorySelect.value),
        date: dateInput.value,
        description: descriptionInput.value.trim()
    };
    
    ipcRenderer.send('save-expense', expense);
});

function validateForm() {
    const isValid = 
        amountInput.value > 0 &&
        categorySelect.value &&
        dateInput.value &&
        descriptionInput.value.trim().length > 0;
    
    addExpenseButton.disabled = !isValid;
}



addCategoryButton.addEventListener('click', () => {
    const categoryName = newCategoryInput.value.trim();
    if (categoryName) {
        ipcRenderer.send('add-category', categoryName);
    }
});

function deleteCategory(categoryId) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) {
        ipcRenderer.send('delete-category', categoryId);
    }
}

function clearForm() {
    amountInput.value = '';
    dateInput.valueAsDate = new Date();
    descriptionInput.value = '';
    validateForm();
}

function initializeValidation() {
    const inputs = [amountInput, categorySelect, dateInput, descriptionInput];
    inputs.forEach(input => {
        input.addEventListener('input', validateForm);
    });
}
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
}

function playSound() {
    const audio = new Audio('./success.wav');
    audio.play().catch(console.error);
}

ipcRenderer.on('expense-saved', (event, data) => {
    appData = data;
    updateUI();
    clearForm();
    playSound();
});

function playDeleteSound() {
    const audio = new Audio('./delete.wav');
    audio.play().catch(console.error);
}

ipcRenderer.on('category-deleted', (event, data) => {
    appData = data;
    updateUI();
    playDeleteSound();
});

