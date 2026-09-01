import { useState, useEffect, useCallback } from "react";
import { FaStar, FaTrashAlt } from "react-icons/fa";
import { API_URL } from "../config";

export default function Reviews() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const authHeaders = () => {
    const u = JSON.parse(localStorage.getItem("userInfo"));
    return { "Content-Type": "application/json", Authorization: `Bearer ${u?.token}` };
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/feedbacks?limit=200`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`Failed to load reviews (${res.status})`);
      const data = await res.json();
      const all = data.feedbacks || data;
      setItems(all.filter((f) => f.type === "product_review" || f.rating));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id, status) => {
    const res = await fetch(`${API_URL}/api/feedbacks/${id}/status`, {
      method: "PUT", headers: authHeaders(), body: JSON.stringify({ status }),
    });
    if (res.ok) setItems((prev) => prev.map((f) => (f._id === id ? { ...f, status } : f)));
  };

  const remove = async (id) => {
    const res = await fetch(`${API_URL}/api/feedbacks/${id}`, { method: "DELETE", headers: authHeaders() });
    if (res.ok) setItems((prev) => prev.filter((f) => f._id !== id));
  };

  if (loading) return <div className="admin__panel"><div className="admin__loading"><div className="admin__spinner" />Loading reviews…</div></div>;
  if (error) return <div className="admin__error">{error}</div>;

  const rated = items.filter((f) => f.rating);
  const avg = rated.length ? (rated.reduce((s, f) => s + f.rating, 0) / rated.length).toFixed(1) : "—";

  return (
    <div>
      <div className="admin__stats">
        <div className="admin__stat"><span className="admin__stat-label">Total Reviews</span><div className="admin__stat-value">{items.length}</div></div>
        <div className="admin__stat"><span className="admin__stat-label">Average Rating</span><div className="admin__stat-value">{avg}</div></div>
        <div className="admin__stat"><span className="admin__stat-label">Awaiting Approval</span><div className="admin__stat-value">{items.filter((f) => f.status === "pending").length}</div></div>
      </div>

      {items.length === 0 ? (
        <div className="admin__panel"><div className="admin__empty">No product reviews yet.</div></div>
      ) : (
        <div className="admin__panel admin__panel--table">
          <table className="admin__table admin__table--cards">
            <thead>
              <tr><th>Product</th><th>Customer</th><th>Rating</th><th>Review</th><th>Date</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f._id}>
                  <td data-label="Product">{f.product?.title || "—"}</td>
                  <td data-label="Customer">
                    <div className="admin__table-product-name">{f.user?.name || "Anonymous"}</div>
                    <div className="admin__mono">{f.user?.email || ""}</div>
                  </td>
                  <td data-label="Rating">
                    {f.rating ? (
                      <span className="admin__stars"><FaStar /> {f.rating}</span>
                    ) : "—"}
                  </td>
                  <td data-label="Review" className="admin__review-text">
                    {f.title && <strong>{f.title}<br /></strong>}
                    {f.review}
                  </td>
                  <td data-label="Date">{new Date(f.createdAt).toLocaleDateString()}</td>
                  <td data-label="Status">
                    <select className="admin__select" value={f.status || "pending"} onChange={(e) => setStatus(f._id, e.target.value)}>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </td>
                  <td data-label="">
                    <button className="admin__icon-btn admin__icon-btn--danger" title="Delete" onClick={() => remove(f._id)}><FaTrashAlt /></button>
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
