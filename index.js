const { app, BrowserWindow, ipcMain, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// Chemins vers les fichiers de données
const dataPath = path.join(__dirname, 'src', 'donnees.json');
const deletedExpensesPath = path.join(__dirname, 'src', 'deletedExpenses.json');

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Gestion des données
function loadData() {
    try {
        let data;
        // Charger les données principales
        if (fs.existsSync(dataPath)) {
            data = JSON.parse(fs.readFileSync(dataPath));
        } else {
            // Données par défaut
            data = {
                expenses: [],
                categories: [
                    { id: 1, name: 'Factures', isDefault: true },
                    { id: 2, name: 'Alimentation', isDefault: true },
                    { id: 3, name: 'Loisirs', isDefault: true },
                    { id: 4, name: 'Transport', isDefault: true }
                ],
                deletedCategories: [],
                deletedExpenses: [] // Nouvelle liste pour les dépenses supprimées
            };
        }

        // Charger les dépenses supprimées
        if (fs.existsSync(deletedExpensesPath)) {
            data.deletedExpenses = JSON.parse(fs.readFileSync(deletedExpensesPath));
        } else {
            data.deletedExpenses = [];
        }

        return data;
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        return { 
            expenses: [], 
            categories: [], 
            deletedCategories: [],
            deletedExpenses: []
        };
    }
}

function saveData(data) {
    try {
        // Sauvegarder les données principales
        fs.writeFileSync(dataPath, JSON.stringify({
            expenses: data.expenses,
            categories: data.categories,
            deletedCategories: data.deletedCategories
        }, null, 2));

        // Sauvegarder les dépenses supprimées
        fs.writeFileSync(deletedExpensesPath, JSON.stringify(data.deletedExpenses || [], null, 2));
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des données:', error);
    }
}

// Gestionnaires d'événements IPC
ipcMain.on('load-data', (event) => {
    const data = loadData();
    event.reply('data-loaded', data);
});

ipcMain.on('save-expense', (event, expense) => {
    const data = loadData();
    data.expenses.push(expense);
    saveData(data);
    event.reply('expense-saved', data);
});

ipcMain.on('delete-expense', (event, data) => {
    saveData(data);
    event.reply('expense-deleted', data);
});

ipcMain.on('add-category', (event, category) => {
    const data = loadData();
    data.categories.push({
        id: Date.now(),
        name: category,
        isDefault: false
    });
    saveData(data);
    event.reply('category-added', data);
});

ipcMain.on('delete-category', (event, categoryId) => {
    const data = loadData();
    const categoryIndex = data.categories.findIndex(c => c.id === categoryId);
    if (categoryIndex !== -1 && !data.categories[categoryIndex].isDefault) {
        const deletedCategory = data.categories.splice(categoryIndex, 1)[0];
        data.deletedCategories.push(deletedCategory);
        saveData(data);
        event.reply('category-deleted', data);
    }
});

ipcMain.on('category-renamed', (event, appData) => {
    // Sauvegarder les données mises à jour
    saveData(appData);
});

// Gestionnaire pour restaurer une dépense supprimée
ipcMain.on('restore-expense', (event, expenseId) => {
    const data = loadData();
    const deletedExpenseIndex = data.deletedExpenses.findIndex(e => e.id === expenseId);
    
    if (deletedExpenseIndex !== -1) {
        const restoredExpense = data.deletedExpenses.splice(deletedExpenseIndex, 1)[0];
        
        delete restoredExpense.deletedAt;
        
        // Ajouter à la liste des dépenses
        data.expenses.push(restoredExpense);
        
        // Sauvegarder les modifications
        saveData(data);
        
        // Renvoyer les données mises à jour
        event.reply('expense-restored', data);
    }
});

// Gestionnaire pour vider la corbeille
ipcMain.on('clear-deleted-expenses', (event) => {
    const data = loadData();
    data.deletedExpenses = [];
    saveData(data);
    event.reply('deleted-expenses-cleared', data);
});