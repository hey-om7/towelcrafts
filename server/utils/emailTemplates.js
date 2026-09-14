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
  error: '#A24B47',
  info: '#5A7A8C',
};

const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif";
const SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

/**
 * Brand logo, embedded directly in each email as a CID (Content-ID)
 * attachment.
 *
 * Rather than linking to a hosted URL — which many mail clients block or fail
 * to load — the logo bytes travel with the message and the HTML references
 * them via `cid:`. This renders reliably across Gmail, Outlook, Apple Mail,
 * etc. without any external request. `getLogoAttachment()` returns the
 * nodemailer attachment descriptor that every template ships with its output.
 */
const path = require('path');

// Stable Content-ID referenced by the <img> tags below.
const LOGO_CID = 'towelcrafts-logo';
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'email', 'towelcrafts-logo.png');

/**
 * The nodemailer attachment descriptor for the embedded logo. Spread into the
 * `attachments` array so the mailer can inline it via its Content-ID.
 */
function getLogoAttachment() {
  return {
    filename: 'towelcrafts-logo.png',
    path: LOGO_PATH,
    cid: LOGO_CID,
    contentType: 'image/png',
  };
}

/**
 * Renders the header brand lockup: the embedded logo mark above the uppercase
 * letterspaced wordmark. Used inside every email's dark header band. The logo
 * is referenced via `cid:` and always accompanied by the wordmark, so the
 * brand still reads even if a client suppresses inline images.
 *
 * @param {string} [eyebrow]  Wordmark text (e.g. 'TowelCrafts' or
 *                            'TowelCrafts · Security'). The logo's alt text is
 *                            always the plain brand name.
 */
function brandLockup(eyebrow = 'TowelCrafts') {
  const mark = `<img src="cid:${LOGO_CID}" width="52" height="52" alt="TowelCrafts"
           style="display:block;margin:0 auto 14px;width:52px;height:52px;border:0;outline:none;text-decoration:none;">`;
  return `${mark}<div style="font-family:${SANS};font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:${C.brassLight};margin-bottom:10px;">
                ${esc(eyebrow)}
              </div>`;
}

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
              ${brandLockup('TowelCrafts')}
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

  return { subject, html, text: textLines.join('\n'), attachments: [getLogoAttachment()] };
}

/**
 * Per-status content for order status-change emails.
 * Each entry drives the header, headline, message and status pill.
 */
const STATUS_CONTENT = {
  confirmed: {
    header: 'Order Confirmed',
    headline: (name) => `Good news, ${name}.`,
    message:
      "Your order has been confirmed and is now queued for preparation. We'll let you know the moment it moves to the next stage.",
    pill: 'Confirmed',
    pillColor: C.brass,
    accent: C.brass,
    showTracking: false,
    subject: (n) => `Your TowelCrafts order ${n} is confirmed`,
    preheader: (n) => `Order ${n} is confirmed and being prepared.`,
  },
  processing: {
    header: 'Being Prepared',
    headline: (name) => `We're on it, ${name}.`,
    message:
      "Your order is now being carefully prepared and packed by our team. It will be handed to the courier shortly.",
    pill: 'Processing',
    pillColor: C.brass,
    accent: C.brass,
    showTracking: false,
    subject: (n) => `Your TowelCrafts order ${n} is being prepared`,
    preheader: (n) => `Order ${n} is being prepared for dispatch.`,
  },
  shipped: {
    header: 'On Its Way',
    headline: (name) => `It's shipped, ${name}!`,
    message:
      "Your order has left our facility and is on its way to you. Use the tracking reference below to follow its journey.",
    pill: 'Shipped',
    pillColor: C.info,
    accent: C.info,
    showTracking: true,
    subject: (n) => `Your TowelCrafts order ${n} has shipped`,
    preheader: (n) => `Order ${n} is on its way to you.`,
  },
  delivered: {
    header: 'Delivered',
    headline: (name) => `Enjoy, ${name}.`,
    message:
      "Your order has been delivered. We hope you love it. If anything isn't quite right, simply reply to this email and we'll make it good.",
    pill: 'Delivered',
    pillColor: C.success,
    accent: C.success,
    showTracking: false,
    subject: (n) => `Your TowelCrafts order ${n} has been delivered`,
    preheader: (n) => `Order ${n} has been delivered — we hope you love it.`,
  },
  cancelled: {
    header: 'Order Cancelled',
    headline: (name) => `Hello ${name},`,
    message:
      "Your order has been cancelled. If a payment was made, any eligible refund will be processed to your original payment method. If this was unexpected, please reply to this email.",
    pill: 'Cancelled',
    pillColor: C.error,
    accent: C.error,
    showTracking: false,
    subject: (n) => `Your TowelCrafts order ${n} has been cancelled`,
    preheader: (n) => `Order ${n} has been cancelled.`,
  },
  returned: {
    header: 'Return Processed',
    headline: (name) => `Hello ${name},`,
    message:
      "We've received and processed the return for your order. Any eligible refund will be issued to your original payment method within a few business days.",
    pill: 'Returned',
    pillColor: C.error,
    accent: C.error,
    showTracking: false,
    subject: (n) => `Your TowelCrafts order ${n} return has been processed`,
    preheader: (n) => `The return for order ${n} has been processed.`,
  },
};

/**
 * Build an order status-change email (subject + html + text) for one of the
 * lifecycle statuses: confirmed, processing, shipped, delivered, cancelled,
 * returned.
 *
 * Returns null for statuses that should not trigger a customer email
 * (e.g. 'placed', which is covered by the confirmation email).
 *
 * @param {Object} p
 * @param {string} p.customerName
 * @param {string} p.status    One of the STATUS_CONTENT keys
 * @param {Object} p.order     Saved order document (plain or mongoose doc)
 * @param {string} [p.storeUrl]
 */
function orderStatusEmail({ customerName, status, order, storeUrl }) {
  const content = STATUS_CONTENT[status];
  if (!content) return null;

  const store = storeUrl || process.env.STORE_URL || 'http://localhost:3000';
  const orderNumber = order.orderNumber || String(order._id || '').slice(-8).toUpperCase();
  const firstName = (customerName || 'there').trim().split(/\s+/)[0] || 'there';

  const items = Array.isArray(order.orderItems) && order.orderItems.length
    ? order.orderItems
    : [
        {
          title: order.title || 'Item',
          quantity: order.quantity || 1,
          price: order.subtotal || order.totalPrice || 0,
        },
      ];

  const itemSummary = items
    .map((it) => `${esc(it.title)} <span style="color:${C.textLight};">× ${esc(it.quantity || 1)}</span>`)
    .join('<br>');

  const trackingBlock =
    content.showTracking && order.trackingNumber
      ? `
          <tr>
            <td style="padding:24px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.paper};border:1px solid ${C.borderLight};border-radius:4px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <span style="display:block;font-family:${SANS};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${C.textMuted};margin-bottom:4px;">Tracking Reference</span>
                    <span style="display:block;font-family:${SERIF};font-size:18px;color:${C.forest};font-weight:400;">${esc(order.trackingNumber)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
      : '';

  const subject = content.subject(orderNumber);

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
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${C.paperWarm};">
    ${esc(content.preheader(orderNumber))}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.paperWarm};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:${C.card};border:1px solid ${C.border};border-radius:4px;overflow:hidden;">

          <!-- Header band -->
          <tr>
            <td style="background-color:${C.forestDark};padding:36px 40px 30px;text-align:center;">
              ${brandLockup('TowelCrafts')}
              <div style="font-family:${SERIF};font-size:30px;font-weight:400;color:${C.white};line-height:1.15;">
                ${esc(content.header)}
              </div>
              <div style="width:44px;height:2px;background-color:${content.accent};margin:16px auto 0;"></div>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="padding:36px 40px 8px;">
              <p style="margin:0 0 14px;font-family:${SERIF};font-size:22px;color:${C.forest};font-weight:400;">
                ${esc(content.headline(firstName))}
              </p>
              <p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.textSecondary};">
                ${esc(content.message)}
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
                    <span style="display:block;font-family:${SANS};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${C.textMuted};margin-bottom:6px;">Status</span>
                    <span style="display:inline-block;padding:5px 12px;border-radius:2px;font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:0.04em;color:${C.white};background-color:${content.pillColor};">${esc(content.pill)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${trackingBlock}

          <!-- Items summary -->
          <tr>
            <td style="padding:26px 40px 0;">
              <div style="font-family:${SANS};font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:${content.accent};font-weight:600;padding-bottom:8px;border-bottom:2px solid ${C.forest};">
                Order Summary
              </div>
              <p style="margin:14px 0 0;font-family:${SANS};font-size:15px;line-height:1.7;color:${C.ink};">
                ${itemSummary}
              </p>
              <p style="margin:14px 0 0;font-family:${SERIF};font-size:18px;color:${C.forest};font-weight:700;">
                Total ${inr(order.totalPrice)}
              </p>
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
                Questions about your order? Simply reply to this email and we'll be glad to help.
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

  const textLines = [
    `TOWELCRAFTS — ${content.header.toUpperCase()}`,
    ``,
    content.headline(firstName),
    content.message,
    ``,
    `Order number: ${orderNumber}`,
    `Status: ${content.pill}`,
    content.showTracking && order.trackingNumber ? `Tracking: ${order.trackingNumber}` : '',
    ``,
    `Items:`,
    ...items.map((it) => `  - ${it.title}  (Qty ${it.quantity || 1})`),
    ``,
    `Total: ${inr(order.totalPrice)}`,
    ``,
    `View your order: ${store}/account/orders`,
    ``,
    `© ${new Date().getFullYear()} TowelCrafts`,
  ].filter((l) => l !== '');

  return { subject, html, text: textLines.join('\n'), attachments: [getLogoAttachment()] };
}

// Statuses that trigger a customer-facing email.
const EMAILABLE_STATUSES = Object.keys(STATUS_CONTENT);

/**
 * Build the admin-role approval OTP email (subject + html + text).
 *
 * Sent to the fixed approver whenever an admin attempts to promote a user to
 * a privileged role. The recipient enters the code back in the admin panel to
 * authorize the change.
 *
 * @param {Object} p
 * @param {string} p.code            The one-time code
 * @param {string} p.targetName      Name of the user being promoted
 * @param {string} p.targetEmail     Email of the user being promoted
 * @param {string} p.requestedRole   'admin' | 'superadmin'
 * @param {string} [p.requestedByName]  Admin who initiated the request
 * @param {number} [p.expiresMinutes]   Minutes until the code expires
 */
function adminRoleOtpEmail({
  code,
  targetName,
  targetEmail,
  requestedRole,
  requestedByName,
  expiresMinutes = 10,
}) {
  const roleLabel = requestedRole === 'superadmin' ? 'Super Admin' : 'Admin';
  const subject = `Approve admin access · code ${code}`;

  const metaRow = (label, value) => `
    <tr>
      <td style="padding:7px 0;font-family:${SANS};font-size:13px;color:${C.textLight};width:42%;">${esc(label)}</td>
      <td style="padding:7px 0;font-family:${SANS};font-size:14px;color:${C.ink};font-weight:600;">${esc(value)}</td>
    </tr>`;

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
    Your one-time code to approve ${esc(roleLabel)} access for ${esc(targetName || targetEmail)} is ${esc(code)}.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.paperWarm};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:${C.card};border:1px solid ${C.border};border-radius:4px;overflow:hidden;">

          <!-- Header band -->
          <tr>
            <td style="background-color:${C.forestDark};padding:36px 40px 30px;text-align:center;">
              ${brandLockup('TowelCrafts · Security')}
              <div style="font-family:${SERIF};font-size:28px;font-weight:400;color:${C.white};line-height:1.15;">
                Admin Access Approval
              </div>
              <div style="width:44px;height:2px;background-color:${C.brass};margin:16px auto 0;"></div>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="padding:34px 40px 6px;">
              <p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.textSecondary};">
                A request has been made to grant <strong style="color:${C.ink};">${esc(roleLabel)}</strong> access.
                Use the one-time code below in the admin panel to approve it. If you did not
                expect this, do not share the code — the change cannot happen without it.
              </p>
            </td>
          </tr>

          <!-- Code -->
          <tr>
            <td style="padding:24px 40px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.paper};border:1px solid ${C.border};border-radius:4px;">
                <tr>
                  <td style="padding:22px;text-align:center;">
                    <div style="font-family:${SANS};font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:${C.textLight};margin-bottom:10px;">
                      Your code
                    </div>
                    <div style="font-family:${SERIF};font-size:38px;font-weight:700;letter-spacing:0.18em;color:${C.forest};">
                      ${esc(code)}
                    </div>
                    <div style="font-family:${SANS};font-size:13px;color:${C.textLight};margin-top:10px;">
                      Expires in ${esc(expiresMinutes)} minutes
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Request details -->
          <tr>
            <td style="padding:20px 40px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${metaRow('User to promote', targetName || '—')}
                ${metaRow('Email', targetEmail || '—')}
                ${metaRow('Role requested', roleLabel)}
                ${requestedByName ? metaRow('Requested by', requestedByName) : ''}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 34px;border-top:1px solid ${C.borderLight};">
              <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.textMuted};">
                This is an automated security message from TowelCrafts. The code is valid for a single approval only.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    'TowelCrafts — Admin Access Approval',
    '',
    `A request has been made to grant ${roleLabel} access.`,
    `Your one-time code: ${code}`,
    `Expires in ${expiresMinutes} minutes.`,
    '',
    `User to promote: ${targetName || '—'}`,
    `Email: ${targetEmail || '—'}`,
    `Role requested: ${roleLabel}`,
    requestedByName ? `Requested by: ${requestedByName}` : '',
    '',
    'If you did not expect this, do not share the code — the change cannot happen without it.',
  ]
    .filter((l) => l !== null && l !== undefined)
    .join('\n');

  return { subject, html, text, attachments: [getLogoAttachment()] };
}

// ── Support tickets ──────────────────────────────────────────────

const TICKET_CATEGORY_LABELS = {
  order: 'Order issue',
  product: 'Product',
  delivery: 'Delivery',
  payment: 'Payment',
  return: 'Return / refund',
  other: 'General',
};

const TICKET_PRIORITY_LABELS = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

// A labelled row used inside the ticket detail cards.
function ticketMetaRow(label, value) {
  return `
    <tr>
      <td style="padding:7px 0;font-family:${SANS};font-size:13px;color:${C.textLight};width:38%;vertical-align:top;">${esc(label)}</td>
      <td style="padding:7px 0;font-family:${SANS};font-size:14px;color:${C.ink};font-weight:600;">${esc(value)}</td>
    </tr>`;
}

/**
 * Notify staff (admin/manager) that a new support ticket was raised.
 * Sent to each staff recipient; includes the full ticket detail so they can
 * triage from their inbox.
 *
 * @param {Object} p
 * @param {Object} p.ticket   Saved Ticket document (plain or mongoose doc)
 * @param {string} [p.storeUrl]
 */
function ticketCreatedEmail({ ticket, storeUrl }) {
  const store = storeUrl || process.env.STORE_URL || 'http://localhost:3000';
  const ref = ticket.ticketNumber || String(ticket._id || '').slice(-8).toUpperCase();
  const categoryLabel = TICKET_CATEGORY_LABELS[ticket.category] || 'General';
  const priorityLabel = TICKET_PRIORITY_LABELS[ticket.priority] || 'Normal';
  const priorityColor =
    ticket.priority === 'urgent' || ticket.priority === 'high' ? C.error : C.brass;

  const subject = `New support ticket ${ref} · ${ticket.subject || categoryLabel}`;

  const metaRows =
    ticketMetaRow('From', ticket.name || '—') +
    ticketMetaRow('Email', ticket.email || '—') +
    (ticket.phone ? ticketMetaRow('Phone', ticket.phone) : '') +
    (ticket.orderNumber ? ticketMetaRow('Order', ticket.orderNumber) : '') +
    ticketMetaRow('Category', categoryLabel);

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
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${C.paperWarm};">
    ${esc(ticket.name || 'A customer')} raised ticket ${esc(ref)} — ${esc(ticket.subject || '')}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.paperWarm};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:${C.card};border:1px solid ${C.border};border-radius:4px;overflow:hidden;">

          <!-- Header band -->
          <tr>
            <td style="background-color:${C.forestDark};padding:36px 40px 30px;text-align:center;">
              ${brandLockup('TowelCrafts · Support')}
              <div style="font-family:${SERIF};font-size:28px;font-weight:400;color:${C.white};line-height:1.15;">
                New Support Ticket
              </div>
              <div style="width:44px;height:2px;background-color:${C.brass};margin:16px auto 0;"></div>
            </td>
          </tr>

          <!-- Meta -->
          <tr>
            <td style="padding:30px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.paper};border:1px solid ${C.borderLight};border-radius:4px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <span style="display:block;font-family:${SANS};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${C.textMuted};margin-bottom:4px;">Ticket</span>
                    <span style="display:block;font-family:${SERIF};font-size:18px;color:${C.forest};font-weight:400;">${esc(ref)}</span>
                  </td>
                  <td align="right" style="padding:16px 20px;">
                    <span style="display:block;font-family:${SANS};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${C.textMuted};margin-bottom:6px;">Priority</span>
                    <span style="display:inline-block;padding:5px 12px;border-radius:2px;font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:0.04em;color:${C.white};background-color:${priorityColor};">${esc(priorityLabel)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Subject + message -->
          <tr>
            <td style="padding:26px 40px 0;">
              <div style="font-family:${SANS};font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:${C.brass};font-weight:600;padding-bottom:8px;border-bottom:2px solid ${C.forest};">
                ${esc(ticket.subject || 'Support request')}
              </div>
              <p style="margin:14px 0 0;font-family:${SANS};font-size:15px;line-height:1.7;color:${C.ink};white-space:pre-wrap;">${esc(ticket.message || '')}</p>
            </td>
          </tr>

          <!-- Contact details -->
          <tr>
            <td style="padding:26px 40px 0;">
              <div style="font-family:${SANS};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.textMuted};font-weight:600;margin-bottom:8px;">Contact details</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${metaRows}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:32px 40px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:2px;background-color:${C.forest};">
                    <a href="${esc(store)}/admin" target="_blank"
                       style="display:inline-block;padding:14px 34px;font-family:${SANS};font-size:14px;font-weight:600;letter-spacing:0.04em;color:${C.white};text-decoration:none;">
                      Open in Admin
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
                You can reply directly to <a href="mailto:${esc(ticket.email || '')}" style="color:${C.forest};">${esc(ticket.email || 'the customer')}</a>, or resolve the ticket from the admin panel.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:${C.paper};border-top:1px solid ${C.borderLight};padding:26px 40px;text-align:center;">
              <div style="font-family:${SERIF};font-size:16px;color:${C.forest};margin-bottom:6px;">TowelCrafts</div>
              <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.textMuted};">
                Automated notification from the TowelCrafts support desk.<br>
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

  const textLines = [
    `TOWELCRAFTS — NEW SUPPORT TICKET`,
    ``,
    `Ticket: ${ref}`,
    `Priority: ${priorityLabel}`,
    `Category: ${categoryLabel}`,
    ``,
    `Subject: ${ticket.subject || ''}`,
    ``,
    `${ticket.message || ''}`,
    ``,
    `— Contact —`,
    `Name: ${ticket.name || '—'}`,
    `Email: ${ticket.email || '—'}`,
    ticket.phone ? `Phone: ${ticket.phone}` : '',
    ticket.orderNumber ? `Order: ${ticket.orderNumber}` : '',
    ``,
    `Open in admin: ${store}/admin`,
    ``,
    `© ${new Date().getFullYear()} TowelCrafts`,
  ].filter((l) => l !== '');

  return { subject, html, text: textLines.join('\n'), attachments: [getLogoAttachment()] };
}

/**
 * Notify the customer that their ticket has been resolved (or updated with a
 * resolution note). Sent when staff enters a resolution.
 *
 * @param {Object} p
 * @param {Object} p.ticket   Saved Ticket document (plain or mongoose doc)
 * @param {string} p.resolution  The resolution note to convey
 * @param {string} [p.storeUrl]
 */
function ticketResolutionEmail({ ticket, resolution, storeUrl }) {
  const store = storeUrl || process.env.STORE_URL || 'http://localhost:3000';
  const ref = ticket.ticketNumber || String(ticket._id || '').slice(-8).toUpperCase();
  const firstName = (ticket.name || 'there').trim().split(/\s+/)[0] || 'there';
  const note = resolution || ticket.resolution || '';
  const isClosed = ticket.status === 'closed' || ticket.status === 'resolved';

  const subject = `Update on your support ticket ${ref}`;

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
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${C.paperWarm};">
    We've responded to your support ticket ${esc(ref)}.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.paperWarm};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:${C.card};border:1px solid ${C.border};border-radius:4px;overflow:hidden;">

          <!-- Header band -->
          <tr>
            <td style="background-color:${C.forestDark};padding:36px 40px 30px;text-align:center;">
              ${brandLockup('TowelCrafts · Support')}
              <div style="font-family:${SERIF};font-size:28px;font-weight:400;color:${C.white};line-height:1.15;">
                ${isClosed ? 'Ticket Resolved' : 'Ticket Update'}
              </div>
              <div style="width:44px;height:2px;background-color:${C.brass};margin:16px auto 0;"></div>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="padding:36px 40px 8px;">
              <p style="margin:0 0 14px;font-family:${SERIF};font-size:22px;color:${C.forest};font-weight:400;">
                Hello ${esc(firstName)},
              </p>
              <p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.textSecondary};">
                Thank you for reaching out. Here's an update on your support ticket
                <strong style="color:${C.ink};">${esc(ref)}</strong>${ticket.subject ? ` regarding “${esc(ticket.subject)}”` : ''}.
              </p>
            </td>
          </tr>

          <!-- Resolution -->
          <tr>
            <td style="padding:26px 40px 0;">
              <div style="font-family:${SANS};font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:${C.brass};font-weight:600;padding-bottom:8px;border-bottom:2px solid ${C.forest};">
                Our response
              </div>
              <p style="margin:14px 0 0;font-family:${SANS};font-size:15px;line-height:1.7;color:${C.ink};white-space:pre-wrap;">${esc(note)}</p>
            </td>
          </tr>

          <!-- Note -->
          <tr>
            <td style="padding:30px 40px 36px;">
              <p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.textLight};text-align:center;">
                Still need help? Just reply to this email and we'll pick up right where we left off.
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

  const textLines = [
    `TOWELCRAFTS — ${isClosed ? 'TICKET RESOLVED' : 'TICKET UPDATE'}`,
    ``,
    `Hello ${firstName},`,
    ``,
    `Update on your support ticket ${ref}${ticket.subject ? ` regarding "${ticket.subject}"` : ''}:`,
    ``,
    `${note}`,
    ``,
    `Still need help? Just reply to this email.`,
    ``,
    `© ${new Date().getFullYear()} TowelCrafts`,
  ].filter((l) => l !== undefined);

  return { subject, html, text: textLines.join('\n'), attachments: [getLogoAttachment()] };
}

module.exports = {
  orderConfirmationEmail,
  orderStatusEmail,
  adminRoleOtpEmail,
  EMAILABLE_STATUSES,
  getLogoAttachment,
  ticketCreatedEmail,
  ticketResolutionEmail,
};
