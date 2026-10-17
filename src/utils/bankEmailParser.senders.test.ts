import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBankEmail,
  extractAmountAndCurrency,
  detectTransactionType,
  isOutgoingPayment,
} from './bankEmailParser.ts';

// Formatos de ejemplo. Verificar con un correo real antes de confiar en el beneficiario.

test('Yape: pago enviado es un gasto con monto y beneficiario', () => {
  const p = parseBankEmail(
    'notificaciones@yape.pe',
    'Yapeaste S/ 35.00',
    'Yapeaste S/ 35.00 a JUAN PEREZ GARCIA. Nro. de operación 12345.',
    '2026-10-15'
  );
  assert.equal(p.bankName, 'Yape');
  assert.equal(p.amount, 35);
  assert.equal(p.type, 'expense');
  assert.equal(p.merchant, 'JUAN PEREZ GARCIA');
  assert.equal(isOutgoingPayment(p), true);
});

test('Yape: dinero recibido se descarta', () => {
  const p = parseBankEmail(
    'notificaciones@yape.pe',
    'Te yapearon S/ 50.00',
    'MARIA LOPEZ te envió S/ 50.00.',
    '2026-10-15'
  );
  assert.equal(p.type, 'income');
  assert.equal(isOutgoingPayment(p), false);
});

test('BCP: consumo con tarjeta es un gasto', () => {
  const p = parseBankEmail(
    'notificaciones@notificacionesbcp.com.pe',
    'Aviso de consumo con tarjeta Débito',
    'Consumo por S/ 1,250.00 en RESTAURANTE LA MAR con tu tarjeta.',
    '2026-10-15'
  );
  assert.equal(p.bankName, 'BCP (Banco de Crédito)');
  assert.equal(p.amount, 1250);
  assert.equal(isOutgoingPayment(p), true);
});

test('montos con separador de miles y decimal', () => {
  assert.equal(extractAmountAndCurrency('S/ 1,250.00').amount, 1250);
  assert.equal(extractAmountAndCurrency('S/ 1.250,50').amount, 1250.5);
  assert.equal(extractAmountAndCurrency('S/ 45,50').amount, 45.5);
  assert.equal(extractAmountAndCurrency('S/ 1250').amount, 1250);
});

test('detectTransactionType: entradas y salidas', () => {
  assert.equal(detectTransactionType('Recibiste S/ 200 de Pedro'), 'income');
  assert.equal(detectTransactionType('Pagaste S/ 20 a Pedro'), 'expense');
});
