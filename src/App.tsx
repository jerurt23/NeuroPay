import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { HeaderNav } from './components/HeaderNav.tsx';
import { TabBar } from './components/TabBar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { RegistroView } from './components/RegistroView.tsx';
import { BudgetView } from './components/BudgetView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
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
import { getLocalData, saveLocalData, findLegacyLocalData } from './lib/localDb';
import { cloudApi, fetchSessionUser, getSessionToken, signOutSession, type SessionUser } from './lib/session';
import { createCloudSyncer, resetRemote, type CloudSyncer, type SyncState } from './lib/cloudSync';
import { listGmailAccounts, removeGmailAccount } from './lib/gmail';

export default function App() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
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

  /**
   * Todos los botones "Nuevo" usan el mismo flujo: la pestaña Registro,
   * que empieza pidiendo la categoria (Comida, Transporte, Medicina,
   * Ingresos, tus categorias personalizadas...) y de ahi deriva el
   * formulario con los campos especificos de cada tipo.
   */
  const goToNewTransaction = useCallback(() => {
    setActiveTab('registro');
  }, []);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  // Al reiniciar se cambia la clave para que Registro empiece limpio (sin filas pendientes).
  const [resetCount, setResetCount] = useState(0);

  // isLoaded: los datos del navegador ya están cargados. Solo entonces se guarda y se sincroniza.
  const isLoaded = useRef(false);
  // Copia del estado que el motor de sincronización lee sin esperar al render.
  const estadoRef = useRef<SyncState>({
    settings: INITIAL_SETTINGS,
    transactions: [],
    budgets: [],
    tabs: INITIAL_TABS,
    widgets: INITIAL_WIDGETS,
  });
  const syncerRef = useRef<CloudSyncer | null>(null);

  // Temperatura de color (similar a True Tone). Se aplica como capa de
  // tinte translucida, no como filtro CSS: ver nota en index.css.
  const tempTint = useMemo(() => {
    if (settings.trueTone) return 'warm';
    return settings.colorTemperature || 'off';
  }, [settings.trueTone, settings.colorTemperature]);

  // Filtro suave adicional para el modo True Tone
  useEffect(() => {
    const filter =
      settings.trueTone && tempTint === 'warm'
        ? 'sepia(0.06) saturate(1.05) brightness(0.995)'
        : 'none';
    document.documentElement.style.setProperty('--truetone-filter', filter);
  }, [settings.trueTone, tempTint]);

  // Muestra un estado completo en pantalla y lo deja listo para la sincronización.
  const aplicarEstado = (s: SyncState) => {
    const completo: SyncState = { ...s, settings: { ...INITIAL_SETTINGS, ...s.settings } };
    estadoRef.current = completo;
    setSettings(completo.settings as UserSettings);
    setTransactions(completo.transactions as Transaction[]);
    setBudgets(completo.budgets as Budget[]);
    setTabs(completo.tabs as TabConfig[]);
    setWidgets(completo.widgets as WidgetConfig[]);
  };

  // Mantiene la copia que usa la sincronización igual a lo que se ve en pantalla.
  useEffect(() => {
    estadoRef.current = { settings, transactions, budgets, tabs, widgets } as SyncState;
  }, [settings, transactions, budgets, tabs, widgets]);

  // Al abrir la web se comprueba si hay una sesión guardada.
  useEffect(() => {
    let cancelado = false;
    fetchSessionUser()
      .then((user) => {
        if (!cancelado) setSessionUser(user);
      })
      .catch(() => {
        // Sin servidor: se muestra el inicio de sesión.
      })
      .finally(() => {
        if (!cancelado) setAuthReady(true);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // Al entrar: primero los datos del navegador (siempre disponibles) y después el
  // motor de sincronización, que trae los cambios hechos en otros dispositivos.
  useEffect(() => {
    if (!sessionUser) return;
    const usuario: SessionUser = sessionUser;
    let cancelado = false;
    isLoaded.current = false;

    (async () => {
      const local = (await getLocalData(usuario.uid)) ?? (await findLegacyLocalData(usuario.uid));
      if (cancelado) return;
      aplicarEstado({
        settings: {
          ...(local?.settings ?? {}),
          userName: usuario.name || local?.settings?.userName || '',
          userEmail: usuario.email,
        },
        transactions: local?.transactions ?? [],
        budgets: local?.budgets ?? [],
        tabs: local?.tabs ?? INITIAL_TABS,
        widgets: local?.widgets ?? INITIAL_WIDGETS,
      });
      isLoaded.current = true;

      const syncer = createCloudSyncer({
        uid: usuario.uid,
        getLocal: () => estadoRef.current,
        applyRemote: aplicarEstado,
        storage: window.localStorage,
        api: cloudApi,
        onSessionExpired: () => {
          void handleLogout();
        },
      });
      syncerRef.current = syncer;
      syncer.schedule(0);
    })();

    return () => {
      cancelado = true;
      syncerRef.current?.dispose();
      syncerRef.current = null;
    };
  }, [sessionUser]);

  // Cada cambio se guarda en el navegador y pide una sincronización con MongoDB
  // (con una pausa corta para agrupar varios cambios seguidos).
  useEffect(() => {
    if (!sessionUser || !isLoaded.current) return;
    void saveLocalData({ id: sessionUser.uid, settings, transactions, budgets, tabs, widgets });
    syncerRef.current?.schedule(1500);
  }, [sessionUser, settings, transactions, budgets, tabs, widgets]);

  const handleLogin = useCallback((user: SessionUser) => {
    setSessionUser(user);
  }, []);

  const handleLogout = async () => {
    // NO se borra la base de datos local: se conserva para que al
    // volver a iniciar sesión el usuario recupere todos sus datos.
    await signOutSession();
    setSessionUser(null);
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

  // Borra todo en la nube y en este dispositivo. Devuelve un aviso si Gmail no se pudo desconectar.
  const handleResetAll = async (): Promise<string | null> => {
    const token = getSessionToken();
    if (!sessionUser || !token) throw new Error('No hay sesión activa.');
    const vacio: SyncState = {
      settings: { ...INITIAL_SETTINGS, userName: settings.userName, userEmail: settings.userEmail },
      transactions: [],
      budgets: [],
      tabs: INITIAL_TABS,
      widgets: INITIAL_WIDGETS,
    };
    // Primero la nube: si falla, este dispositivo no cambia.
    await resetRemote({ uid: sessionUser.uid, vacio, storage: window.localStorage, api: cloudApi });
    aplicarEstado(vacio);
    setResetCount((n) => n + 1);
    try {
      const lista = await listGmailAccounts(token);
      if (!lista.ok) throw new Error(lista.error);
      for (const cuenta of lista.data.accounts) {
        const quitada = await removeGmailAccount(cuenta.id, token);
        if (!quitada.ok) throw new Error(quitada.error);
      }
      return null;
    } catch {
      return 'Se borraron tus datos, pero no se pudieron desconectar las cuentas de Gmail. Revísalas en "Sincronizar con correo".';
    }
  };

  if (!authReady) {
    return <div className="min-h-screen flex items-center justify-center text-zinc-500">Cargando...</div>;
  }

  if (!sessionUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <>
    {/* Capa de temperatura de color. pointer-events:none para no
        bloquear los toques en botones y enlaces. */}
    {tempTint !== 'off' && <div className={`temp-overlay ${tempTint}`} aria-hidden="true" />}

    <div className="true-tone-layer min-h-screen flex flex-col surface-page text-main">
      <HeaderNav
        userName={settings.userName || sessionUser.name || ''}
        userPhoto={settings.userPhoto}
        unreadCount={0}
        onOpenNotifications={() => {}}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      <main
        className="flex-1 max-w-5xl w-full mx-auto py-4 sm:py-6"
        style={{
          paddingLeft: 'calc(1rem + var(--safe-left))',
          paddingRight: 'calc(1rem + var(--safe-right))',
          // 6rem deja sitio a la barra de pestañas; se suma el inset inferior
          // para que la ultima tarjeta no quede bajo el indicador de inicio.
          paddingBottom: 'calc(6rem + var(--safe-bottom))',
        }}
      >
        {activeTab === 'dashboard' && (
          <DashboardView
            transactions={transactions}
            categories={allCategories}
            customCategories={settings.customCategories}
            dashboardGroups={settings.dashboardGroups}
            budgets={budgets}
            bankEmails={[]}
            currencySymbol={settings.currencySymbol}
            chartType={settings.chartType}
            onChartTypeChange={(t) => setSettings((s) => ({ ...s, chartType: t }))}
            onOpenNewTransaction={goToNewTransaction}
          />
        )}

        {activeTab === 'registro' && (
          <RegistroView
            key={resetCount}
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
        onOpenNewTransaction={goToNewTransaction}
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
        getIdToken={() => {
          const token = getSessionToken();
          return token ? Promise.resolve(token) : Promise.reject(new Error('No hay sesión activa.'));
        }}
        onImportTransactions={(txs) => setTransactions((prev) => [...txs, ...prev])}
        onDeleteCustomCategory={(id, deriveTo) => {
          const cat = settings.customCategories?.find((c) => c.id === id);
          setTransactions((prev) => prev.map((t) => (t.category === id ? { ...t, category: deriveTo || 'otro' } : t)));
          setSettings((prev) => {
            const groups = { ...(prev.dashboardGroups || {}) };
            if (cat?.name) delete groups[cat.name];
            return { ...prev, customCategories: (prev.customCategories || []).filter((c) => c.id !== id), dashboardGroups: groups };
          });
        }}
        onResetAll={handleResetAll}
        onLogout={handleLogout}
      />
    </div>
    </>
  );
}
