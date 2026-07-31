import { useState, useEffect } from "react";
import { FaStar } from "react-icons/fa";
import { API_URL } from "../config";

export default function Feedbacks() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFeedbacks = async () => {
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const response = await fetch(`${API_URL}/api/feedbacks?limit=200`, {
        headers: { Authorization: `Bearer ${userInfo?.token}` },
      });

      if (!response.ok) throw new Error(`Failed to fetch feedbacks (${response.status})`);

      const data = await response.json();
      setFeedbacks(data.feedbacks || data);
    } catch (err) {
      console.error("Error fetching feedbacks:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const updateStatus = async (id, status) => {
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const res = await fetch(`${API_URL}/api/feedbacks/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userInfo.token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setFeedbacks((prev) => prev.map((f) => (f._id === id ? { ...f, status } : f)));
      }
    } catch (err) {
      console.error("Error updating feedback:", err);
    }
  };

  if (loading) {
    return (
      <div className="admin__panel">
        <div className="admin__loading">
          <div className="admin__spinner" />
          Loading feedbacks...
        </div>
      </div>
    );
  }

  if (error) return <div className="admin__error">{error}</div>;

  const avgRating = feedbacks.filter((f) => f.rating).length
    ? (
        feedbacks.filter((f) => f.rating).reduce((s, f) => s + f.rating, 0) /
        feedbacks.filter((f) => f.rating).length
      ).toFixed(1)
    : "—";

  return (
    <div>
      <div className="admin__stats">
        <div className="admin__stat">
          <span className="admin__stat-label">Total Feedback</span>
          <div className="admin__stat-value">{feedbacks.length}</div>
        </div>
        <div className="admin__stat">
          <span className="admin__stat-label">Average Rating</span>
          <div className="admin__stat-value">{avgRating}</div>
        </div>
        <div className="admin__stat">
          <span className="admin__stat-label">Pending Review</span>
          <div className="admin__stat-value">{feedbacks.filter((f) => f.status === "pending").length}</div>
        </div>
      </div>

      {feedbacks.length === 0 ? (
        <div className="admin__panel">
          <div className="admin__empty">No feedback submitted yet.</div>
        </div>
      ) : (
        <div className="admin__panel">
          <table className="admin__table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Rating</th>
                <th>Review</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {feedbacks.map((f) => (
                <tr key={f._id}>
                  <td>
                    <div className="admin__table-product-name">{f.user?.name || "Anonymous"}</div>
                    <div className="admin__mono">{f.user?.email || "N/A"}</div>
                  </td>
                  <td>
                    {f.rating ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--color-accent)", fontWeight: 600 }}>
                        <FaStar /> {f.rating}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="admin__review-text">{f.review}</td>
                  <td>{new Date(f.createdAt).toLocaleDateString()}</td>
                  <td>
                    <select
                      className="admin__select"
                      value={f.status || "pending"}
                      onChange={(e) => updateStatus(f._id, e.target.value)}
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
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
