import { useState, useEffect, useCallback } from "react";
import { FaFileInvoice, FaEye, FaTimes } from "react-icons/fa";
import { API_URL } from "../config";
import { printInvoice } from "./invoice";

const ORDER_STATUSES = ["placed", "confirmed", "processing", "shipped", "delivered", "cancelled", "returned"];
const PAYMENT_STATUSES = ["pending", "partial", "completed", "refunded", "failed"];

const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [active, setActive] = useState(null); // order open in modal

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

  const saveOrder = async (id, patch) => {
    const res = await fetch(`${API_URL}/api/orders/${id}/status`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => (o._id === id ? { ...o, ...updated } : o)));
      setActive((a) => (a && a._id === id ? { ...a, ...updated } : a));
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
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
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
                    <select className="admin__select" value={order.orderStatus || "placed"} onChange={(e) => saveOrder(order._id, { orderStatus: e.target.value })}>
                      {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
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
        />
      )}
    </div>
  );
}

function OrderModal({ order, onClose, onSave }) {
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
    await onSave(order._id, {
      ...form,
      paidAmount: form.paidAmount === "" ? undefined : Number(form.paidAmount),
    });
    setSaving(false);
    onClose();
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
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div className="admin__form-group">
              <label className="admin__form-label">Payment status</label>
              <select className="admin__form-select" value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}>
                {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
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
