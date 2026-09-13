/**
 * Branded email templates for TowelCrafts.
 *
 * Design language: "quiet editorial luxury" — warm bone paper, deep forest
 * ink, muted antique brass. Serif display headings (with sans-serif email
 * fallbacks), generous negative space.
 *
 * Implementation notes:
 *  - Email clients are not browsers. Everything uses table-based layout and
 *    inline styles; no flexbox, grid, or external CSS.
 *  - Colors mirror the app's design tokens (see src/index.css).
 */

// ── Brand tokens (mirrors src/index.css) ─────────────────────────
const C = {
  ink: '#24281F',
  forest: '#33402B',
  forestDark: '#202719',
  brass: '#9B7B4A',
  brassLight: '#B89A6B',
  paper: '#F5F2EA',
  paperWarm: '#EDE9DD',
  card: '#FCFBF6',
  white: '#FFFFFF',
  border: '#DCD7C8',
  borderLight: '#E7E2D4',
  textSecondary: '#4B5341',
  textLight: '#6C7360',
  textMuted: '#9AA08C',
  success: '#4A7C59',
};

const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif";
const SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(d) {
  try {
    return new Date(d || Date.now()).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

const PAYMENT_LABELS = {
  cod: 'Cash on Delivery',
  online: 'Paid Online',
  upi: 'UPI',
  card: 'Card',
};

/**
 * Build the order-confirmation email (subject + html + text).
 *
 * @param {Object} p
 * @param {string} p.customerName
 * @param {Object} p.order  Saved order document (plain or mongoose doc)
 * @param {string} [p.storeUrl]
 */
function orderConfirmationEmail({ customerName, order, storeUrl }) {
  const store = storeUrl || process.env.STORE_URL || 'http://localhost:3000';
  const orderNumber = order.orderNumber || String(order._id || '').slice(-8).toUpperCase();
  const items = Array.isArray(order.orderItems) && order.orderItems.length
    ? order.orderItems
    : [
        {
          title: order.title || 'Item',
          quantity: order.quantity || 1,
          price: order.subtotal || order.totalPrice || 0,
        },
      ];

  const addr = order.shippingAddress || {};
  const addressLines = [
    addr.addressLine,
    [addr.city, addr.state].filter(Boolean).join(', '),
    [addr.pincode, addr.country].filter(Boolean).join(', '),
  ].filter(Boolean);

  const paymentLabel = PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod || '—';
  const firstName = (customerName || 'there').trim().split(/\s+/)[0];

  // ── Line-item rows ──────────────────────────────────────────────
  const itemRows = items
    .map((it, i) => {
      const lineTotal = Number(it.price || 0) * Number(it.quantity || 1);
      const topBorder = i === 0 ? 'none' : `1px solid ${C.borderLight}`;
      return `
      <tr>
        <td style="padding:16px 0;border-top:${topBorder};font-family:${SANS};font-size:15px;color:${C.ink};line-height:1.4;">
          <span style="display:block;font-weight:600;">${esc(it.title)}</span>
          <span style="display:block;font-size:13px;color:${C.textLight};margin-top:2px;">Qty ${esc(it.quantity || 1)} &nbsp;·&nbsp; ${inr(it.price)} each</span>
        </td>
        <td align="right" style="padding:16px 0;border-top:${topBorder};font-family:${SANS};font-size:15px;font-weight:600;color:${C.forest};white-space:nowrap;vertical-align:top;">
          ${inr(lineTotal)}
        </td>
      </tr>`;
    })
    .join('');

  // ── Totals ──────────────────────────────────────────────────────
  const totalsRow = (label, value, opts = {}) => {
    const labelStyle = opts.strong
      ? `padding:14px 0 0;font-family:${SANS};font-size:16px;color:${C.ink};font-weight:600;border-top:1px solid ${C.border};`
      : `padding:6px 0;font-family:${SANS};font-size:14px;color:${C.textLight};`;
    const valueStyle = opts.strong
      ? `padding:14px 0 0;font-family:${SERIF};font-size:18px;color:${C.forest};font-weight:700;border-top:1px solid ${C.border};white-space:nowrap;`
      : `padding:6px 0;font-family:${SANS};font-size:14px;color:${C.ink};white-space:nowrap;`;
    return `
    <tr>
      <td style="${labelStyle}">${esc(label)}</td>
      <td align="right" style="${valueStyle}">${value}</td>
    </tr>`;
  };

  let totalsInner = totalsRow('Subtotal', inr(order.subtotal ?? order.totalPrice));
  if (order.shippingCharge) totalsInner += totalsRow('Shipping', inr(order.shippingCharge));
  if (order.tax) totalsInner += totalsRow('Tax', inr(order.tax));
  if (order.discount) totalsInner += totalsRow('Discount', '– ' + inr(order.discount));
  totalsInner += totalsRow('Total', inr(order.totalPrice), { strong: true });

  const addressBlock = addressLines
    .map((l) => `<span style="display:block;font-family:${SANS};font-size:14px;color:${C.textSecondary};line-height:1.6;">${esc(l)}</span>`)
    .join('');

  const subject = `Your TowelCrafts order ${orderNumber} is confirmed`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.paperWarm};-webkit-font-smoothing:antialiased;">
  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${C.paperWarm};">
    Thank you, ${esc(firstName)} — order ${esc(orderNumber)} is confirmed and being prepared.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.paperWarm};padding:32px 12px;">
    <tr>
      <td align="center">
        <!-- Card -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:${C.card};border:1px solid ${C.border};border-radius:4px;overflow:hidden;">

          <!-- Header band -->
          <tr>
            <td style="background-color:${C.forestDark};padding:36px 40px 30px;text-align:center;">
              <div style="font-family:${SANS};font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:${C.brassLight};margin-bottom:10px;">
                TowelCrafts
              </div>
              <div style="font-family:${SERIF};font-size:30px;font-weight:400;color:${C.white};line-height:1.15;">
                Order Confirmed
              </div>
              <div style="width:44px;height:2px;background-color:${C.brass};margin:16px auto 0;"></div>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="padding:36px 40px 8px;">
              <p style="margin:0 0 14px;font-family:${SERIF};font-size:22px;color:${C.forest};font-weight:400;">
                Thank you, ${esc(firstName)}.
              </p>
              <p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.textSecondary};">
                We've received your order and it's now being prepared with care. Here's a summary of your purchase.
              </p>
            </td>
          </tr>

          <!-- Order meta -->
          <tr>
            <td style="padding:26px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.paper};border:1px solid ${C.borderLight};border-radius:4px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <span style="display:block;font-family:${SANS};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${C.textMuted};margin-bottom:4px;">Order Number</span>
                    <span style="display:block;font-family:${SERIF};font-size:18px;color:${C.forest};font-weight:400;">${esc(orderNumber)}</span>
                  </td>
                  <td align="right" style="padding:16px 20px;">
                    <span style="display:block;font-family:${SANS};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${C.textMuted};margin-bottom:4px;">Placed On</span>
                    <span style="display:block;font-family:${SANS};font-size:15px;color:${C.ink};font-weight:500;">${esc(formatDate(order.createdAt))}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Items -->
          <tr>
            <td style="padding:30px 40px 0;">
              <div style="font-family:${SANS};font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:${C.brass};font-weight:600;padding-bottom:6px;border-bottom:2px solid ${C.forest};">
                Your Items
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${itemRows}
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding:8px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${totalsInner}
              </table>
            </td>
          </tr>

          <!-- Shipping + payment -->
          <tr>
            <td style="padding:32px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="55%" valign="top" style="padding-right:16px;">
                    <div style="font-family:${SANS};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.textMuted};font-weight:600;margin-bottom:10px;">Shipping To</div>
                    ${addressBlock || `<span style="font-family:${SANS};font-size:14px;color:${C.textLight};">On file</span>`}
                  </td>
                  <td width="45%" valign="top">
                    <div style="font-family:${SANS};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.textMuted};font-weight:600;margin-bottom:10px;">Payment</div>
                    <span style="display:block;font-family:${SANS};font-size:14px;color:${C.textSecondary};line-height:1.6;">${esc(paymentLabel)}</span>
                    <span style="display:inline-block;margin-top:8px;font-family:${SANS};font-size:12px;font-weight:600;color:${C.success};">● Order placed</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:34px 40px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:2px;background-color:${C.forest};">
                    <a href="${esc(store)}/account/orders" target="_blank"
                       style="display:inline-block;padding:14px 34px;font-family:${SANS};font-size:14px;font-weight:600;letter-spacing:0.04em;color:${C.white};text-decoration:none;">
                      View Your Order
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Note -->
          <tr>
            <td style="padding:20px 40px 36px;">
              <p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.textLight};text-align:center;">
                We'll send another note the moment your order ships. Questions in the meantime? Simply reply to this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:${C.paper};border-top:1px solid ${C.borderLight};padding:26px 40px;text-align:center;">
              <div style="font-family:${SERIF};font-size:16px;color:${C.forest};margin-bottom:6px;">TowelCrafts</div>
              <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.textMuted};">
                Considered towels, woven for everyday ritual.<br>
                © ${new Date().getFullYear()} TowelCrafts. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // ── Plain-text fallback ─────────────────────────────────────────
  const textLines = [
    `TOWELCRAFTS — ORDER CONFIRMED`,
    ``,
    `Thank you, ${firstName}.`,
    `We've received your order and it's being prepared.`,
    ``,
    `Order number: ${orderNumber}`,
    `Placed on: ${formatDate(order.createdAt)}`,
    ``,
    `ITEMS`,
    ...items.map(
      (it) => `  - ${it.title}  (Qty ${it.quantity || 1})  ${inr(Number(it.price || 0) * Number(it.quantity || 1))}`
    ),
    ``,
    `Total: ${inr(order.totalPrice)}`,
    `Payment: ${paymentLabel}`,
    ``,
    addressLines.length ? `Shipping to:\n  ${addressLines.join('\n  ')}` : '',
    ``,
    `View your order: ${store}/account/orders`,
    ``,
    `We'll email you again when it ships.`,
    `© ${new Date().getFullYear()} TowelCrafts`,
  ].filter((l) => l !== undefined);

  return { subject, html, text: textLines.join('\n') };
}

module.exports = { orderConfirmationEmail };
