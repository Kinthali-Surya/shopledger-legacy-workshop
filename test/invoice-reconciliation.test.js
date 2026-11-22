const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function riceItem(price, qty) {
  return {
    id: 1,
    name: 'Rice',
    sku: 'GRN-001',
    hsn: '1006',
    price: price,
    qty: qty
  };
}

test('CURRENT BEHAVIOUR: ledger pricing uses the HSN GST slab and taxes after coupon discount', function () {
  const totals = pricing.computeTotals([riceItem(1000, 1)], 'SAVE10');

  assert.deepEqual({
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxable: totals.taxable,
    tax: totals.tax,
    total: totals.total,
    gstPercent: totals.lines[0].gstPercent
  }, {
    subtotal: 1000,
    discount: 100,
    taxable: 900,
    tax: 45,
    total: 945,
    gstPercent: 5
  });
});

test('invoice calculation uses the same HSN GST slab as the billed ledger', function () {
  const figures = invoice.computeInvoiceFigures({
    items: [riceItem(1000, 1)],
    coupon: ''
  });

  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    total: figures.total,
    gstPercent: figures.rows[0].gstPercent
  }, {
    subtotal: 1000,
    discount: 0,
    tax: 50,
    total: 1050,
    gstPercent: 5
  });
});

test('invoice percentage coupon matches the billed ledger discount and total', function () {
  const figures = invoice.computeInvoiceFigures({
    items: [riceItem(1000, 1)],
    coupon: 'SAVE10'
  });

  assert.deepEqual({
    discount: figures.discount,
    tax: figures.tax,
    total: figures.total
  }, {
    discount: 100,
    tax: 45,
    total: 945
  });
});

test('reconciliation reports matching invoice and ledger totals for an in-memory order', function () {
  const order = {
    id: 9001,
    date: '22/11/2026',
    customer: 'Test Customer',
    status: 'completed',
    items: [riceItem(1000, 1)],
    coupon: 'SAVE10',
    subtotal: 1000,
    discount: 100,
    tax: 45,
    total: 945
  };

  const result = reports.getGstReconciliation({
    orders: [order],
    products: [],
    customers: []
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows[0], {
    orderId: 9001,
    date: '22/11/2026',
    customer: 'Test Customer',
    coupon: 'SAVE10',
    ledgerSubtotal: 1000,
    ledgerDiscount: 100,
    ledgerTax: 45,
    ledgerTotal: 945,
    invoiceDiscount: 100,
    invoiceTax: 45,
    invoiceTotal: 945,
    delta: 0,
    matched: true
  });
});

test('CURRENT BEHAVIOUR: reconciliation skips cancelled in-memory orders', function () {
  const result = reports.getGstReconciliation({
    orders: [{
      id: 9002,
      status: 'cancelled',
      items: [riceItem(1000, 1)],
      coupon: '',
      subtotal: 1000,
      discount: 0,
      tax: 50,
      total: 1050
    }],
    products: [],
    customers: []
  });

  assert.deepEqual(result, {
    totalChecked: 0,
    mismatchCount: 0,
    totalDelta: 0,
    rows: []
  });
});
