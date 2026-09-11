// Generates a clean, printable invoice for an order in a new window.
// No dependencies — builds self-contained HTML and triggers the print dialog.

const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

export function printInvoice(order) {
  if (!order) return;

  const items =
    order.orderItems && order.orderItems.length > 0
      ? order.orderItems
      : order.productId
      ? [
          {
            title: order.productId.title || "Item",
            price: order.productId.price,
            quantity: order.quantity || 1,
          },
        ]
      : [];

  const customer = order.user || order.userId || {};
  const addr = order.shippingAddress || {};
  const created = order.createdAt ? new Date(order.createdAt) : new Date();

  const subtotal =
    order.subtotal ||
    items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0);

  const rows = items
    .map(
      (i) => `
      <tr>
        <td>${escapeHtml(i.title)}</td>
        <td class="num">${i.quantity}</td>
        <td class="num">${inr(i.price)}</td>
        <td class="num">${inr((i.price || 0) * (i.quantity || 1))}</td>
      </tr>`
    )
    .join("");

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Invoice ${escapeHtml(order.orderNumber || order._id || "")}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    color: #24281f; margin: 0; padding: 48px; background: #fff;
  }
  .inv { max-width: 760px; margin: 0 auto; }
  .inv__head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #33402b; padding-bottom: 24px; }
  .brand { font-family: Georgia, "Times New Roman", serif; font-size: 26px; color: #33402b; }
  .brand small { display:block; font-family: -apple-system, sans-serif; font-size: 10px; letter-spacing: .22em; text-transform: uppercase; color: #9b7b4a; margin-top: 4px; }
  .inv__meta { text-align: right; font-size: 13px; color: #4b5341; }
  .inv__meta strong { color: #24281f; }
  .cols { display: flex; gap: 48px; margin: 32px 0; }
  .cols h4 { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #9aa08c; margin: 0 0 8px; }
  .cols p { margin: 0; font-size: 14px; line-height: 1.5; color: #4b5341; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #9aa08c; border-bottom: 1px solid #dcd7c8; padding: 10px 8px; }
  td { padding: 12px 8px; font-size: 14px; border-bottom: 1px solid #eceadf; }
  .num { text-align: right; }
  .totals { margin-top: 16px; margin-left: auto; width: 280px; }
  .totals .row { display: flex; justify-content: space-between; padding: 6px 8px; font-size: 14px; color: #4b5341; }
  .totals .grand { border-top: 2px solid #33402b; margin-top: 8px; padding-top: 12px; font-size: 18px; color: #33402b; font-weight: 600; }
  .foot { margin-top: 48px; padding-top: 16px; border-top: 1px solid #dcd7c8; font-size: 12px; color: #9aa08c; text-align: center; }
  .pill { display:inline-block; padding: 2px 10px; border-radius: 3px; font-size: 11px; text-transform: capitalize; background:#eceadf; color:#33402b; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="inv">
    <div class="inv__head">
      <div class="brand">Towel<small>Crafts</small></div>
      <div class="inv__meta">
        <div><strong>Invoice</strong></div>
        <div>${escapeHtml(order.orderNumber || order._id || "")}</div>
        <div>${created.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>
        <div style="margin-top:6px">Status: <span class="pill">${escapeHtml(order.orderStatus || "placed")}</span></div>
      </div>
    </div>

    <div class="cols">
      <div>
        <h4>Billed To</h4>
        <p>
          <strong>${escapeHtml(customer.name || addr.fullName || "Customer")}</strong><br/>
          ${customer.email ? escapeHtml(customer.email) + "<br/>" : ""}
          ${customer.phone || addr.phone ? "Phone: " + escapeHtml(customer.phone || addr.phone) : ""}
        </p>
      </div>
      <div>
        <h4>Ship To</h4>
        <p>
          ${addr.addressLine ? escapeHtml(addr.addressLine) + "<br/>" : ""}
          ${addr.city ? escapeHtml(addr.city) : ""}${addr.state ? ", " + escapeHtml(addr.state) : ""} ${addr.pincode ? "— " + escapeHtml(addr.pincode) : ""}<br/>
          ${addr.country ? escapeHtml(addr.country) : ""}
        </p>
      </div>
      <div>
        <h4>Payment</h4>
        <p>
          Method: ${escapeHtml((order.paymentMethod || "cod").toUpperCase())}<br/>
          Status: ${escapeHtml(order.paymentStatus || "pending")}
        </p>
      </div>
    </div>

    <table>
      <thead>
        <tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${inr(subtotal)}</span></div>
      <div class="row"><span>Shipping</span><span>${inr(order.shippingCharge || 0)}</span></div>
      ${order.tax ? `<div class="row"><span>Tax</span><span>${inr(order.tax)}</span></div>` : ""}
      ${order.discount ? `<div class="row"><span>Discount</span><span>- ${inr(order.discount)}</span></div>` : ""}
      <div class="row grand"><span>Total</span><span>${inr(order.totalPrice)}</span></div>
    </div>

    <div class="foot">
      TowelCrafts · Akkalkot Road, Solapur, Maharashtra 413001 · Thank you for your purchase.
    </div>
  </div>
  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) {
    alert("Please allow pop-ups to generate the invoice.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
