import type { StandardCategory, Transaction, TransactionType } from '../types/index.ts';

export interface ParsedBankNotification {
  bankName: string;
  senderEmail: string;
  subject: string;
  amount: number;
  currency: string;
  merchant: string;
  type: TransactionType;
  category: StandardCategory;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  transportDetails?: {
    origin: string;
    destination: string;
    transportMode: 'taxi' | 'metro' | 'bus' | 'bicicleta' | 'combustible' | 'uber_cabify';
  };
  confidence: number;
  rawSnippet: string;
}

const CATEGORY_RULES: Record<StandardCategory, RegExp[]> = {
  comida: [
    /rappi|pedidosya|uber eats|didi food|glovo/i,
    /restaurante|restaurant|bistro|trattoria|pizzeria|cebicheria|cafeteria|cafe|bakery|panaderia/i,
    /starbucks|mc donalds|mcdonalds|burger king|kfc|wendys|subway|dominos|pizza hut/i,
    /supermercado|supermarket|wong|metro|tottus|plaza vea|vivanda|walmart|carrefour|oxxo|tambo/i,
  ],
  medicina: [
    /farmacia|farmacias|farma|botica|botic|boticas/i,
    /inkafarma|mifarma|farmapront|cvs|walgreens|boots/i,
    /clinica|hospital|laboratorio|analisis clinico|oftalmolog|odontolog|pediatra|salud|medic/i,
  ],
  transporte: [
    /uber\s*trip|uber\s*rides|cabify|didi|beat|indrive|easytaxi/i,
    /taxi|remisse|metro|subway|tren|autobus|bus|linea 1|metropolitano/i,
    /gasolina|combustible|grifo|gasolinera|estacion de servicio|repsol|primax|petroperu|shell|chevron|texaco/i,
    /peaje|autopista|estacionamiento|parking|parquimetro/i,
  ],
  servicios: [
    /luz|agua|electricidad|enel|luz del sur|sedapal|aguas/i,
    /claro|movistar|entel|at&t|verizon|vodafone|t-mobile|internet|fibra/i,
    /netflix|spotify|disney|hbo|youtube premium|apple\.com\/bill|icloud|google storage|amazon prime/i,
    /aws|azure|github|digitalocean|openai/i,
  ],
  hogar: [
    /sodimac|maestro|home depot|ikea|easy|ferreteria|muebleria|decoracion/i,
    /lavanderia|tintoreria|mantenimiento hogar|cerrajero/i,
  ],
  ocio: [
    /cine|cineplanet|cinemark|cinemex|steam|playstation|nintendo|xbox/i,
    /concierto|ticketmaster|teleticket|bar|discoteca|teatro|museo/i,
  ],
  tecnologia: [
    /apple store|istore|samsung|sony|lenovo|dell|xiaomi|best buy|coolbox/i,
  ],
  otro: [],
};

/*
 * Remitentes de los avisos. Yape y BCP son los que confirmo el usuario;
 * el resto son los bancos ya soportados.
 */
const BANK_PATTERNS = [
  {
    bankName: 'Yape',
    senderPattern: /notificaciones@yape\.pe/i,
    subjectPattern: /yape/i,
  },
  {
    bankName: 'BBVA',
    senderPattern: /bbva|notificaciones@bbva/i,
    subjectPattern: /consumo|compra|cargo|notificaci[oó]n/i,
  },
  {
    bankName: 'BCP (Banco de Crédito)',
    senderPattern: /bcp|notificaciones@notificacionesbcp\.com\.pe|notificaciones@bancobcp|alertas@bcp/i,
    subjectPattern: /aviso de consumo|cargo con tarjeta|transferencia/i,
  },
  {
    bankName: 'Interbank',
    senderPattern: /interbank|alertas@interbank/i,
    subjectPattern: /alerta de consumo|pago realizado|transferencia/i,
  },
  {
    bankName: 'Santander',
    senderPattern: /santander/i,
    subjectPattern: /cargo|compra autorizada|movimiento/i,
  },
  {
    bankName: 'Nu Bank',
    senderPattern: /nubank|no-reply@nu\b/i,
    subjectPattern: /compra aprobada|nueva compra/i,
  },
  {
    bankName: 'Scotiabank',
    senderPattern: /scotiabank/i,
    subjectPattern: /aviso de operaci[oó]n|consumo/i,
  },
  {
    bankName: 'Chase',
    senderPattern: /chase|jpmorgan/i,
    subjectPattern: /transaction alert|account alert/i,
  },
  {
    bankName: 'Mercado Pago',
    senderPattern: /mercadopago|mercado libre/i,
    subjectPattern: /pagaste|transferiste|recibiste/i,
  },
];

/** Numero con separador de miles y decimal opcional: 1,250.00 | 1.250,50 | 45.50 | 1250 */
const NUM = '(\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)';

const AMOUNT_RULES: RegExp[] = [
  new RegExp(`(?:S\\/\\.?|PEN)\\s*${NUM}`, 'i'),
  new RegExp(`(?:US\\$|USD|\\$)\\s*${NUM}`, 'i'),
  new RegExp(`${NUM}\\s*(?:USD|US\\$|\\$|d[oó]lares)`, 'i'),
  new RegExp(`${NUM}\\s*(?:S\\/\\.?|PEN|soles)`, 'i'),
  new RegExp(`${NUM}\\s*(?:EUR|€|euros)`, 'i'),
  new RegExp(`€\\s*${NUM}`, 'i'),
  new RegExp(`por\\s+(?:un valor de\\s+)?${NUM}`, 'i'),
];

/** Convierte "1,250.00", "1.250,50", "45,50" o "45.50" en numero. */
function normalizeNumber(raw: string): number {
  let s = raw.trim();
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    // El separador que va al final es el decimal; el otro es de miles
    s = lastDot > lastComma ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  } else if (lastComma !== -1) {
    const decimals = s.length - lastComma - 1;
    s = decimals === 3 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (lastDot !== -1) {
    const decimals = s.length - lastDot - 1;
    if (decimals === 3) s = s.replace(/\./g, '');
  }
  return parseFloat(s);
}

/**
 * Extracts numeric amount and currency from notification text
 */
export function extractAmountAndCurrency(text: string): { amount: number; currency: string } {
  for (const rx of AMOUNT_RULES) {
    const match = text.match(rx);
    if (match && match[1]) {
      const val = normalizeNumber(match[1]);
      if (!isNaN(val) && val > 0) {
        let currency = '$';
        if (/S\/\.?|PEN|soles/i.test(match[0])) currency = 'S/';
        else if (/EUR|€|euros/i.test(match[0])) currency = '€';
        else if (/US\$|USD|d[oó]lares/i.test(match[0])) currency = 'USD';
        return { amount: Number(val.toFixed(2)), currency };
      }
    }
  }

  // Respaldo: cualquier numero con dos decimales
  const generic = text.match(/\b(\d{1,5}[.,]\d{2})\b/);
  if (generic) {
    const val = normalizeNumber(generic[1]);
    if (!isNaN(val)) return { amount: Number(val.toFixed(2)), currency: '$' };
  }

  return { amount: 0, currency: '$' };
}

/**
 * Categorizes an expense based on merchant or description text
 */
export function classifyCategory(text: string): StandardCategory {
  const normalized = text.toLowerCase();

  for (const [category, patterns] of Object.entries(CATEGORY_RULES) as [StandardCategory, RegExp[]][]) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        return category;
      }
    }
  }

  return 'otro';
}

/**
 * Extracts merchant/recipient name from bank alert text
 */
export function extractMerchant(text: string): string {
  // "en UBER TRIP", "en INKAFARMA", "establecimiento: STARBUCKS", "a NOMBRE APELLIDO"
  const patterns = [
    /(?:en|establecimiento:|comercio:|lugar:)\s+([A-Za-z0-9\s*.\-_#]{3,35}?)(?=\s+(?:con|por|el|la|desde|tarjeta|saldo|\.|\n|$))/i,
    /(?:transferencia a|pago a|enviaste a)\s+([A-Za-z0-9\s]{3,35}?)(?=\s+(?:por|el|\.|\n|$))/i,
    /(?:de|at)\s+([A-Za-z0-9\s*.\-_#]{3,35}?)(?=\s+(?:with|for|on|\.|\n|$))/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const clean = m[1].trim().replace(/^[:\-\s]+|[:\-\s]+$/g, '');
      if (clean.length >= 3 && !/tarjeta|cuenta|banca|soles|dolares/i.test(clean)) {
        return clean;
      }
    }
  }

  return 'Comercio / Banca Móvil';
}

/**
 * Beneficiario de un pago enviado con Yape: "Yapeaste S/ 35.00 a JUAN PEREZ".
 * El formato exacto del correo no esta verificado: se prueba con variantes.
 */
export function extractYapeRecipient(text: string): string | undefined {
  const pattern =
    /(?:yapeaste|enviaste|pagaste|transferiste)\s+(?:S\/\.?\s*[\d.,]+\s+)?(?:a|para)\s+([^\n.,;]{3,40}?)(?=\s*(?:\.|,|;|\n|$|nro|n°|operaci|con\s))/i;

  const m = text.match(pattern);
  if (m && m[1]) {
    const name = m[1].trim();
    if (name.length >= 3 && !/tarjeta|cuenta|banca/i.test(name)) return name;
  }
  return undefined;
}

/**
 * Detects if a notification is income or expense
 */
export function detectTransactionType(text: string): TransactionType {
  const incomeKeywords =
    /abono|dep[oó]sito|recibiste|transferencia recibida|pago recibido|te (?:yapearon|transfirieron|envi[oó])|sueldo|devoluci[oó]n|reembolso|acreditado|\bingreso\b/i;
  if (incomeKeywords.test(text)) {
    return 'income';
  }
  return 'expense';
}

/**
 * Extracts transport route if present (e.g. from Uber/Cabify notification or route text)
 */
export function extractTransportRoute(text: string): { origin: string; destination: string; transportMode: 'taxi' | 'metro' | 'bus' | 'bicicleta' | 'combustible' | 'uber_cabify' } | undefined {
  const isUber = /uber/i.test(text);
  const isCabify = /cabify|didi/i.test(text);
  const isMetro = /metro|subway|tren/i.test(text);
  const isBus = /bus|autobus/i.test(text);

  let mode: 'taxi' | 'metro' | 'bus' | 'bicicleta' | 'combustible' | 'uber_cabify' = 'taxi';
  if (isUber || isCabify) mode = 'uber_cabify';
  else if (isMetro) mode = 'metro';
  else if (isBus) mode = 'bus';

  // Specific "desde X hacia Y" or "desde X a Y"
  const desdeMatch = text.match(/desde\s+([A-Za-z0-9\s]{3,30}?)\s+(?:hacia|hasta|a)\s+([A-Za-z0-9\s]{3,30}?)(?=\s+(?:por|el|\.|\n|$))/i);
  if (desdeMatch && desdeMatch[1] && desdeMatch[2]) {
    return {
      origin: desdeMatch[1].trim(),
      destination: desdeMatch[2].trim(),
      transportMode: mode,
    };
  }

  // "origen: X, destino: Y"
  const origenDestinoMatch = text.match(/origen:\s*([A-Za-z0-9\s]+?)[,;\-]\s*destino:\s*([A-Za-z0-9\s]+)/i);
  if (origenDestinoMatch && origenDestinoMatch[1] && origenDestinoMatch[2]) {
    return {
      origin: origenDestinoMatch[1].trim(),
      destination: origenDestinoMatch[2].trim(),
      transportMode: mode,
    };
  }

  if (isUber || isCabify) {
    return {
      origin: 'Punto de partida',
      destination: 'Punto de llegada',
      transportMode: 'uber_cabify',
    };
  }

  return undefined;
}

/**
 * Main parser function to parse bank email notification
 */
export function parseBankEmail(
  senderEmail: string,
  subject: string,
  bodySnippet: string,
  dateISO?: string
): ParsedBankNotification {
  const fullText = `${subject} ${bodySnippet}`;

  // Detect Bank Name: First prioritize sender match
  let bankName = 'Banca Móvil';
  for (const b of BANK_PATTERNS) {
    if (b.senderPattern.test(senderEmail)) {
      bankName = b.bankName;
      break;
    }
  }

  // If sender was generic, check explicit bank names in text
  if (bankName === 'Banca Móvil') {
    for (const b of BANK_PATTERNS) {
      if (b.senderPattern.test(fullText)) {
        bankName = b.bankName;
        break;
      }
    }
  }

  // Fallback to subject patterns
  if (bankName === 'Banca Móvil') {
    for (const b of BANK_PATTERNS) {
      if (b.subjectPattern.test(subject)) {
        bankName = b.bankName;
        break;
      }
    }
  }

  const { amount, currency } = extractAmountAndCurrency(fullText);
  const type = detectTransactionType(fullText);
  const recipient = bankName === 'Yape' ? extractYapeRecipient(fullText) : undefined;
  const merchant = recipient ?? extractMerchant(fullText);
  const category = classifyCategory(`${merchant} ${fullText}`);
  const transportDetails = category === 'transporte' ? extractTransportRoute(fullText) : undefined;

  const today = dateISO || new Date().toISOString().split('T')[0];
  const nowTime = new Date().toTimeString().slice(0, 5);

  let confidence = 0.5;
  if (amount > 0) confidence += 0.3;
  if (bankName !== 'Banca Móvil') confidence += 0.15;
  if (merchant !== 'Comercio / Banca Móvil') confidence += 0.15;
  confidence = Math.min(1.0, confidence);

  return {
    bankName,
    senderEmail,
    subject,
    amount: amount || 0,
    currency,
    merchant,
    type,
    category,
    date: today,
    time: nowTime,
    transportDetails,
    confidence,
    rawSnippet: bodySnippet.slice(0, 200),
  };
}

/** Solo cuentan los cargos y pagos enviados: se descartan ingresos y montos vacios. */
export function isOutgoingPayment(parsed: ParsedBankNotification): boolean {
  return parsed.type === 'expense' && parsed.amount > 0;
}

/**
 * Converts a parsed bank notification into a full Transaction
 */
export function createTransactionFromBankNotification(notif: ParsedBankNotification): Transaction {
  const id = `tx_bank_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  return {
    id,
    title: notif.merchant !== 'Comercio / Banca Móvil' ? notif.merchant : `${notif.bankName} - ${notif.category.toUpperCase()}`,
    amount: notif.amount,
    type: notif.type,
    category: notif.category,
    date: notif.date,
    time: notif.time,
    paymentMethod: 'banca_movil',
    notes: `Sincronizado automáticamente desde alerta de correo de ${notif.bankName}. Asunto: "${notif.subject}"`,
    tags: ['banca-movil', notif.bankName.toLowerCase().replace(/\s+/g, '-'), 'auto-sync'],
    transportDetails: notif.transportDetails,
    bankSyncMeta: {
      bankName: notif.bankName,
      emailSender: notif.senderEmail,
      rawSnippet: notif.rawSnippet,
      syncedAt: new Date().toISOString(),
      autoImported: true,
    },
    synapseWeight: Math.min(100, Math.max(10, Math.round(notif.amount * 1.5))),
  };
}
