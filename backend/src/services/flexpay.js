// Paiement Mobile Money via FlexPay.
// Principe de sécurité : on ne croit JAMAIS ce que le navigateur ou l'appel
// de confirmation affirment. Le statut est toujours revérifié auprès de FlexPay.
const config = require('../config');

const TIMEOUT_MS = 30_000;

async function call(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: config.flexpay.token,
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

/** Numéro au format attendu par FlexPay : chiffres uniquement (ex. 243970000000). */
const normalizePhone = (phone) => String(phone).replace(/\D/g, '').replace(/^2430/, '243');

/**
 * Lance un paiement. Le client reçoit une demande de confirmation sur son téléphone.
 * @returns {{ accepted: boolean, orderNumber?: string, message?: string }}
 */
async function startPayment({ amount, currency, phone, reference }) {
  const { data } = await call(config.flexpay.paymentUrl, {
    method: 'POST',
    body: JSON.stringify({
      merchant: config.flexpay.merchant,
      type: '1', // 1 = Mobile Money
      phone: normalizePhone(phone),
      reference,
      amount: String(amount),
      currency,
      callbackUrl: config.flexpay.callbackUrl,
    }),
  });
  // FlexPay renvoie code "1" en cas d'erreur, et un orderNumber si la demande est acceptée.
  const accepted = String(data.code) !== '1' && Boolean(data.orderNumber);
  return { accepted, orderNumber: data.orderNumber, message: data.message };
}

/**
 * Demande à FlexPay le statut réel d'une transaction.
 * @returns {'success' | 'failed' | 'pending'}
 */
async function checkPayment(orderNumber) {
  const { ok, data } = await call(`${config.flexpay.checkUrl.replace(/\/$/, '')}/${encodeURIComponent(orderNumber)}`, {
    method: 'GET',
  });
  if (!ok) return 'pending';
  const status = data?.transaction?.status;
  if (status === undefined || status === null) return 'pending';
  if (String(status) === '0') return 'success';
  if (String(status) === '1') return 'failed';
  return 'pending'; // 2 = en attente chez FlexPay
}

module.exports = { startPayment, checkPayment, normalizePhone };
