import React, { useState, useEffect, useRef } from 'react';
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
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);

  const [settings, setSettings] = useState<UserSettings>(INITIAL_SETTINGS);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories] = useState<CategoryInfo[]>(INITIAL_CATEGORIES);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [tabs, setTabs] = useState<TabConfig[]>(INITIAL_TABS);
  const [widgets, setWidgets] = useState<WidgetConfig[]>(INITIAL_WIDGETS);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const isRemoteSync = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Load + subscribe user doc
  useEffect(() => {
    if (!firebaseUser) return;
    const ref = doc(db, 'users', firebaseUser.uid);
    const unsub = onSnapshot(ref, (snap) => {
      isRemoteSync.current = true;
      if (snap.exists()) {
        const data = snap.data() as any;
        if (data.settings) setSettings({ ...INITIAL_SETTINGS, ...data.settings });
        setTransactions(data.transactions || []);
        setBudgets(data.budgets || []);
        if (data.tabs) setTabs(data.tabs);
        if (data.widgets) setWidgets(data.widgets);
      } else {
        // create default
        setDoc(ref, {
          settings: INITIAL_SETTINGS,
          transactions: [],
          budgets: [],
          tabs: INITIAL_TABS,
          widgets: INITIAL_WIDGETS,
        });
      }
      setTimeout(() => (isRemoteSync.current = false), 0);
    });
    return () => unsub();
  }, [firebaseUser]);

  // Persist on changes (skip when remote sync)
  const persist = async (patch: any) => {
    if (!firebaseUser || isRemoteSync.current) return;
    const ref = doc(db, 'users', firebaseUser.uid);
    await setDoc(ref, patch, { merge: true });
  };

  useEffect(() => { if (!isRemoteSync.current) persist({ settings }); }, [settings]);
  useEffect(() => { if (!isRemoteSync.current) persist({ transactions }); }, [transactions]);
  useEffect(() => { if (!isRemoteSync.current) persist({ budgets }); }, [budgets]);
  useEffect(() => { if (!isRemoteSync.current) persist({ tabs }); }, [tabs]);
  useEffect(() => { if (!isRemoteSync.current) persist({ widgets }); }, [widgets]);

  const handleLogin = (user: { uid: string; displayName: string; email: string }) => {
    setSettings((prev) => ({ ...prev, userName: user.displayName, userEmail: user.email }));
  };

  const handleLogout = async () => {
    await signOut(auth);
    setFirebaseUser(null);
    setSettings(INITIAL_SETTINGS);
    setTransactions([]);
    setBudgets([]);
    setTabs(INITIAL_TABS);
    setWidgets(INITIAL_WIDGETS);
  };

  const handleSaveTransaction = (newTx: Transaction) => {
    setTransactions((prev) => [newTx, ...prev]);
  };

  if (!authReady) {
    return <div className="min-h-screen flex items-center justify-center text-zinc-500">Cargando...</div>;
  }

  if (!firebaseUser) {
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
        userName={settings.userName || firebaseUser.displayName || ''}
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
            chartType={settings.chartType}
            onOpenNewTransaction={() => setIsNewTxModalOpen(true)}
          />
        )}

        {activeTab === 'registro' && (
          <RegistroView
            transactions={transactions}
            categories={categories}
            currencySymbol={settings.currencySymbol}
            verifyPassword={(p) => p === 'AppleSecure2026!'}
            dashboardGroups={settings.dashboardGroups}
            onUpdateDashboardGroups={(g) => setSettings((s) => ({ ...s, dashboardGroups: g }))}
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
        currentPassword={settings.accountPassword || 'AppleSecure2026!'}
        onUpdateSettings={(s) => setSettings((prev) => ({ ...prev, ...s }))}
        onChangePassword={(oldP, newP) => {
          const current = settings.accountPassword || 'AppleSecure2026!';
          if (oldP !== current) return false;
          setSettings((prev) => ({ ...prev, accountPassword: newP }));
          return true;
        }}
        onLogout={handleLogout}
      />
    </div>
  );
}