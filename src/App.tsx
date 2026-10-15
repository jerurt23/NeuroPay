import React, { useState, useEffect } from 'react';
import { 
  HeaderNav 
} from './components/HeaderNav.tsx';
import { 
  TabBar 
} from './components/TabBar.tsx';
import { 
  DynamicIsland, 
  DynamicIslandNotification 
} from './components/DynamicIsland.tsx';
import { 
  DashboardView 
} from './components/DashboardView.tsx';
import { 
  NeuralNetworkView 
} from './components/NeuralNetworkView.tsx';
import { 
  TransportRoutesView 
} from './components/TransportRoutesView.tsx';
import { 
  BudgetView 
} from './components/BudgetView.tsx';
import { 
  BankEmailSyncView 
} from './components/BankEmailSyncView.tsx';
import { 
  SettingsView 
} from './components/SettingsView.tsx';
import { 
  NewTransactionModal 
} from './components/NewTransactionModal.tsx';
import { 
  AuthModal 
} from './components/AuthModal.tsx';
import { 
  INITIAL_CATEGORIES, 
  INITIAL_TRANSACTIONS, 
  INITIAL_BUDGETS, 
  INITIAL_BANK_EMAILS, 
  INITIAL_WIDGETS, 
  INITIAL_TABS, 
  INITIAL_SETTINGS 
} from './data/initialData.ts';
import { 
  Transaction, 
  Budget, 
  BankEmail, 
  WidgetConfig, 
  TabConfig, 
  UserSettings, 
  ThemeMode, 
  ViewportMode, 
  CategoryInfo 
} from './types/index.ts';
import { encryptData, decryptData, EncryptedPayload } from './utils/crypto.ts';
import { parseBankEmail, createTransactionFromBankNotification } from './utils/bankEmailParser.ts';

export default function App() {
  // Core state
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('synapse_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    return INITIAL_SETTINGS;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('synapse_transactions');
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    return INITIAL_TRANSACTIONS;
  });

  const [categories, setCategories] = useState<CategoryInfo[]>(INITIAL_CATEGORIES);
  const [budgets, setBudgets] = useState<Budget[]>(() => {
    const saved = localStorage.getItem('synapse_budgets');
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    return INITIAL_BUDGETS;
  });

  const [bankEmails, setBankEmails] = useState<BankEmail[]>(() => {
    const saved = localStorage.getItem('synapse_bank_emails');
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    return INITIAL_BANK_EMAILS;
  });

  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    const saved = localStorage.getItem('synapse_widgets');
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    return INITIAL_WIDGETS;
  });

  const [tabs, setTabs] = useState<TabConfig[]>(() => {
    const saved = localStorage.getItem('synapse_tabs');
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    return INITIAL_TABS;
  });

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [currentMasterPassword, setCurrentMasterPassword] = useState<string>('AppleSecure2026!');
  
  // Modals & Dynamic Island
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [islandNotification, setIslandNotification] = useState<DynamicIslandNotification | null>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('synapse_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('synapse_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('synapse_budgets', JSON.stringify(budgets));
  }, [budgets]);

  useEffect(() => {
    localStorage.setItem('synapse_bank_emails', JSON.stringify(bankEmails));
  }, [bankEmails]);

  useEffect(() => {
    localStorage.setItem('synapse_widgets', JSON.stringify(widgets));
  }, [widgets]);

  useEffect(() => {
    localStorage.setItem('synapse_tabs', JSON.stringify(tabs));
  }, [tabs]);

  // Dark / Light Theme sync
  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      settings.theme === 'dark' ||
      (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  // Trigger Dynamic Island notification & Web Push
  const notify = (notif: Omit<DynamicIslandNotification, 'id' | 'timestamp'>) => {
    const fullNotif: DynamicIslandNotification = {
      ...notif,
      id: `notif_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    setIslandNotification(fullNotif);

    // Auto dismiss after 5 seconds
    setTimeout(() => {
      setIslandNotification((current) => (current?.id === fullNotif.id ? null : current));
    }, 5000);

    // Web Notification API
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(notif.title, {
          body: notif.message,
          icon: '/favicon.ico',
        });
      } catch (_) {}
    }
  };

  // Add new transaction
  const handleSaveTransaction = (newTx: Transaction) => {
    setTransactions((prev) => [newTx, ...prev]);

    notify({
      title: newTx.type === 'expense' ? 'Gasto Registrado' : 'Ingreso Registrado',
      message: `${newTx.title} (${newTx.category.toUpperCase()})`,
      type: newTx.type === 'expense' ? 'expense' : 'income',
      amount: newTx.amount,
      currency: settings.currencySymbol,
    });
  };

  // Repeat trip
  const handleRepeatTrip = (tx: Transaction) => {
    if (!tx.transportDetails) return;
    const repeatedTx: Transaction = {
      ...tx,
      id: `tx_rep_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
    };
    handleSaveTransaction(repeatedTx);
  };

  // Import bank email as transaction
  const handleImportBankEmail = (email: BankEmail, tx: Transaction) => {
    // Mark email as synced
    setBankEmails((prev) =>
      prev.map((e) => (e.id === email.id ? { ...e, status: 'synced' as const } : e))
    );
    // Add transaction
    setTransactions((prev) => [tx, ...prev]);

    notify({
      title: `Alerta ${email.bankName} Procesada`,
      message: `${email.parsedMerchant} añadido a la Red Neuronal`,
      type: 'bank',
      amount: email.parsedAmount,
      currency: email.parsedCurrency,
    });
  };

  // Simulate incoming bank email
  const handleSimulateIncomingBankEmail = () => {
    const randomBanks = [
      {
        name: 'BBVA',
        sender: 'notificaciones@bbva.com',
        merchant: 'UBER TRIP Miraflores a San Isidro',
        amount: 11.20,
        currency: 'USD',
        category: 'transporte',
      },
      {
        name: 'BCP',
        sender: 'alertas@bcp.com.pe',
        merchant: 'INKAFARMA Farmacia Central',
        amount: 42.50,
        currency: 'S/',
        category: 'medicina',
      },
      {
        name: 'Nu Bank',
        sender: 'no-reply@nu.com',
        merchant: 'STARBUCKS Cafetería',
        amount: 8.50,
        currency: '$',
        category: 'comida',
      },
      {
        name: 'Santander',
        sender: 'alertas@santander.com',
        merchant: 'REPSOL Estación de Servicio',
        amount: 55.00,
        currency: '$',
        category: 'transporte',
      },
    ];

    const pick = randomBanks[Math.floor(Math.random() * randomBanks.length)];
    const newEmail: BankEmail = {
      id: `email_${Date.now()}`,
      bankName: pick.name,
      senderEmail: pick.sender,
      subject: `Aviso de consumo con tarjeta en ${pick.merchant}`,
      bodySnippet: `Has realizado un consumo en ${pick.merchant} por ${pick.currency} ${pick.amount.toFixed(2)}.`,
      parsedAmount: pick.amount,
      parsedCurrency: pick.currency,
      parsedDate: new Date().toISOString().split('T')[0],
      parsedMerchant: pick.merchant,
      parsedCategory: pick.category,
      status: 'pending',
    };

    setBankEmails((prev) => [newEmail, ...prev]);

    notify({
      title: `Nuevo Correo Bancario (${pick.name})`,
      message: `${pick.merchant} por ${pick.currency} ${pick.amount.toFixed(2)}`,
      type: 'bank',
      amount: pick.amount,
      currency: pick.currency,
    });
  };

  // Export encrypted vault
  const handleExportVault = async () => {
    try {
      const dataToEncrypt = JSON.stringify({
        transactions,
        budgets,
        bankEmails,
        settings,
        exportedAt: new Date().toISOString(),
      });

      const encrypted = await encryptData(dataToEncrypt, currentMasterPassword);
      const blob = new Blob([JSON.stringify(encrypted, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `synapsepay-vault-${new Date().toISOString().split('T')[0]}.vault`;
      a.click();
      URL.revokeObjectURL(url);

      notify({
        title: 'Bóveda E2EE Exportada',
        message: 'Respaldo seguro cifrado con AES-GCM 256 descargado',
        type: 'security',
      });
    } catch (err) {
      alert('Error al exportar la bóveda: ' + (err as Error).message);
    }
  };

  // Import encrypted vault
  const handleImportVault = async (file: File) => {
    try {
      const text = await file.text();
      const payload: EncryptedPayload = JSON.parse(text);
      const decrypted = await decryptData(payload, currentMasterPassword);
      const parsed = JSON.parse(decrypted);

      if (parsed.transactions) setTransactions(parsed.transactions);
      if (parsed.budgets) setBudgets(parsed.budgets);
      if (parsed.bankEmails) setBankEmails(parsed.bankEmails);
      if (parsed.settings) setSettings(parsed.settings);

      notify({
        title: 'Bóveda E2EE Restaurada',
        message: 'Todos tus registros y configuraciones han sido importados',
        type: 'security',
      });
    } catch (err) {
      alert('Contraseña maestra incorrecta o archivo de bóveda corrupto.');
    }
  };

  // Test notification
  const handleTriggerTestPush = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification('SynapsePay Notificación Push', {
            body: '¡Alertas bancarias y movimientos en tiempo real activas!',
          });
        }
      });
    }

    notify({
      title: 'Alerta Bancaria en Tiempo Real',
      message: 'Notificación push simulada con estética iOS',
      type: 'bank',
      amount: 14.50,
      currency: settings.currencySymbol,
    });
  };

  // Authentication
  const handleAuthenticate = (password: string, userName: string, userEmail: string) => {
    setCurrentMasterPassword(password);
    setSettings((prev) => ({
      ...prev,
      userName,
      userEmail,
    }));
    setIsLocked(false);
    notify({
      title: 'Bóveda Desbloqueada',
      message: `Bienvenido, ${userName}. Cifrado E2EE activo.`,
      type: 'security',
    });
  };

  // Filter pending email alerts
  const pendingCount = bankEmails.filter((e) => e.status === 'pending').length;

  // View frame wrapper simulation
  const renderAppContent = () => (
    <div className={`min-h-screen flex flex-col bg-[#f8f9fa] dark:bg-[#0a0a0a] text-zinc-900 dark:text-zinc-100 transition-colors duration-500 ${settings.trueTone ? 'true-tone-active' : ''}`}>
      {/* Dynamic Island Top Pill */}
      <DynamicIsland
        notification={islandNotification}
        onDismiss={() => setIslandNotification(null)}
        isLocked={isLocked}
      />

      {/* iOS Header Navigation */}
      <HeaderNav
        theme={settings.theme}
        onThemeChange={(theme) => setSettings((s) => ({ ...s, theme }))}
        trueTone={settings.trueTone}
        onTrueToneToggle={() => setSettings((s) => ({ ...s, trueTone: !s.trueTone }))}
        viewportMode={settings.viewportMode}
        onViewportChange={(mode) => setSettings((s) => ({ ...s, viewportMode: mode }))}
        e2eeLocked={isLocked}
        onToggleLock={() => {
          if (isLocked) {
            setIsAuthModalOpen(true);
          } else {
            setIsLocked(true);
            notify({
              title: 'Bóveda Bloqueada',
              message: 'Datos protegidos con clave maestra',
              type: 'security',
            });
          }
        }}
        unreadCount={pendingCount}
        onOpenNotifications={() => setActiveTab('email_sync')}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        userName={settings.userName}
      />

      {/* Main Tab Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-28">
        <div className="transition-all duration-300">
          {activeTab === 'dashboard' && (
            <div key="dashboard" className="animate-fadeIn">
              <DashboardView
                transactions={transactions}
                categories={categories}
                budgets={budgets}
                bankEmails={bankEmails}
                widgets={widgets}
                currencySymbol={settings.currencySymbol}
                onOpenNewTransaction={() => setIsNewTxModalOpen(true)}
                onNavigateTab={(tab) => setActiveTab(tab)}
                onRepeatTrip={handleRepeatTrip}
                onConfigureWidgets={() => setActiveTab('settings')}
              />
            </div>
          )}

          {activeTab === 'neural' && (
            <div key="neural" className="animate-fadeIn">
              <NeuralNetworkView
                transactions={transactions}
                categories={categories}
                currencySymbol={settings.currencySymbol}
              />
            </div>
          )}

          {activeTab === 'records' && (
            <div key="records" className="animate-fadeIn">
              <div className="p-5 sm:p-6 rounded-3xl ios-glass-card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      Histórico Completo de Compras y Movimientos
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Cifrado E2EE • {transactions.length} registros conectados
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNewTxModalOpen(true)}
                    className="px-4 py-2 rounded-2xl bg-blue-600 text-white font-semibold text-xs shadow-md"
                  >
                    + Nuevo Registro
                  </button>
                </div>

                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="py-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                            {tx.title}
                          </h3>
                          <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold">
                            {tx.category}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {tx.notes || (tx.transportDetails && `${tx.transportDetails.origin} -> ${tx.transportDetails.destination}`)}
                        </p>
                        <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-2">
                          <span>{tx.date} {tx.time || ''}</span>
                          <span>•</span>
                          <span className="capitalize">{tx.paymentMethod.replace('_', ' ')}</span>
                          {tx.bankSyncMeta && (
                            <span className="text-indigo-500 font-semibold">
                              (Auto-Sync {tx.bankSyncMeta.bankName})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className={`text-base font-bold font-mono ${tx.type === 'expense' ? 'text-zinc-900 dark:text-zinc-100' : 'text-emerald-500'}`}>
                          {tx.type === 'expense' ? '-' : '+'}{settings.currencySymbol}{tx.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'routes' && (
            <div key="routes" className="animate-fadeIn">
              <TransportRoutesView
                transactions={transactions}
                currencySymbol={settings.currencySymbol}
                onRepeatTrip={handleRepeatTrip}
                onOpenNewTrip={() => setIsNewTxModalOpen(true)}
              />
            </div>
          )}

          {activeTab === 'budgets' && (
            <div key="budgets" className="animate-fadeIn">
              <BudgetView
                budgets={budgets}
                transactions={transactions}
                categories={categories}
                currencySymbol={settings.currencySymbol}
                onAddBudget={(b) => setBudgets((prev) => [...prev, b])}
                onDeleteBudget={(id) => setBudgets((prev) => prev.filter((b) => b.id !== id))}
              />
            </div>
          )}

          {activeTab === 'email_sync' && (
            <div key="email_sync" className="animate-fadeIn">
              <BankEmailSyncView
                bankEmails={bankEmails}
                onImportEmailAsTransaction={handleImportBankEmail}
                onSimulateIncomingEmail={handleSimulateIncomingBankEmail}
                currencySymbol={settings.currencySymbol}
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <div key="settings" className="animate-fadeIn">
              <SettingsView
                settings={settings}
                onUpdateSettings={(newS) => setSettings((s) => ({ ...s, ...newS }))}
                tabs={tabs}
                onUpdateTabs={(newTabs) => setTabs(newTabs)}
                widgets={widgets}
                onUpdateWidgets={(newWidgets) => setWidgets(newWidgets)}
                onExportVault={handleExportVault}
                onImportVault={handleImportVault}
                onTriggerTestNotification={handleTriggerTestPush}
              />
            </div>
          )}

          {/* Custom Tabs Dynamic Fallback */}
          {tabs.find((t) => t.id === activeTab && t.isCustom) && (
            <div key={activeTab} className="p-6 rounded-3xl ios-glass-card text-center space-y-3 animate-fadeIn">
              <h2 className="text-xl font-bold">
                {tabs.find((t) => t.id === activeTab)?.name}
              </h2>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                Pestaña personalizada activa. Puedes moverla, cambiar su posición en la barra o agregar widgets específicos en la sección de Personalizar.
              </p>
              <button
                type="button"
                onClick={() => setIsNewTxModalOpen(true)}
                className="px-4 py-2 rounded-2xl bg-blue-600 text-white font-semibold text-xs"
              >
                + Registrar en esta categoría
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Floating iOS Dock TabBar */}
      <TabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId)}
        onOpenNewTransaction={() => setIsNewTxModalOpen(true)}
      />

      {/* Modals */}
      <NewTransactionModal
        isOpen={isNewTxModalOpen}
        onClose={() => setIsNewTxModalOpen(false)}
        onSave={handleSaveTransaction}
        categories={categories}
        currencySymbol={settings.currencySymbol}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthenticate={handleAuthenticate}
        currentUserName={settings.userName}
        currentUserEmail={settings.userEmail}
        isLocked={isLocked}
      />
    </div>
  );

  // Viewport Frame Preview Wrapping
  if (settings.viewportMode === 'iphone') {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-2 sm:p-6">
        <div className="w-[393px] h-[852px] bg-black rounded-[54px] p-3 shadow-[0_0_60px_rgba(0,0,0,0.8)] border-[6px] border-zinc-700 relative overflow-hidden flex flex-col">
          {/* Dynamic Island cutout */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-full z-50 pointer-events-none" />
          <div className="w-full h-full rounded-[44px] overflow-y-auto overflow-x-hidden relative bg-zinc-50 dark:bg-black">
            {renderAppContent()}
          </div>
          {/* iOS Bottom Bar */}
          <div className="w-32 h-1 bg-white/40 rounded-full mx-auto mt-2 mb-1" />
        </div>
      </div>
    );
  }

  if (settings.viewportMode === 'ipad') {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
        <div className="w-[820px] h-[920px] bg-black rounded-[40px] p-4 shadow-[0_0_60px_rgba(0,0,0,0.8)] border-[6px] border-zinc-700 relative overflow-hidden flex flex-col">
          <div className="w-full h-full rounded-[30px] overflow-y-auto overflow-x-hidden relative bg-zinc-50 dark:bg-black">
            {renderAppContent()}
          </div>
          <div className="w-40 h-1 bg-white/40 rounded-full mx-auto mt-2" />
        </div>
      </div>
    );
  }

  if (settings.viewportMode === 'macbook') {
    return (
      <div className="min-h-screen bg-gradient-to-tr from-slate-900 via-indigo-950 to-zinc-900 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl h-[880px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-300 dark:border-zinc-700 flex flex-col overflow-hidden">
          {/* macOS Titlebar */}
          <div className="h-8 bg-zinc-100 dark:bg-zinc-800 px-4 flex items-center justify-between border-b border-black/5 dark:border-white/5 select-none">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            </div>
            <span className="text-xs font-semibold text-zinc-500">
              SynapsePay — macOS Pro Edition
            </span>
            <div className="w-12" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {renderAppContent()}
          </div>
        </div>
      </div>
    );
  }

  // Native Full Fluid View
  return renderAppContent();
}
