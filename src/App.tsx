import React, { useState, useEffect } from 'react';
import { HeaderNav } from './components/HeaderNav.tsx';
import { TabBar } from './components/TabBar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { RegistroView } from './components/RegistroView.tsx';
import { BudgetView } from './components/BudgetView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { NewTransactionModal } from './components/NewTransactionModal.tsx';
import { ProfileModal } from './components/ProfileModal.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import {
  INITIAL_CATEGORIES,
  INITIAL_TRANSACTIONS,
  INITIAL_BUDGETS,
  INITIAL_TABS,
  INITIAL_SETTINGS,
  INITIAL_WIDGETS,
} from './data/initialData.ts';
import {
  Transaction,
  Budget,
  TabConfig,
  UserSettings,
  CategoryInfo,
  WidgetConfig,
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
  const [tabs, setTabs] = useState<TabConfig[]>(() => {
    const saved = localStorage.getItem('neuropay_tabs');
    if (saved) { try { return JSON.parse(saved); } catch (_) {} }
    return INITIAL_TABS;
  });

  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    const saved = localStorage.getItem('neuropay_widgets');
    if (saved) { try { return JSON.parse(saved); } catch (_) {} }
    return INITIAL_WIDGETS;
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [currentMasterPassword, setCurrentMasterPassword] = useState('AppleSecure2026!');

  useEffect(() => {
    localStorage.setItem('neuropay_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('neuropay_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('neuropay_tabs', JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    localStorage.setItem('neuropay_widgets', JSON.stringify(widgets));
  }, [widgets]);

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
        onOpenProfile={() => setIsProfileOpen(true)}
        userName={settings.userName}
        userPhoto={settings.userPhoto}
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
            tabs={tabs}
            onUpdateTabs={setTabs}
            widgets={widgets}
            onUpdateWidgets={setWidgets}
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

      <ProfileModal
        open={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        settings={settings}
        currentPassword={currentMasterPassword}
        onUpdateSettings={(s) => setSettings((prev) => ({ ...prev, ...s }))}
        onChangePassword={(oldP, newP) => {
          if (oldP !== currentMasterPassword) return false;
          setCurrentMasterPassword(newP);
          return true;
        }}
        onLogout={handleLogout}
      />
    </div>
  );
}
