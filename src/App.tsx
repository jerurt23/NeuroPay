import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { getLocalData, saveLocalData } from './lib/localDb';

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);

  const [settings, setSettings] = useState<UserSettings>(INITIAL_SETTINGS);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  // Combinar categorías base con personalizadas
  const allCategories: CategoryInfo[] = React.useMemo(() => {
    const custom = settings.customCategories || [];
    const customCats: CategoryInfo[] = custom.map((c: any) => ({
      id: c.id,
      name: c.name,
      icon: c.icon || 'Tag',
      color: c.color || '#8E8E93',
      description: c.description || '',
    }));
    return [...INITIAL_CATEGORIES, ...customCats];
  }, [settings.customCategories]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [tabs, setTabs] = useState<TabConfig[]>(INITIAL_TABS);
  const [widgets, setWidgets] = useState<WidgetConfig[]>(INITIAL_WIDGETS);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const isRemoteSync = useRef(false);
  const isLoaded = useRef(false);

  // Tema efectivo: resuelve 'auto' segun la preferencia del sistema
  const isDark = useMemo(() => {
    if (settings.theme === 'dark') return true;
    if (settings.theme === 'light') return false;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }, [settings.theme]);

  // Aplicar tema al documento
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // Escuchar cambios del sistema cuando el tema es 'auto'
  useEffect(() => {
    if (settings.theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setSettings((s) => ({ ...s }));
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings.theme]);

  // Filtro de temperatura de color (similar a True Tone)
  const tempFilter = useMemo(() => {
    if (settings.trueTone) {
      return 'sepia(0.09) saturate(1.08) hue-rotate(-3deg) brightness(0.99)';
    }
    switch (settings.colorTemperature) {
      case 'warm':
        return 'sepia(0.18) saturate(1.12) hue-rotate(-8deg) brightness(0.98)';
      case 'cool':
        return 'saturate(1.06) hue-rotate(8deg) brightness(1.01)';
      default:
        return 'none';
    }
  }, [settings.trueTone, settings.colorTemperature]);

  useEffect(() => {
    document.documentElement.style.setProperty('--truetone-filter', tempFilter);
  }, [tempFilter]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Load data from local DB. Firebase is only used if billing is enabled.
  useEffect(() => {
    if (!firebaseUser) return;
    const userId = firebaseUser.uid;

    getLocalData(userId).then((local) => {
      if (local) {
        if (local.settings) setSettings({ ...INITIAL_SETTINGS, ...local.settings });
        if (local.transactions) setTransactions(local.transactions);
        if (local.budgets) setBudgets(local.budgets);
        if (local.tabs) setTabs(local.tabs);
        if (local.widgets) setWidgets(local.widgets);
      } else {
        // Primera vez: persistir los datos iniciales
        saveLocalData({
          id: userId,
          settings: INITIAL_SETTINGS,
          transactions: [],
          budgets: [],
          tabs: INITIAL_TABS,
          widgets: INITIAL_WIDGETS,
        });
      }
      // Marcar como cargado DESPUÉS de aplicar los datos (evita sobrescribir)
      isLoaded.current = true;
    });

    // Firebase solo si el proyecto tiene billing. Sin billing la promesa
    // falla y el callback de error deja la app funcionando con la BD local.
    const ref = doc(db, 'users', userId);
    const unsub = onSnapshot(ref, (snap) => {
      isRemoteSync.current = true;
      if (snap.exists()) {
        const data = snap.data() as any;
        if (data.settings && Object.keys(data.settings).length > 0) {
          setSettings({ ...INITIAL_SETTINGS, ...data.settings });
        }
        if (data.transactions && data.transactions.length > 0) {
          setTransactions(data.transactions);
        }
        if (data.budgets && data.budgets.length > 0) {
          setBudgets(data.budgets);
        }
        if (data.tabs && data.tabs.length > 0) setTabs(data.tabs);
        if (data.widgets && data.widgets.length > 0) setWidgets(data.widgets);
      }
      setTimeout(() => (isRemoteSync.current = false), 0);
    }, (err) => {
      console.warn('Firebase no disponible (sin billing). Usando base de datos local.', err?.code || err);
    });

    return () => unsub();
  }, [firebaseUser]);

  // Persist on changes (Firebase + IndexedDB local)
  const persist = useCallback(async () => {
    if (!firebaseUser || isRemoteSync.current || !isLoaded.current) return;

    const userId = firebaseUser.uid;

    // Guardar TODO en una sola escritura (evita condiciones de carrera)
    await saveLocalData({
      id: userId,
      settings,
      transactions,
      budgets,
      tabs,
      widgets,
    });

    // Intentar guardar en Firebase (solo funciona con billing)
    try {
      const ref = doc(db, 'users', userId);
      await setDoc(ref, { settings, transactions, budgets, tabs, widgets }, { merge: true });
    } catch {
      // Sin billing: los datos ya quedaron guardados en localStorage
    }
  }, [firebaseUser, settings, transactions, budgets, tabs, widgets]);

  // Un solo efecto: persiste cuando cualquier dato cambia
  useEffect(() => { persist(); }, [persist]);

  const handleLogin = (user: { uid: string; displayName: string; email: string }) => {
    setSettings((prev) => ({ ...prev, userName: user.displayName, userEmail: user.email }));
  };

  const handleLogout = async () => {
    // NO se borra la base de datos local: se conserva para que al
    // volver a iniciar sesión el usuario recupere todos sus datos.
    await signOut(auth);
    setFirebaseUser(null);
    setSettings(INITIAL_SETTINGS);
    setTransactions([]);
    setBudgets([]);
    setTabs(INITIAL_TABS);
    setWidgets(INITIAL_WIDGETS);
    isLoaded.current = false;
  };

  const handleSaveTransaction = (newTx: Transaction) => {
    setTransactions((prev) => [newTx, ...prev]);
  };
  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };
  const handleUpdateTransaction = (updated: Transaction) => {
    setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  if (!authReady) {
    return <div className="min-h-screen flex items-center justify-center text-zinc-500">Cargando...</div>;
  }

  if (!firebaseUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div
      className="true-tone-layer min-h-screen flex flex-col surface-page text-main"
      style={{ backgroundColor: isDark ? '#0a0a0b' : '#f8f9fa' }}
    >
      <HeaderNav
        theme={settings.theme}
        isDark={isDark}
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
            categories={allCategories}
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
            categories={allCategories}
            currencySymbol={settings.currencySymbol}
            verifyPassword={(p) => p === 'AppleSecure2026!'}
            dashboardGroups={settings.dashboardGroups}
            onUpdateDashboardGroups={(g) => setSettings((s) => ({ ...s, dashboardGroups: g }))}
            customCategories={settings.customCategories}
            onUpdateCustomCategories={(cats) => setSettings((s) => ({ ...s, customCategories: cats }))}
            onDeleteTransaction={handleDeleteTransaction}
            onUpdateTransaction={handleUpdateTransaction}
            onSave={handleSaveTransaction}
          />
        )}

        {activeTab === 'budgets' && (
          <BudgetView
            budgets={budgets}
            transactions={transactions}
            categories={allCategories}
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
        categories={allCategories}
        currencySymbol={settings.currencySymbol}
      />

      <ProfileModal
        open={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        settings={settings}
        transactions={transactions}
        categories={allCategories}
        currentPassword={settings.accountPassword || 'AppleSecure2026!'}
        onUpdateSettings={(s) => setSettings((prev) => ({ ...prev, ...s }))}
        onChangePassword={(oldP, newP) => {
          const current = settings.accountPassword || 'AppleSecure2026!';
          if (oldP !== current) return false;
          setSettings((prev) => ({ ...prev, accountPassword: newP }));
          return true;
        }}
        onDeleteCustomCategory={(id, deriveTo) => {
          const cat = settings.customCategories?.find((c) => c.id === id);
          setTransactions((prev) => prev.map((t) => (t.category === id ? { ...t, category: deriveTo || 'otro' } : t)));
          setSettings((prev) => {
            const groups = { ...(prev.dashboardGroups || {}) };
            if (cat?.name) delete groups[cat.name];
            return { ...prev, customCategories: (prev.customCategories || []).filter((c) => c.id !== id), dashboardGroups: groups };
          });
        }}
        onLogout={handleLogout}
      />
    </div>
  );
}