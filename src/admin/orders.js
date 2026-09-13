import { useState, useEffect, useCallback } from "react";
import { FaFileInvoice, FaEye, FaTimes, FaEnvelope, FaCheck } from "react-icons/fa";
import { API_URL } from "../config";
import { printInvoice } from "./invoice";

const ORDER_STATUSES = ["placed", "confirmed", "processing", "shipped", "delivered", "cancelled", "returned"];
const PAYMENT_STATUSES = ["pending", "partial", "completed", "refunded", "failed"];

// Statuses that trigger a customer-facing email (mirrors server EMAILABLE_STATUSES).
const EMAILABLE_STATUSES = ["confirmed", "processing", "shipped", "delivered", "cancelled", "returned"];

// Short, human descriptions shown in the confirmation dialog.
const STATUS_EMAIL_COPY = {
  confirmed: "confirming the order and that it's being prepared",
  processing: "letting them know the order is being prepared for dispatch",
  shipped: "letting them know the order has shipped, with tracking details",
  delivered: "confirming the order has been delivered",
  cancelled: "informing them the order has been cancelled",
  returned: "confirming the return has been processed",
};

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [active, setActive] = useState(null); // order open in modal
  const [toast, setToast] = useState(null); // { message }
  // Pending status change awaiting the admin's email decision.
  // { id, patch, order, newStatus, onDone }
  const [confirm, setConfirm] = useState(null);

  const authHeaders = () => {
    const userInfo = JSON.parse(localStorage.getItem("userInfo"));
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userInfo?.token}`,
    };
  };

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/orders?limit=200`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`Failed to fetch orders (${res.status})`);
      const data = await res.json();
      setOrders(data.orders || data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const showToast = (message) => {
    setToast({ message });
    setTimeout(() => setToast(null), 4000);
  };

  // Persist a status/detail change. Returns the updated order (or null on error).
  const saveOrder = useCallback(async (id, patch) => {
    const res = await fetch(`${API_URL}/api/orders/${id}/status`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) return null;
    const updated = await res.json();
    setOrders((prev) => prev.map((o) => (o._id === id ? { ...o, ...updated } : o)));
    setActive((a) => (a && a._id === id ? { ...a, ...updated } : a));
    return updated;
  }, []);

  const customerEmail = (order) => order.user?.email || order.userId?.email || "";
  const customerLabel = (order) => order.user?.name || order.userId?.name || "the customer";

  /**
   * Request a status change. If the new status is emailable and differs from
   * the current one, open the confirmation dialog so the admin can choose to
   * send the email or skip it. Otherwise save immediately.
   *
   * @param {Object} order   the order being changed
   * @param {Object} patch   fields to persist (must include orderStatus)
   * @param {Function} [onDone] optional callback after a successful save
   */
  const requestStatusChange = (order, patch, onDone) => {
    const newStatus = patch.orderStatus;
    const changed = newStatus && newStatus !== order.orderStatus;
    const emailable = EMAILABLE_STATUSES.includes(newStatus);

    if (changed && emailable) {
      setConfirm({ id: order._id, patch, order, newStatus, onDone });
      return;
    }
    // No email decision needed — save straight away (skip email by default).
    saveOrder(order._id, { ...patch, sendEmail: false }).then((u) => {
      if (u && onDone) onDone(u);
    });
  };

  // Resolve the confirmation dialog with the admin's choice.
  const resolveConfirm = async (sendEmail) => {
    if (!confirm) return;
    const { id, patch, order, newStatus, onDone } = confirm;
    setConfirm(null);
    const updated = await saveOrder(id, { ...patch, sendEmail });
    if (updated) {
      if (onDone) onDone(updated);
      const email = customerEmail(order);
      // Trust the server's actual outcome (emailQueued) rather than assuming
      // success — this reflects whether an email was really dispatched.
      if (sendEmail && updated.emailQueued) {
        showToast(`${cap(newStatus)} email sent to ${email}.`);
      } else if (sendEmail && !email) {
        showToast(`Status updated. No email on file for ${customerLabel(order)}.`);
      } else if (sendEmail && !updated.emailQueued) {
        showToast(`Status updated to ${cap(newStatus)}, but the email could not be sent. Check the server email settings.`);
      } else {
        showToast(`Status updated to ${cap(newStatus)}. No email sent.`);
      }
    }
  };

  const productName = (order) => {
    if (order.orderItems && order.orderItems.length > 0) {
      return order.orderItems.map((i) => `${i.title} ×${i.quantity}`).join(", ");
    }
    return order.productId?.title || "—";
  };

  if (loading) {
    return (
      <div className="admin__panel">
        <div className="admin__loading"><div className="admin__spinner" />Loading orders…</div>
      </div>
    );
  }
  if (error) return <div className="admin__error">{error}</div>;

  const shown = filter === "all" ? orders : orders.filter((o) => o.orderStatus === filter);
  const revenue = orders.filter((o) => o.orderStatus !== "cancelled").reduce((s, o) => s + (o.totalPrice || 0), 0);

  return (
    <div>
      <div className="admin__stats">
        <div className="admin__stat"><span className="admin__stat-label">Total Orders</span><div className="admin__stat-value">{orders.length}</div></div>
        <div className="admin__stat"><span className="admin__stat-label">Delivered</span><div className="admin__stat-value">{orders.filter((o) => o.orderStatus === "delivered").length}</div></div>
        <div className="admin__stat"><span className="admin__stat-label">Revenue</span><div className="admin__stat-value">{inr(revenue)}</div></div>
      </div>

      <div className="admin__toolbar">
        <label className="admin__filter">
          <span>Filter</span>
          <select className="admin__select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
          </select>
        </label>
        <span className="admin__toolbar-count">{shown.length} orders</span>
      </div>

      {shown.length === 0 ? (
        <div className="admin__panel"><div className="admin__empty">No orders found.</div></div>
      ) : (
        <div className="admin__panel admin__panel--table">
          <table className="admin__table admin__table--cards">
            <thead>
              <tr>
                <th>Order</th><th>Customer</th><th>Items</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((order) => (
                <tr key={order._id}>
                  <td data-label="Order"><span className="admin__mono">{order.orderNumber || order._id.slice(-8)}</span></td>
                  <td data-label="Customer">{order.user?.name || order.userId?.name || "Unknown"}</td>
                  <td data-label="Items" className="admin__cell-clip">{productName(order)}</td>
                  <td data-label="Date">{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td data-label="Total"><span className="admin__price">{inr(order.totalPrice)}</span></td>
                  <td data-label="Payment"><span className={`admin__badge admin__badge--${order.paymentStatus || "pending"}`}>{order.paymentStatus || "pending"}</span></td>
                  <td data-label="Status">
                    <select
                      className="admin__select"
                      value={order.orderStatus || "placed"}
                      onChange={(e) => requestStatusChange(order, { orderStatus: e.target.value })}
                    >
                      {ORDER_STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
                    </select>
                  </td>
                  <td data-label="Actions">
                    <div className="admin__row-actions">
                      <button className="admin__icon-btn" title="View / edit" onClick={() => setActive(order)}><FaEye /></button>
                      <button className="admin__icon-btn" title="Invoice" onClick={() => printInvoice(order)}><FaFileInvoice /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {active && (
        <OrderModal
          order={active}
          onClose={() => setActive(null)}
          onSave={saveOrder}
          onStatusChange={requestStatusChange}
        />
      )}

      {confirm && (
        <StatusEmailDialog
          confirm={confirm}
          email={customerEmail(confirm.order)}
          customer={customerLabel(confirm.order)}
          onSend={() => resolveConfirm(true)}
          onSkip={() => resolveConfirm(false)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {toast && (
        <div className="admin__toast" role="status">
          <FaCheck className="admin__toast-icon" />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Confirmation dialog shown after an emailable status change.
 * Offers: send the email (primary), change status only / skip email, or cancel.
 */
function StatusEmailDialog({ confirm, email, customer, onSend, onSkip, onCancel }) {
  const { newStatus } = confirm;
  const description = STATUS_EMAIL_COPY[newStatus] || "notifying them of the update";
  const hasEmail = Boolean(email);

  return (
    <div className="admin__modal-overlay" onClick={onCancel}>
      <div className="admin__confirm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="admin__confirm-icon"><FaEnvelope /></div>
        <h3 className="admin__confirm-title" id="confirm-title">Notify the customer?</h3>
        <p className="admin__confirm-text">
          You're changing this order to <strong>{cap(newStatus)}</strong>. An email will be sent to{" "}
          {hasEmail ? <strong>{email}</strong> : <span>{customer}</span>} {description}.
        </p>
        {!hasEmail && (
          <p className="admin__confirm-note">
            No email address is on file for this customer, so nothing will be sent — the status will still update.
          </p>
        )}
        <div className="admin__confirm-actions">
          <button className="admin__btn admin__btn--primary" onClick={onSend} disabled={!hasEmail}>
            <FaEnvelope /> Send email &amp; update
          </button>
          <button className="admin__btn admin__btn--ghost" onClick={onSkip}>
            Change status only
          </button>
        </div>
        <button className="admin__confirm-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function OrderModal({ order, onClose, onSave, onStatusChange }) {
  const [form, setForm] = useState({
    orderStatus: order.orderStatus || "placed",
    paymentStatus: order.paymentStatus || "pending",
    trackingNumber: order.trackingNumber || "",
    paidAmount: order.paidAmount || "",
    notes: order.notes || "",
  });
  const [saving, setSaving] = useState(false);

  const items = order.orderItems?.length ? order.orderItems : order.productId ? [{ title: order.productId.title, price: order.productId.price, quantity: order.quantity || 1 }] : [];
  const addr = order.shippingAddress || {};

  const save = async () => {
    setSaving(true);
    const detailPatch = {
      paymentStatus: form.paymentStatus,
      trackingNumber: form.trackingNumber,
      paidAmount: form.paidAmount === "" ? undefined : Number(form.paidAmount),
      notes: form.notes,
    };
    const statusChanged = form.orderStatus !== order.orderStatus;

    if (statusChanged) {
      // Route the status change (with the other edits attached) through the
      // email-confirmation flow. The dialog owns the actual save + close.
      onStatusChange(
        order,
        { ...detailPatch, orderStatus: form.orderStatus },
        () => {
          setSaving(false);
          onClose();
        }
      );
    } else {
      // No status change — persist detail edits directly, no email.
      await onSave(order._id, { ...detailPatch, sendEmail: false });
      setSaving(false);
      onClose();
    }
  };

  return (
    <div className="admin__modal-overlay" onClick={onClose}>
      <div className="admin__modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin__modal-head">
          <div>
            <h3>Order {order.orderNumber || order._id.slice(-8)}</h3>
            <span className="admin__modal-sub">{new Date(order.createdAt).toLocaleString()}</span>
          </div>
          <button className="admin__icon-btn" onClick={onClose} aria-label="Close"><FaTimes /></button>
        </div>

        <div className="admin__modal-body">
          <div className="admin__modal-cols">
            <div>
              <h4 className="admin__modal-label">Customer</h4>
              <p className="admin__modal-text">
                {order.user?.name || "Customer"}<br />
                {order.user?.email}<br />
                {order.user?.phone || addr.phone}
              </p>
            </div>
            <div>
              <h4 className="admin__modal-label">Shipping</h4>
              <p className="admin__modal-text">
                {addr.addressLine}<br />
                {addr.city}{addr.state ? `, ${addr.state}` : ""} — {addr.pincode}<br />
                {addr.country}
              </p>
            </div>
          </div>

          <h4 className="admin__modal-label">Items</h4>
          <div className="admin__modal-items">
            {items.map((i, idx) => (
              <div className="admin__modal-item" key={idx}>
                <span>{i.title}</span>
                <span>×{i.quantity}</span>
                <span>{inr((i.price || 0) * (i.quantity || 1))}</span>
              </div>
            ))}
            <div className="admin__modal-item admin__modal-item--total">
              <span>Total</span><span /><span>{inr(order.totalPrice)}</span>
            </div>
          </div>

          <div className="admin__form-grid">
            <div className="admin__form-group">
              <label className="admin__form-label">Order status</label>
              <select className="admin__form-select" value={form.orderStatus} onChange={(e) => setForm({ ...form, orderStatus: e.target.value })}>
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
              </select>
            </div>
            <div className="admin__form-group">
              <label className="admin__form-label">Payment status</label>
              <select className="admin__form-select" value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}>
                {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
              </select>
            </div>
            <div className="admin__form-group">
              <label className="admin__form-label">Tracking number</label>
              <input className="admin__form-input" value={form.trackingNumber} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} placeholder="e.g. IND48839201" />
            </div>
            <div className="admin__form-group">
              <label className="admin__form-label">Amount paid (₹)</label>
              <input className="admin__form-input" type="number" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} placeholder={String(order.totalPrice || 0)} />
            </div>
            <div className="admin__form-group admin__form-group--full">
              <label className="admin__form-label">Internal notes</label>
              <textarea className="admin__form-textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes visible to admins only" />
            </div>
          </div>
        </div>

        <div className="admin__modal-foot">
          <button className="admin__btn admin__btn--ghost" onClick={() => printInvoice(order)}>
            <FaFileInvoice /> Invoice
          </button>
          <div className="admin__modal-foot-right">
            <button className="admin__btn admin__btn--ghost" onClick={onClose}>Cancel</button>
            <button className="admin__btn admin__btn--primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
