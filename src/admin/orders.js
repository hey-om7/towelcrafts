import { useState, useEffect } from "react";
import { API_URL } from "../config";

const ORDER_STATUSES = ["placed", "confirmed", "processing", "shipped", "delivered", "cancelled"];

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrders = async () => {
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const response = await fetch(`${API_URL}/api/orders?limit=200`, {
        headers: { Authorization: `Bearer ${userInfo?.token}` },
      });

      if (!response.ok) throw new Error(`Failed to fetch orders (${response.status})`);

      const data = await response.json();
      setOrders(data.orders || data);
    } catch (err) {
      console.error("Error fetching orders:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const updateStatus = async (orderId, orderStatus) => {
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const res = await fetch(`${API_URL}/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userInfo.token}`,
        },
        body: JSON.stringify({ orderStatus }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o._id === orderId ? { ...o, orderStatus } : o))
        );
      }
    } catch (err) {
      console.error("Error updating order:", err);
    }
  };

  const getProductName = (order) => {
    if (order.orderItems && order.orderItems.length > 0) {
      return order.orderItems.map((i) => `${i.title} ×${i.quantity}`).join(", ");
    }
    return order.productId?.title || "Unknown Product";
  };

  const getAddress = (order) => {
    const a = order.shippingAddress;
    if (a && a.addressLine) {
      return `${a.addressLine}, ${a.city}${a.state ? ", " + a.state : ""} — ${a.pincode}, ${a.country}`;
    }
    return "N/A";
  };

  if (loading) {
    return (
      <div className="admin__panel">
        <div className="admin__loading">
          <div className="admin__spinner" />
          Loading orders...
        </div>
      </div>
    );
  }

  if (error) return <div className="admin__error">{error}</div>;

  const totalRevenue = orders
    .filter((o) => o.orderStatus !== "cancelled")
    .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

  return (
    <div>
      <div className="admin__stats">
        <div className="admin__stat">
          <span className="admin__stat-label">Total Orders</span>
          <div className="admin__stat-value">{orders.length}</div>
        </div>
        <div className="admin__stat">
          <span className="admin__stat-label">Delivered</span>
          <div className="admin__stat-value">{orders.filter((o) => o.orderStatus === "delivered").length}</div>
        </div>
        <div className="admin__stat">
          <span className="admin__stat-label">Revenue</span>
          <div className="admin__stat-value">₹{totalRevenue.toLocaleString()}</div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="admin__panel">
          <div className="admin__empty">No orders found yet.</div>
        </div>
      ) : (
        <div className="admin__panel">
          <table className="admin__table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Shipping Address</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order._id}>
                  <td><span className="admin__mono">{order.orderNumber || order._id.slice(-8)}</span></td>
                  <td>{order.user?.name || order.userId?.name || "Unknown"}</td>
                  <td>{getProductName(order)}</td>
                  <td style={{ fontSize: "var(--text-xs)", maxWidth: "220px" }}>{getAddress(order)}</td>
                  <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td><span className="admin__price">₹{order.totalPrice?.toLocaleString()}</span></td>
                  <td>
                    <select
                      className="admin__select"
                      value={order.orderStatus || "placed"}
                      onChange={(e) => updateStatus(order._id, e.target.value)}
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
