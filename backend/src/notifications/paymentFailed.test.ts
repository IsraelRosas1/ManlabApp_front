import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPaymentFailedNotification } from './paymentFailed';

test('buildPaymentFailedNotification sets a friendly title and message for failed invoice events', () => {
  const payload = buildPaymentFailedNotification({
    customerEmail: 'user@example.com',
    subscriptionStatus: 'past_due',
    failedAttempts: 2,
    planCode: 'mensual',
  });

  assert.equal(payload.title, 'Tu pago no pudo procesarse');
  assert.match(payload.message, /Mensual|mensual/i);
  assert.match(payload.message, /pago/i);
});
