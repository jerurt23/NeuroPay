import React, { useState, useEffect } from 'react';
import { HeaderNav } from './components/HeaderNav.tsx';
import { TabBar } from './components/TabBar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { RegistroView } from './components/RegistroView.tsx';
import { TransportRoutesView } from './components/TransportRoutesView.tsx';
import { BudgetView } from './components/BudgetView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { NewTransactionModal } from './components/NewTransactionModal.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import {
  INITIAL_CATEGORIES,
  INITIAL_TRANSACTIONS,
  INITIAL_BUDGETS,
  INITIAL_TABS,
  INITIAL_SETTINGS,
} from './data/initialData.ts';
import {
  Transaction,
  Budget,
  TabConfig,
  UserSettings,
  CategoryInfo,
} from './types/index.ts';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('neuropay_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    return INITIAL_SETTINGS;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('neuropay_transactions');
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    return INITIAL_TRANSACTIONS;
  });

  const [categories] = useState<CategoryInfo[]>(INITIAL_CATEGORIES);
  const [budgets, setBudgets] = useState<Budget[]>(INITIAL_BUDGETS);
  const [tabs, setTabs] = useState<TabConfig[]>(INITIAL_TABS);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('neuropay_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('neuropay_transactions', JSON.stringify(transactions));
  }, [transactions]);

  const handleLogin = (name: string, email: string) => {
    setSettings((prev) => ({ ...prev, userName: name, userEmail: email }));
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setSettings(INITIAL_SETTINGS);
  };

  const handleSaveTransaction = (newTx: Transaction) => {
    setTransactions((prev) => [newTx, ...prev]);
  };

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

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fa] text-zinc-900">
      <HeaderNav
        theme={settings.theme}
        onThemeChange={(theme) => setSettings((s) => ({ ...s, theme }))}
        unreadCount={0}
        onOpenNotifications={() => {}}
        userName={settings.userName}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-24">
        {activeTab === 'dashboard' && (
          <DashboardView
            transactions={transactions}
            categories={categories}
            budgets={budgets}
            bankEmails={[]}
            currencySymbol={settings.currencySymbol}
            onOpenNewTransaction={() => setIsNewTxModalOpen(true)}
          />
        )}

        {activeTab === 'registro' && (
          <RegistroView
            transactions={transactions}
            categories={categories}
            currencySymbol={settings.currencySymbol}
            onSave={handleSaveTransaction}
          />
        )}

        {activeTab === 'routes' && (
          <TransportRoutesView
            transactions={transactions}
            currencySymbol={settings.currencySymbol}
            onRepeatTrip={handleRepeatTrip}
            onOpenNewTrip={() => setIsNewTxModalOpen(true)}
          />
        )}

        {activeTab === 'budgets' && (
          <BudgetView
            budgets={budgets}
            transactions={transactions}
            categories={categories}
            currencySymbol={settings.currencySymbol}
            onAddBudget={(b) => setBudgets((prev) => [...prev, b])}
            onDeleteBudget={(id) => setBudgets((prev) => prev.filter((b) => b.id !== id))}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={(newS) => setSettings((s) => ({ ...s, ...newS }))}
            onLogout={handleLogout}
          />
        )}
      </main>

      <TabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId)}
        onOpenNewTransaction={() => setIsNewTxModalOpen(true)}
      />

      <NewTransactionModal
        isOpen={isNewTxModalOpen}
        onClose={() => setIsNewTxModalOpen(false)}
        onSave={handleSaveTransaction}
        categories={categories}
        currencySymbol={settings.currencySymbol}
      />
    </div>
  );
}
