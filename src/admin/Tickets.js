import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaTrashAlt, FaEnvelope, FaPhone, FaBoxOpen, FaPaperPlane, FaTimes,
  FaRegClock, FaCheckCircle, FaExclamationTriangle, FaInbox, FaUserCircle, FaChevronRight,
} from "react-icons/fa";
import { ADMIN_API, isAuthError } from "../config";

const STATUS_LABELS = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_BADGE = {
  open: "placed",
  in_progress: "processing",
  resolved: "delivered",
  closed: "cancelled",
};

const CATEGORY_LABELS = {
  order: "Order issue",
  product: "Product",
  delivery: "Delivery",
  payment: "Payment",
  return: "Return / refund",
  other: "General",
};

const PRIORITY_LABELS = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };

function formatDateTime(d) {
  try {
    return new Date(d).toLocaleString(undefined, {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [activeId, setActiveId] = useState(null);
  // Per-ticket local resolution drafts + busy flags, keyed by ticket id.
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState({});
  const [flash, setFlash] = useState(null); // { id, text, ok }

  const authHeaders = () => {
    const u = JSON.parse(localStorage.getItem("userInfo"));
    return { "Content-Type": "application/json", Authorization: `Bearer ${u?.token}` };
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${ADMIN_API}/tickets?limit=200`, { headers: authHeaders() });
      if (isAuthError(res)) throw new Error("You don't have permission to view support tickets.");
      if (!res.ok) throw new Error(`Failed to load tickets (${res.status})`);
      const data = await res.json();
      const list = data.tickets || data;
      setTickets(list);
      setDrafts(Object.fromEntries(list.map((t) => [t._id, t.resolution || ""])));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patchTicket = async (id, body) => {
    setBusy((b) => ({ ...b, [id]: true }));
    setFlash(null);
    try {
      const res = await fetch(`${ADMIN_API}/tickets/${id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Update failed");
      }
      const updated = await res.json();
      setTickets((prev) =>
        prev.map((t) => {
          if (t._id !== id) return t;
          const merged = { ...t, ...updated };
          // The PUT response returns handledBy as a raw id (not populated);
          // keep the previously-populated object so the name still shows.
          if (typeof updated.handledBy === "string" && t.handledBy && typeof t.handledBy === "object") {
            merged.handledBy = t.handledBy;
          }
          return merged;
        })
      );
      if (updated.emailQueued) {
        setFlash({ id, text: "Resolution emailed to the customer.", ok: true });
      } else if (body.resolution !== undefined) {
        setFlash({ id, text: "Saved. No email sent — check email is configured.", ok: false });
      }
    } catch (err) {
      setFlash({ id, text: err.message, ok: false });
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this ticket permanently?")) return;
    const res = await fetch(`${ADMIN_API}/tickets/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) {
      setTickets((prev) => prev.filter((t) => t._id !== id));
      setActiveId((cur) => (cur === id ? null : cur));
    }
  };

  const sendResolution = (ticket) => {
    const resolution = (drafts[ticket._id] || "").trim();
    if (!resolution) {
      setFlash({ id: ticket._id, text: "Write a resolution note before sending.", ok: false });
      return;
    }
    const status = ticket.status === "closed" ? "closed" : "resolved";
    patchTicket(ticket._id, { resolution, status });
  };

  const shown = useMemo(
    () => (filter === "all" ? tickets : tickets.filter((t) => (t.status || "open") === filter)),
    [tickets, filter]
  );

  const openCount = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;
  const urgentCount = tickets.filter(
    (t) => (t.priority === "urgent" || t.priority === "high") && t.status !== "closed" && t.status !== "resolved"
  ).length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;

  const active = tickets.find((t) => t._id === activeId) || null;

  if (loading)
    return (
      <div className="admin__panel">
        <div className="admin__loading">
          <div className="admin__spinner" />
          Loading tickets…
        </div>
      </div>
    );
  if (error) return <div className="admin__error">{error}</div>;

  return (
    <div>
      {/* Stat cards */}
      <div className="admin__stats">
        <div className="admin__stat">
          <span className="admin__stat-label">Total Tickets</span>
          <div className="admin__stat-value">{tickets.length}</div>
        </div>
        <div className="admin__stat">
          <span className="admin__stat-label">Open</span>
          <div className="admin__stat-value">{openCount}</div>
        </div>
        <div className="admin__stat">
          <span className="admin__stat-label">High / Urgent</span>
          <div className="admin__stat-value">{urgentCount}</div>
        </div>
        <div className="admin__stat">
          <span className="admin__stat-label">Resolved</span>
          <div className="admin__stat-value">{resolvedCount}</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="tk__tabs" role="tablist" aria-label="Filter tickets by status">
        {["all", "open", "in_progress", "resolved", "closed"].map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={`tk__tab ${filter === f ? "tk__tab--active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : STATUS_LABELS[f]}
          </button>
        ))}
        <span className="tk__tabs-count">{shown.length} {shown.length === 1 ? "ticket" : "tickets"}</span>
      </div>

      {/* Horizontal ticket cards */}
      {shown.length === 0 ? (
        <div className="admin__panel">
          <div className="tk__empty">
            <FaInbox aria-hidden="true" />
            <p>No tickets{filter !== "all" ? ` marked "${STATUS_LABELS[filter]}"` : ""}.</p>
          </div>
        </div>
      ) : (
        <div className="tk__cards">
          {shown.map((t) => {
            const urgent = t.priority === "high" || t.priority === "urgent";
            return (
              <button
                key={t._id}
                type="button"
                className="tk__card"
                onClick={() => { setFlash(null); setActiveId(t._id); }}
              >
                <span className={`tk__card-rail tk__card-rail--${t.status || "open"}`} aria-hidden="true" />
                <span className="tk__card-avatar" aria-hidden="true">{initials(t.name)}</span>

                <span className="tk__card-main">
                  <span className="tk__card-line1">
                    <span className="tk__card-ref">{t.ticketNumber}</span>
                    <span className={`admin__badge admin__badge--${STATUS_BADGE[t.status] || "placed"}`}>
                      {STATUS_LABELS[t.status] || t.status}
                    </span>
                    {urgent && (
                      <span className={`tk__pri-flag tk__pri-flag--${t.priority}`}>
                        {PRIORITY_LABELS[t.priority]}
                      </span>
                    )}
                  </span>
                  <span className="tk__card-subject">{t.subject}</span>
                  <span className="tk__card-preview">{t.message}</span>
                </span>

                <span className="tk__card-meta">
                  <span className="tk__card-name">{t.name}</span>
                  <span className="tk__card-cat">{CATEGORY_LABELS[t.category] || "General"}</span>
                  <span className="tk__card-date">{new Date(t.createdAt).toLocaleDateString()}</span>
                </span>

                <FaChevronRight className="tk__card-chevron" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}

      {active && (
        <TicketModal
          ticket={active}
          draft={drafts[active._id] ?? ""}
          busy={!!busy[active._id]}
          flash={flash && flash.id === active._id ? flash : null}
          onDraft={(val) => setDrafts((d) => ({ ...d, [active._id]: val }))}
          onStatus={(status) => patchTicket(active._id, { status })}
          onPriority={(priority) => patchTicket(active._id, { priority })}
          onSend={() => sendResolution(active)}
          onDelete={() => remove(active._id)}
          onClose={() => setActiveId(null)}
        />
      )}
    </div>
  );
}

function TicketModal({ ticket, draft, busy, flash, onDraft, onStatus, onPriority, onSend, onDelete, onClose }) {
  const t = ticket;
  const urgent = t.priority === "high" || t.priority === "urgent";

  // Close on Escape for keyboard accessibility.
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="admin__modal-overlay" onClick={onClose}>
      <div
        className="admin__modal tk__modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tk-modal-title"
      >
        <div className="admin__modal-head">
          <div>
            <span className="tk__modal-ref">{t.ticketNumber}</span>
            <h3 id="tk-modal-title">{t.subject}</h3>
            <div className="tk__modal-badges">
              <span className={`admin__badge admin__badge--${STATUS_BADGE[t.status] || "placed"}`}>
                {STATUS_LABELS[t.status] || t.status}
              </span>
              <span className={`tk__cat-badge ${urgent ? "tk__cat-badge--warn" : ""}`}>
                {CATEGORY_LABELS[t.category] || "General"}
              </span>
              {urgent && (
                <span className="tk__pri-flag tk__pri-flag--head">
                  <FaExclamationTriangle aria-hidden="true" /> {PRIORITY_LABELS[t.priority]} priority
                </span>
              )}
            </div>
          </div>
          <button className="admin__icon-btn" onClick={onClose} aria-label="Close"><FaTimes /></button>
        </div>

        <div className="admin__modal-body tk__modal-body">
          {/* Requester */}
          <div className="tk__modal-section">
            <h4 className="tk__modal-label"><FaUserCircle aria-hidden="true" /> Requester</h4>
            <div className="tk__contact">
              <span className="tk__contact-item"><FaUserCircle aria-hidden="true" /> {t.name}</span>
              <a className="tk__contact-item" href={`mailto:${t.email}`}><FaEnvelope aria-hidden="true" /> {t.email}</a>
              {t.phone && <span className="tk__contact-item"><FaPhone aria-hidden="true" /> {t.phone}</span>}
              {t.orderNumber && <span className="tk__contact-item"><FaBoxOpen aria-hidden="true" /> {t.orderNumber}</span>}
            </div>
          </div>

          {/* Message */}
          <div className="tk__modal-section">
            <h4 className="tk__modal-label">Message</h4>
            <div className="tk__message-bubble">
              <div className="tk__message-meta">
                <strong>{t.name}</strong>
                <span>{formatDateTime(t.createdAt)}</span>
              </div>
              <p className="tk__message-text">{t.message}</p>
            </div>
          </div>

          {/* Manage */}
          <div className="tk__modal-section">
            <h4 className="tk__modal-label">Manage</h4>
            <div className="tk__controls">
              <label className="tk__control">
                <span>Status</span>
                <select className="admin__select" value={t.status} disabled={busy} onChange={(e) => onStatus(e.target.value)}>
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
              <label className="tk__control">
                <span>Priority</span>
                <select className="admin__select" value={t.priority} disabled={busy} onChange={(e) => onPriority(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
            </div>
          </div>

          {/* Resolution composer */}
          <div className="tk__modal-section">
            <h4 className="tk__modal-label"><FaPaperPlane aria-hidden="true" /> Resolution</h4>
            <p className="tk__reply-hint">This note is emailed to the customer when you send it.</p>
            <textarea
              className="tk__reply-input"
              rows={5}
              placeholder="Write the response the customer will receive…"
              value={draft}
              onChange={(e) => onDraft(e.target.value)}
            />
            <div className="tk__reply-actions">
              <button className="admin__btn admin__btn--primary" disabled={busy} onClick={onSend}>
                <FaPaperPlane /> {busy ? "Sending…" : "Send resolution & email"}
              </button>
              {flash && (
                <span className={`tk__flash ${flash.ok ? "tk__flash--ok" : "tk__flash--warn"}`}>
                  {flash.ok ? <FaCheckCircle aria-hidden="true" /> : <FaExclamationTriangle aria-hidden="true" />}
                  {flash.text}
                </span>
              )}
            </div>
          </div>

          {/* Activity */}
          <div className="tk__modal-activity">
            <span><FaRegClock aria-hidden="true" /> Raised {formatDateTime(t.createdAt)}</span>
            {t.resolvedAt && <span><FaCheckCircle aria-hidden="true" /> Resolved {formatDateTime(t.resolvedAt)}</span>}
            {t.handledBy?.name && <span>Handled by {t.handledBy.name}</span>}
          </div>
        </div>

        <div className="tk__modal-foot">
          <button className="admin__btn admin__btn--ghost admin__btn--danger" onClick={onDelete}>
            <FaTrashAlt /> Delete ticket
          </button>
          <button className="admin__btn admin__btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
