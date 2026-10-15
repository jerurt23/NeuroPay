import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractAmountAndCurrency,
  classifyCategory,
  extractMerchant,
  parseBankEmail,
  createTransactionFromBankNotification,
} from './bankEmailParser.ts';

test('extractAmountAndCurrency: parses diverse currency formats', () => {
  const t1 = extractAmountAndCurrency('Has realizado un consumo de S/ 45.50 con tu tarjeta');
  assert.equal(t1.amount, 45.50);
  assert.equal(t1.currency, 'S/');

  const t2 = extractAmountAndCurrency('Compra aprobada en UBER por USD 18.25');
  assert.equal(t2.amount, 18.25);
  assert.equal(t2.currency, 'USD');

  const t3 = extractAmountAndCurrency('Pago en Farmacia por € 32.00');
  assert.equal(t3.amount, 32.00);
  assert.equal(t3.currency, '€');
});

test('classifyCategory: accurately categorizes keywords', () => {
  assert.equal(classifyCategory('Compra en UBER TRIP de Miraflores a San Isidro'), 'transporte');
  assert.equal(classifyCategory('Consumo en FARMACIA INKAFARMA Medicamentos'), 'medicina');
  assert.equal(classifyCategory('Pago en RESTAURANTE LA MAR Mariscos'), 'comida');
  assert.equal(classifyCategory('Consumo en STARBUCKS Coffee'), 'comida');
  assert.equal(classifyCategory('Factura de ENEL LUZ DEL SUR'), 'servicios');
});

test('extractMerchant: gets the merchant name cleanly', () => {
  const m1 = extractMerchant('Aviso de consumo: Has realizado un consumo en INKAFARMA con tu tarjeta');
  assert.ok(m1.includes('INKAFARMA'));

  const m2 = extractMerchant('Pago de US$ 12.00 en STARBUCKS COFFEE con Débito');
  assert.ok(m2.includes('STARBUCKS'));
});

test('parseBankEmail: processes a full BBVA Uber transport notification', () => {
  const parsed = parseBankEmail(
    'notificaciones@bbva.com',
    'Aviso de Consumo con Tarjeta',
    'Has realizado una compra en UBER TRIP desde Miraflores hacia San Isidro por USD 8.50'
  );

  assert.equal(parsed.bankName, 'BBVA');
  assert.equal(parsed.category, 'transporte');
  assert.equal(parsed.amount, 8.50);
  assert.equal(parsed.currency, 'USD');
  assert.ok(parsed.transportDetails);
  assert.equal(parsed.transportDetails?.origin, 'Miraflores');
  assert.equal(parsed.transportDetails?.destination, 'San Isidro');
  assert.equal(parsed.transportDetails?.transportMode, 'uber_cabify');

  const tx = createTransactionFromBankNotification(parsed);
  assert.equal(tx.amount, 8.50);
  assert.equal(tx.category, 'transporte');
  assert.equal(tx.transportDetails?.destination, 'San Isidro');
  assert.ok(tx.bankSyncMeta?.autoImported);
});

test('parseBankEmail: processes BCP medicine purchase notification', () => {
  const parsed = parseBankEmail(
    'alertas@bcp.com.pe',
    'Aviso de consumo con tarjeta Débito BCP',
    'Estimado cliente, registramos un consumo en INKAFARMA por S/ 38.00 el 15/10/2026'
  );

  assert.equal(parsed.bankName, 'BCP (Banco de Crédito)');
  assert.equal(parsed.category, 'medicina');
  assert.equal(parsed.amount, 38.00);
  assert.equal(parsed.currency, 'S/');
});
