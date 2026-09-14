import { useState, useEffect, useCallback } from "react";
import { ADMIN_API, isAuthError } from "../config";

const PAYMENT_STATUSES = ["pending", "partial", "completed", "refunded", "failed"];
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

export default function Payments() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  const authHeaders = () => {
    const u = JSON.parse(localStorage.getItem("userInfo"));
    return { "Content-Type": "application/json", Authorization: `Bearer ${u?.token}` };
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${ADMIN_API}/orders?limit=200`, { headers: authHeaders() });
      if (isAuthError(res)) throw new Error("You don't have permission to view payments.");
      if (!res.ok) throw new Error(`Failed to load payments (${res.status})`);
      const data = await res.json();
      setOrders(data.orders || data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setPayment = async (id, patch) => {
    const res = await fetch(`${ADMIN_API}/orders/${id}/status`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => (o._id === id ? { ...o, ...updated } : o)));
    }
  };

  if (loading) return <div className="admin__panel"><div className="admin__loading"><div className="admin__spinner" />Loading payments…</div></div>;
  if (error) return <div className="admin__error">{error}</div>;

  const collected = orders.filter((o) => o.paymentStatus === "completed").reduce((s, o) => s + (o.paidAmount || o.totalPrice || 0), 0);
  const outstanding = orders.filter((o) => !["completed", "refunded"].includes(o.paymentStatus) && o.orderStatus !== "cancelled").reduce((s, o) => s + (o.totalPrice || 0), 0);
  const shown = filter === "all" ? orders : orders.filter((o) => (o.paymentStatus || "pending") === filter);

  return (
    <div>
      <div className="admin__stats">
        <div className="admin__stat"><span className="admin__stat-label">Collected</span><div className="admin__stat-value">{inr(collected)}</div></div>
        <div className="admin__stat"><span className="admin__stat-label">Outstanding</span><div className="admin__stat-value">{inr(outstanding)}</div></div>
        <div className="admin__stat"><span className="admin__stat-label">Pending Payments</span><div className="admin__stat-value">{orders.filter((o) => (o.paymentStatus || "pending") === "pending").length}</div></div>
      </div>

      <div className="admin__toolbar">
        <label className="admin__filter">
          <span>Payment status</span>
          <select className="admin__select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
        </label>
        <span className="admin__toolbar-count">{shown.length} orders</span>
      </div>

      <div className="admin__panel admin__panel--table">
        <table className="admin__table admin__table--cards">
          <thead>
            <tr><th>Order</th><th>Customer</th><th>Method</th><th>Total</th><th>Paid</th><th>Payment</th><th></th></tr>
          </thead>
          <tbody>
            {shown.map((o) => (
              <tr key={o._id}>
                <td data-label="Order"><span className="admin__mono">{o.orderNumber || o._id.slice(-8)}</span></td>
                <td data-label="Customer">{o.user?.name || "Unknown"}</td>
                <td data-label="Method"><span className="admin__badge admin__badge--placed">{(o.paymentMethod || "cod").toUpperCase()}</span></td>
                <td data-label="Total"><span className="admin__price">{inr(o.totalPrice)}</span></td>
                <td data-label="Paid">{inr(o.paidAmount || (o.paymentStatus === "completed" ? o.totalPrice : 0))}</td>
                <td data-label="Payment">
                  <select className="admin__select" value={o.paymentStatus || "pending"} onChange={(e) => setPayment(o._id, { paymentStatus: e.target.value })}>
                    {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </td>
                <td data-label="">
                  {o.paymentStatus !== "completed" && o.orderStatus !== "cancelled" && (
                    <button className="admin__btn admin__btn--ghost admin__btn--sm" onClick={() => setPayment(o._id, { paymentStatus: "completed" })}>Mark paid</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
