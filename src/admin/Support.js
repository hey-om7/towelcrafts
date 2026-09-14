import { useState, useEffect, useCallback } from "react";
import { FaTrashAlt, FaEnvelope, FaPhone, FaMapMarkerAlt } from "react-icons/fa";
import { ADMIN_API, isAuthError } from "../config";

const TYPE_LABELS = { complaint: "Complaint", suggestion: "Suggestion", general: "General" };

export default function Support() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  const authHeaders = () => {
    const u = JSON.parse(localStorage.getItem("userInfo"));
    return { "Content-Type": "application/json", Authorization: `Bearer ${u?.token}` };
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${ADMIN_API}/feedbacks?limit=200`, { headers: authHeaders() });
      if (isAuthError(res)) throw new Error("You don't have permission to view support messages.");
      if (!res.ok) throw new Error(`Failed to load support messages (${res.status})`);
      const data = await res.json();
      const all = data.feedbacks || data;
      setItems(all.filter((f) => f.type !== "product_review" && !f.rating));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id, status) => {
    const res = await fetch(`${ADMIN_API}/feedbacks/${id}/status`, {
      method: "PUT", headers: authHeaders(), body: JSON.stringify({ status }),
    });
    if (res.ok) setItems((prev) => prev.map((f) => (f._id === id ? { ...f, status } : f)));
  };

  const remove = async (id) => {
    const res = await fetch(`${ADMIN_API}/feedbacks/${id}`, { method: "DELETE", headers: authHeaders() });
    if (res.ok) setItems((prev) => prev.filter((f) => f._id !== id));
  };

  if (loading) return <div className="admin__panel"><div className="admin__loading"><div className="admin__spinner" />Loading support inbox…</div></div>;
  if (error) return <div className="admin__error">{error}</div>;

  const shown = filter === "all" ? items : items.filter((f) => (f.type || "general") === filter);
  const openCount = items.filter((f) => f.status === "pending").length;

  return (
    <div>
      {/* Help resources for the customer-facing team */}
      <div className="admin__help-banner">
        <div>
          <h4>Support desk</h4>
          <p>Respond to customer messages below. For direct contact, customers reach us via:</p>
        </div>
        <div className="admin__help-contacts">
          <span><FaEnvelope /> care@towelcrafts.in</span>
          <span><FaPhone /> +91 744777 6777</span>
          <span><FaMapMarkerAlt /> Solapur, Maharashtra</span>
        </div>
      </div>

      <div className="admin__stats">
        <div className="admin__stat"><span className="admin__stat-label">Total Messages</span><div className="admin__stat-value">{items.length}</div></div>
        <div className="admin__stat"><span className="admin__stat-label">Open</span><div className="admin__stat-value">{openCount}</div></div>
        <div className="admin__stat"><span className="admin__stat-label">Complaints</span><div className="admin__stat-value">{items.filter((f) => f.type === "complaint").length}</div></div>
      </div>

      <div className="admin__toolbar">
        <label className="admin__filter">
          <span>Type</span>
          <select className="admin__select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="complaint">Complaints</option>
            <option value="suggestion">Suggestions</option>
            <option value="general">General</option>
          </select>
        </label>
        <span className="admin__toolbar-count">{shown.length} messages</span>
      </div>

      {shown.length === 0 ? (
        <div className="admin__panel"><div className="admin__empty">No support messages.</div></div>
      ) : (
        <div className="admin__support-list">
          {shown.map((f) => (
            <div key={f._id} className="admin__support-card">
              <div className="admin__support-head">
                <div>
                  <span className="admin__table-product-name">{f.user?.name || "Anonymous"}</span>
                  <span className="admin__mono">{f.user?.email || ""}</span>
                </div>
                <div className="admin__support-head-right">
                  <span className={`admin__badge admin__badge--${f.type === "complaint" ? "cancelled" : "placed"}`}>{TYPE_LABELS[f.type] || "General"}</span>
                  <span className="admin__support-date">{new Date(f.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              {f.title && <p className="admin__support-title">{f.title}</p>}
              <p className="admin__support-body">{f.review}</p>
              <div className="admin__support-actions">
                <select className="admin__select" value={f.status || "pending"} onChange={(e) => setStatus(f._id, e.target.value)}>
                  <option value="pending">Open</option>
                  <option value="approved">Resolved</option>
                  <option value="rejected">Dismissed</option>
                </select>
                <button className="admin__icon-btn admin__icon-btn--danger" title="Delete" onClick={() => remove(f._id)}><FaTrashAlt /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
