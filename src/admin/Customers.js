import { useState, useEffect, useCallback } from "react";
import { FaEye, FaTimes, FaTrashAlt, FaPen } from "react-icons/fa";
import { ADMIN_API, isAuthError } from "../config";

const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

// Roles model helpers (mirror the server).
const STAFF_ROLES = ["admin", "manager"];
const rolesOf = (u) => (Array.isArray(u?.roles) ? u.roles : []);
const isStaff = (u) => rolesOf(u).some((r) => STAFF_ROLES.includes(r));
// A short human label for the roles a user holds, e.g. "Admin", "Manager",
// "Admin · Manager", or "Customer" for a plain user.
const roleLabel = (u) => {
  const staff = rolesOf(u).filter((r) => STAFF_ROLES.includes(r));
  if (staff.length === 0) return "Customer";
  return staff.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(" · ");
};

export default function Customers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(null);

  const authHeaders = () => {
    const u = JSON.parse(localStorage.getItem("userInfo"));
    return { "Content-Type": "application/json", Authorization: `Bearer ${u?.token}` };
  };

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${ADMIN_API}/users?limit=200`, { headers: authHeaders() });
      if (isAuthError(res)) throw new Error("You don't have permission to view customers.");
      if (!res.ok) throw new Error(`Failed to load customers (${res.status})`);
      const data = await res.json();
      setUsers(data.users || data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const patchUser = (id, patch) =>
    setUsers((prev) => prev.map((u) => (u._id === id ? { ...u, ...patch } : u)));

  if (loading) return <div className="admin__panel"><div className="admin__loading"><div className="admin__spinner" />Loading customers…</div></div>;
  if (error) return <div className="admin__error">{error}</div>;

  const shown = users.filter(
    (u) =>
      !query ||
      u.name?.toLowerCase().includes(query.toLowerCase()) ||
      u.email?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <div className="admin__stats">
        <div className="admin__stat"><span className="admin__stat-label">Total Customers</span><div className="admin__stat-value">{users.length}</div></div>
        <div className="admin__stat"><span className="admin__stat-label">Staff</span><div className="admin__stat-value">{users.filter(isStaff).length}</div></div>
        <div className="admin__stat"><span className="admin__stat-label">Deactivated</span><div className="admin__stat-value">{users.filter((u) => u.isActive === false).length}</div></div>
      </div>

      <div className="admin__toolbar">
        <input className="admin__form-input admin__search" placeholder="Search name or email…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <span className="admin__toolbar-count">{shown.length} customers</span>
      </div>

      <div className="admin__panel admin__panel--table">
        <table className="admin__table admin__table--cards">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Access</th><th>Joined</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u._id}>
                <td data-label="Name"><span className="admin__table-product-name">{u.name}</span></td>
                <td data-label="Email"><span className="admin__mono">{u.email}</span></td>
                <td data-label="Role"><span className={`admin__badge admin__badge--${isStaff(u) ? "approved" : "placed"}`}>{roleLabel(u)}</span></td>
                <td data-label="Access"><span className={`admin__badge admin__badge--${u.isActive === false ? "cancelled" : "delivered"}`}>{u.isActive === false ? "Disabled" : "Active"}</span></td>
                <td data-label="Joined">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                <td data-label="Actions">
                  <button className="admin__icon-btn" title="View / manage" onClick={() => setActiveId(u._id)}><FaEye /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeId && (
        <CustomerModal
          userId={activeId}
          onClose={() => setActiveId(null)}
          onUserPatched={patchUser}
          authHeaders={authHeaders}
        />
      )}
    </div>
  );
}

function CustomerModal({ userId, onClose, onUserPatched, authHeaders }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingAddr, setEditingAddr] = useState(null);
  // Admin-promotion OTP flow: null when idle, otherwise the pending request.
  const [otp, setOtp] = useState(null); // { role, code, stage, error, busy }

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${ADMIN_API}/users/${userId}`, { headers: authHeaders() });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const saveUser = async (patch) => {
    setSaving(true);
    const res = await fetch(`${ADMIN_API}/users/${userId}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = await res.json();
      setData((d) => ({ ...d, user: { ...d.user, ...updated } }));
      onUserPatched(userId, updated);
    }
    setSaving(false);
  };

  // Toggle a single staff role (admin/manager) on the user.
  //  - Turning ON a role the user lacks = escalation → OTP approval flow.
  //  - Turning OFF a role = direct save (demotion), no approval needed.
  const currentRoles = rolesOf(data?.user);
  const toggleRole = (role, turnOn) => {
    if (turnOn) {
      if (currentRoles.includes(role)) return;
      setOtp({ role, code: "", stage: "request", error: null, busy: false });
    } else {
      const nextRoles = currentRoles.filter((r) => r !== role);
      saveUser({ roles: nextRoles });
    }
  };

  // Step 1: ask the server to email an approval code to the approver.
  const requestOtp = async () => {
    setOtp((o) => ({ ...o, busy: true, error: null }));
    try {
      const res = await fetch(`${ADMIN_API}/users/${userId}/role-otp/request`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ role: otp.role }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not send approval code.");
      setOtp((o) => ({ ...o, busy: false, stage: "verify", error: null }));
    } catch (err) {
      setOtp((o) => ({ ...o, busy: false, error: err.message }));
    }
  };

  // Step 2: submit the entered code; on success apply the promoted user.
  const verifyOtp = async () => {
    const code = (otp.code || "").trim();
    if (!code) {
      setOtp((o) => ({ ...o, error: "Enter the code sent to the approver." }));
      return;
    }
    setOtp((o) => ({ ...o, busy: true, error: null }));
    try {
      const res = await fetch(`${ADMIN_API}/users/${userId}/role-otp/verify`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ role: otp.role, code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Verification failed.");
      // Success: `body` is the updated user document.
      setData((d) => ({ ...d, user: { ...d.user, ...body } }));
      onUserPatched(userId, body);
      setOtp(null);
    } catch (err) {
      setOtp((o) => ({ ...o, busy: false, error: err.message }));
    }
  };

  const cancelOtp = () => setOtp(null);

  const deleteAddress = async (addrId) => {
    const res = await fetch(`${ADMIN_API}/users/${userId}/address/${addrId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) setData((d) => ({ ...d, addresses: d.addresses.filter((a) => a._id !== addrId) }));
  };

  const saveAddress = async (addrId, patch) => {
    const res = await fetch(`${ADMIN_API}/users/${userId}/address/${addrId}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = await res.json();
      setData((d) => ({ ...d, addresses: d.addresses.map((a) => (a._id === addrId ? updated : a)) }));
      setEditingAddr(null);
    }
  };

  const u = data?.user;

  return (
    <div className="admin__modal-overlay" onClick={onClose}>
      <div className="admin__modal" onClick={(e) => e.stopPropagation()}>
        {loading || !u ? (
          <div className="admin__loading" style={{ padding: "3rem" }}><div className="admin__spinner" />Loading…</div>
        ) : (
          <>
            <div className="admin__modal-head">
              <div>
                <h3>{u.name}</h3>
                <span className="admin__modal-sub">{u.email}</span>
              </div>
              <button className="admin__icon-btn" onClick={onClose} aria-label="Close"><FaTimes /></button>
            </div>

            <div className="admin__modal-body">
              {/* Access / role controls */}
              <h4 className="admin__modal-label">User Access</h4>
              <div className="admin__form-grid">
                <div className="admin__form-group admin__form-group--full">
                  <label className="admin__form-label">Staff roles</label>
                  <div className="admin__roles">
                    {["admin", "manager"].map((role) => {
                      const has = currentRoles.includes(role);
                      const pendingThis = otp && otp.role === role;
                      return (
                        <label key={role} className="admin__role-toggle">
                          <input
                            type="checkbox"
                            checked={has}
                            disabled={saving || (!!otp && !pendingThis)}
                            onChange={(e) => toggleRole(role, e.target.checked)}
                          />
                          <span>{role.charAt(0).toUpperCase() + role.slice(1)}</span>
                        </label>
                      );
                    })}
                    <span className="admin__role-hint">
                      Every account is a customer. Granting a staff role requires email approval.
                    </span>
                  </div>
                  {otp && (
                    <div className="admin__otp">
                      {otp.stage === "request" ? (
                        <>
                          <p className="admin__otp-text">
                            Granting <strong>{otp.role.charAt(0).toUpperCase() + otp.role.slice(1)}</strong> access
                            requires email approval. A one-time code will be sent to the authorized approver.
                          </p>
                          {otp.error && <p className="admin__otp-error">{otp.error}</p>}
                          <div className="admin__otp-actions">
                            <button type="button" className="admin__btn admin__btn--ghost admin__btn--sm" onClick={cancelOtp} disabled={otp.busy}>Cancel</button>
                            <button type="button" className="admin__btn admin__btn--primary admin__btn--sm" onClick={requestOtp} disabled={otp.busy}>
                              {otp.busy ? "Sending…" : "Send approval code"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="admin__otp-text">
                            Enter the code emailed to the approver to confirm <strong>{otp.role.charAt(0).toUpperCase() + otp.role.slice(1)}</strong> access.
                          </p>
                          <input
                            className="admin__form-input"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            placeholder="6-digit code"
                            value={otp.code}
                            onChange={(e) => setOtp((o) => ({ ...o, code: e.target.value.replace(/\D/g, ""), error: null }))}
                            onKeyDown={(e) => { if (e.key === "Enter") verifyOtp(); }}
                            disabled={otp.busy}
                            autoFocus
                          />
                          {otp.error && <p className="admin__otp-error">{otp.error}</p>}
                          <div className="admin__otp-actions">
                            <button type="button" className="admin__btn admin__btn--ghost admin__btn--sm" onClick={cancelOtp} disabled={otp.busy}>Cancel</button>
                            <button type="button" className="admin__btn admin__btn--ghost admin__btn--sm" onClick={requestOtp} disabled={otp.busy}>Resend</button>
                            <button type="button" className="admin__btn admin__btn--primary admin__btn--sm" onClick={verifyOtp} disabled={otp.busy}>
                              {otp.busy ? "Verifying…" : "Confirm access"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="admin__form-group">
                  <label className="admin__form-label">Account access</label>
                  <select className="admin__form-select" value={u.isActive === false ? "disabled" : "active"} onChange={(e) => saveUser({ isActive: e.target.value === "active" })} disabled={saving}>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
                <div className="admin__form-group">
                  <label className="admin__form-label">Name</label>
                  <input className="admin__form-input" defaultValue={u.name} onBlur={(e) => e.target.value !== u.name && saveUser({ name: e.target.value })} />
                </div>
                <div className="admin__form-group">
                  <label className="admin__form-label">Phone</label>
                  <input className="admin__form-input" defaultValue={u.phone || ""} onBlur={(e) => e.target.value !== (u.phone || "") && saveUser({ phone: e.target.value })} />
                </div>
              </div>

              {/* Addresses */}
              <div className="admin__modal-section-head">
                <h4 className="admin__modal-label">Addresses ({data.addresses.length})</h4>
              </div>
              {data.addresses.length === 0 ? (
                <p className="admin__modal-text">No saved addresses.</p>
              ) : (
                <div className="admin__addr-list">
                  {data.addresses.map((a) =>
                    editingAddr === a._id ? (
                      <AddressEditor key={a._id} address={a} onCancel={() => setEditingAddr(null)} onSave={(patch) => saveAddress(a._id, patch)} />
                    ) : (
                      <div key={a._id} className="admin__addr-item">
                        <div>
                          <span className="admin__addr-label">{a.label}{a.isDefault ? " · Default" : ""}</span>
                          <p className="admin__modal-text">
                            {a.fullName ? a.fullName + " — " : ""}{a.addressLine}{a.addressLine2 ? `, ${a.addressLine2}` : ""}, {a.city}{a.state ? `, ${a.state}` : ""} — {a.pincode}, {a.country}
                            {a.phone ? ` · ${a.phone}` : ""}
                          </p>
                        </div>
                        <div className="admin__addr-actions">
                          <button className="admin__icon-btn" title="Edit" onClick={() => setEditingAddr(a._id)}><FaPen /></button>
                          <button className="admin__icon-btn admin__icon-btn--danger" title="Delete" onClick={() => deleteAddress(a._id)}><FaTrashAlt /></button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Orders */}
              <div className="admin__modal-section-head">
                <h4 className="admin__modal-label">Orders ({data.stats.orderCount}) · {inr(data.stats.revenue)} lifetime</h4>
              </div>
              {data.orders.length === 0 ? (
                <p className="admin__modal-text">No orders yet.</p>
              ) : (
                <div className="admin__addr-list">
                  {data.orders.map((o) => (
                    <div key={o._id} className="admin__addr-item">
                      <div>
                        <span className="admin__mono">{o.orderNumber || o._id.slice(-8)}</span>
                        <p className="admin__modal-text">{new Date(o.createdAt).toLocaleDateString()} · {inr(o.totalPrice)}</p>
                      </div>
                      <span className={`admin__badge admin__badge--${o.orderStatus}`}>{o.orderStatus}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="admin__modal-foot">
              <span className="admin__modal-sub">{saving ? "Saving…" : "Changes save automatically"}</span>
              <button className="admin__btn admin__btn--primary" onClick={onClose}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AddressEditor({ address, onCancel, onSave }) {
  const [f, setF] = useState({ ...address });
  const ch = (e) => setF({ ...f, [e.target.name]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  return (
    <div className="admin__addr-item admin__addr-item--edit">
      <div className="admin__form-grid">
        <input className="admin__form-input" name="fullName" value={f.fullName || ""} onChange={ch} placeholder="Full name" />
        <input className="admin__form-input" name="phone" value={f.phone || ""} onChange={ch} placeholder="Phone" />
        <input className="admin__form-input admin__form-group--full" name="addressLine" value={f.addressLine || ""} onChange={ch} placeholder="Address line" />
        <input className="admin__form-input" name="city" value={f.city || ""} onChange={ch} placeholder="City" />
        <input className="admin__form-input" name="state" value={f.state || ""} onChange={ch} placeholder="State" />
        <input className="admin__form-input" name="pincode" value={f.pincode || ""} onChange={ch} placeholder="Pincode" />
        <input className="admin__form-input" name="country" value={f.country || ""} onChange={ch} placeholder="Country" />
      </div>
      <label className="admin__addr-default-check">
        <input type="checkbox" name="isDefault" checked={!!f.isDefault} onChange={ch} /> Default
      </label>
      <div className="admin__modal-foot-right">
        <button className="admin__btn admin__btn--ghost admin__btn--sm" onClick={onCancel}>Cancel</button>
        <button className="admin__btn admin__btn--primary admin__btn--sm" onClick={() => onSave(f)}>Save</button>
      </div>
    </div>
  );
}
