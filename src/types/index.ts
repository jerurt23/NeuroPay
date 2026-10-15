export type TransactionType = 'expense' | 'income';

export type StandardCategory = 
  | 'comida' 
  | 'medicina' 
  | 'transporte' 
  | 'servicios' 
  | 'hogar' 
  | 'ocio' 
  | 'tecnologia' 
  | 'otro';

export type TransportMode = 'taxi' | 'metro' | 'bus' | 'bicicleta' | 'combustible' | 'uber_cabify' | 'tren';

export interface TransportDetails {
  origin: string;
  destination: string;
  distanceKm?: number;
  transportMode: TransportMode;
  returnTrip?: boolean;
}

export interface MedicineDetails {
  pharmacy?: string;
  prescriptionNeeded?: boolean;
  doseNotes?: string;
}

export interface FoodDetails {
  placeType?: 'supermercado' | 'restaurante' | 'delivery' | 'cafeteria' | 'mercado';
  meal?: 'desayuno' | 'almuerzo' | 'cena' | 'snack';
}

export interface BankSyncMeta {
  bankName: string;
  emailSender: string;
  rawSnippet: string;
  syncedAt: string;
  autoImported: boolean;
}

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: StandardCategory | string;
  date: string; // ISO date YYYY-MM-DD
  time?: string; // HH:mm
  paymentMethod: 'tarjeta_credito' | 'tarjeta_debito' | 'transferencia' | 'efectivo' | 'banca_movil';
  notes?: string;
  tags?: string[];
  quantity?: number;
  unit?: string;
  transportDetails?: TransportDetails;
  medicineDetails?: MedicineDetails;
  foodDetails?: FoodDetails;
  bankSyncMeta?: BankSyncMeta;
  synapseWeight?: number; // Calculated dynamic neural weight
}

export interface CategoryInfo {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

export interface Budget {
  id: string;
  categoryId: string; // 'all' or category id
  name: string;
  monthlyLimit: number;
  currentSpent: number;
  periodMonth: string; // YYYY-MM
  alertThreshold: number; // e.g., 0.8 (80%)
}

export interface BankEmail {
  id: string;
  bankName: string;
  senderEmail: string;
  subject: string;
  bodySnippet: string;
  parsedAmount: number;
  parsedCurrency: string;
  parsedDate: string;
  parsedMerchant: string;
  parsedCategory: StandardCategory | string;
  status: 'synced' | 'pending' | 'ignored';
  rawHtml?: string;
}

export type WidgetType = 
  | 'balance' 
  | 'neural' 
  | 'recent' 
  | 'routes' 
  | 'budget' 
  | 'bank_sync' 
  | 'metrics' 
  | 'top_category';

export type WidgetSize = 'small' | 'medium' | 'large';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  size: WidgetSize;
  enabled: boolean;
  order: number;
}

export interface TabConfig {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  isCustom?: boolean;
  order: number;
}

export type ThemeMode = 'light' | 'dark' | 'auto';
export type ViewportMode = 'native' | 'iphone' | 'ipad' | 'macbook';

export interface UserSettings {
  userName: string;
  userEmail: string;
  currencySymbol: string;
  theme: ThemeMode;
  trueTone: boolean;
  e2eeEnabled: boolean;
  pushNotifications: boolean;
  biometricUnlock: boolean;
  viewportMode: ViewportMode;
  autoSyncBankEmails: boolean;
  userPhoto?: string;
  accountPassword?: string;
  chartType?: 'bar' | 'line';
  countryCode?: string;
}
