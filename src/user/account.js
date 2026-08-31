import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  FaBoxOpen,
  FaMapMarkerAlt,
  FaUserCircle,
  FaCheck,
  FaTruck,
  FaHome,
  FaRegClock,
  FaPen,
  FaTrashAlt,
  FaPlus,
  FaTimes,
} from "react-icons/fa";
import { API_URL } from "../config";
import { SiteFooter } from "./home_page";
import "./account.css";

const TABS = [
  { key: "overview", label: "Overview", icon: <FaUserCircle /> },
  { key: "orders", label: "My Orders", icon: <FaBoxOpen /> },
  { key: "addresses", label: "Addresses", icon: <FaMapMarkerAlt /> },
];

const ORDER_STEPS = [
  { key: "placed", label: "Placed", icon: <FaRegClock /> },
  { key: "confirmed", label: "Confirmed", icon: <FaCheck /> },
  { key: "processing", label: "Processing", icon: <FaBoxOpen /> },
  { key: "shipped", label: "Shipped", icon: <FaTruck /> },
  { key: "delivered", label: "Delivered", icon: <FaHome /> },
];

const EMPTY_ADDRESS = {
  label: "home",
  fullName: "",
  phone: "",
  addressLine: "",
  addressLine2: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  isDefault: false,
};

function getAuth() {
  try {
    const raw = localStorage.getItem("userInfo");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function Account() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user] = useState(getAuth());

  const tabParam = searchParams.get("tab");
  const activeTab = TABS.some((t) => t.key === tabParam) ? tabParam : "overview";

  useEffect(() => {
    if (!user || !user.token) {
      navigate("/login");
    }
  }, [user, navigate]);

  const setTab = (key) => setSearchParams(key === "overview" ? {} : { tab: key });

  if (!user || !user.token) return null;

  return (
    <div className="account">
      <header className="account__hero">
        <div className="account__hero-inner">
          <span className="account__eyebrow">My Account</span>
          <h1 className="account__title">
            Hello,{" "}
            <span className="serif-italic">{user.name?.split(" ")[0] || "there"}</span>
          </h1>
          <p className="account__subtitle">
            Manage your orders, delivery addresses, and account details.
          </p>
        </div>
      </header>

      <div className="account__body">
        <nav className="account__nav" aria-label="Account sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`account__nav-item ${activeTab === t.key ? "account__nav-item--active" : ""}`}
              onClick={() => setTab(t.key)}
              aria-current={activeTab === t.key ? "page" : undefined}
            >
              <span className="account__nav-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="account__content">
          {activeTab === "overview" && <Overview user={user} onNavigate={setTab} />}
          {activeTab === "orders" && <Orders auth={user} />}
          {activeTab === "addresses" && <Addresses auth={user} />}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

/* ── Overview ─────────────────────────────── */
function Overview({ user, onNavigate }) {
  return (
    <section className="account__panel">
      <div className="account__profile-card">
        <div className="account__avatar-lg">
          {user.name ? user.name.charAt(0).toUpperCase() : "U"}
        </div>
        <div>
          <h2 className="account__profile-name">{user.name}</h2>
          <p className="account__profile-email">{user.email}</p>
        </div>
      </div>

      <div className="account__quick">
        <button className="account__quick-card" onClick={() => onNavigate("orders")}>
          <FaBoxOpen />
          <span className="account__quick-title">My Orders</span>
          <span className="account__quick-sub">Track and review your purchases</span>
        </button>
        <button className="account__quick-card" onClick={() => onNavigate("addresses")}>
          <FaMapMarkerAlt />
          <span className="account__quick-title">Addresses</span>
          <span className="account__quick-sub">Manage your delivery locations</span>
        </button>
        <Link className="account__quick-card" to="/categories">
          <FaHome />
          <span className="account__quick-title">Continue Shopping</span>
          <span className="account__quick-sub">Explore the collection</span>
        </Link>
      </div>
    </section>
  );
}

/* ── Orders ───────────────────────────────── */
function Orders({ auth }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/orders/myorders`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!res.ok) throw new Error("Unable to load orders");
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [auth.token]);

  useEffect(() => {
    load();
  }, [load]);

  const cancelOrder = async (id) => {
    setCancelling(id);
    try {
      const res = await fetch(`${API_URL}/api/orders/${id}/cancel`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ reason: "Cancelled by customer" }),
      });
      if (res.ok) {
        const updated = await res.json();
        setOrders((prev) => prev.map((o) => (o._id === id ? { ...o, ...updated } : o)));
      }
    } catch {
      /* ignore */
    } finally {
      setCancelling(null);
    }
  };

  if (loading) return <div className="account__loading">Loading your orders…</div>;
  if (error) return <div className="account__empty"><p>{error}</p></div>;

  if (orders.length === 0) {
    return (
      <section className="account__panel">
        <div className="account__empty">
          <FaBoxOpen className="account__empty-icon" />
          <h3>No orders yet</h3>
          <p>When you place an order, it will appear here for you to track.</p>
          <Link to="/categories" className="btn btn-primary">Explore the Collection</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="account__panel">
      <h2 className="account__panel-title">My Orders</h2>
      <div className="orders">
        {orders.map((order) => (
          <OrderCard
            key={order._id}
            order={order}
            onCancel={cancelOrder}
            cancelling={cancelling === order._id}
          />
        ))}
      </div>
    </section>
  );
}

function OrderCard({ order, onCancel, cancelling }) {
  const items =
    order.orderItems && order.orderItems.length > 0
      ? order.orderItems
      : order.productId
      ? [
          {
            title: order.productId.title || "Item",
            image: order.productId.image,
            price: order.productId.price,
            quantity: order.quantity || 1,
          },
        ]
      : [];

  const status = order.orderStatus || "placed";
  const isCancelled = status === "cancelled";
  const isReturned = status === "returned";
  const stepIndex = ORDER_STEPS.findIndex((s) => s.key === status);
  const canCancel = ["placed", "confirmed", "processing"].includes(status);

  return (
    <article className="order-card">
      <header className="order-card__head">
        <div>
          <span className="order-card__label">Order</span>
          <span className="order-card__number">{order.orderNumber || order._id?.slice(-8)}</span>
        </div>
        <div className="order-card__head-right">
          <span className="order-card__date">{formatDate(order.createdAt)}</span>
          <span className={`order-card__status order-card__status--${status}`}>
            {status}
          </span>
        </div>
      </header>

      <div className="order-card__items">
        {items.map((item, i) => (
          <div className="order-card__item" key={i}>
            <div className="order-card__thumb">
              {item.image ? <img src={item.image} alt={item.title} /> : <FaBoxOpen />}
            </div>
            <div className="order-card__item-info">
              <span className="order-card__item-title">{item.title}</span>
              <span className="order-card__item-meta">
                Qty {item.quantity} · ₹{Number(item.price || 0).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {isCancelled || isReturned ? (
        <div className={`order-card__banner order-card__banner--${status}`}>
          {isCancelled ? "This order was cancelled." : "This order was returned."}
          {order.cancellationReason ? ` — ${order.cancellationReason}` : ""}
        </div>
      ) : (
        <div className="order-track" aria-label={`Order status: ${status}`}>
          {ORDER_STEPS.map((step, i) => {
            const done = i <= stepIndex;
            const current = i === stepIndex;
            return (
              <div
                key={step.key}
                className={`order-track__step ${done ? "is-done" : ""} ${current ? "is-current" : ""}`}
              >
                <span className="order-track__dot">{step.icon}</span>
                <span className="order-track__label">{step.label}</span>
              </div>
            );
          })}
        </div>
      )}

      <footer className="order-card__foot">
        <div className="order-card__totals">
          <span>Total</span>
          <strong>₹{Number(order.totalPrice || 0).toLocaleString()}</strong>
        </div>
        <div className="order-card__foot-right">
          {order.trackingNumber && (
            <span className="order-card__tracking">
              Tracking: <strong>{order.trackingNumber}</strong>
            </span>
          )}
          {canCancel && (
            <button
              className="order-card__cancel"
              onClick={() => onCancel(order._id)}
              disabled={cancelling}
            >
              {cancelling ? "Cancelling…" : "Cancel order"}
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}

/* ── Addresses ────────────────────────────── */
function Addresses({ auth }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${auth.token}`,
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/users/addresses`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAddresses(Array.isArray(data) ? data : []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [auth.token]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_ADDRESS, fullName: auth.name || "", isDefault: addresses.length === 0 });
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (addr) => {
    setEditing(addr._id);
    setForm({ ...EMPTY_ADDRESS, ...addr });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setFormError(null);
  };

  const change = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!form.addressLine.trim() || !form.city.trim() || !form.pincode.trim()) {
      setFormError("Address line, city, and pincode are required.");
      return;
    }
    if (!/^[0-9]{6}$/.test(form.pincode.trim())) {
      setFormError("Please enter a valid 6-digit pincode.");
      return;
    }

    setSaving(true);
    try {
      const url = editing
        ? `${API_URL}/api/users/address/${editing}`
        : `${API_URL}/api/users/address`;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers,
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Could not save address");
      }
      await load();
      closeForm();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/users/address/${id}`, {
        method: "DELETE",
        headers,
      });
      if (res.ok) await load();
    } catch {
      /* ignore */
    }
  };

  const setDefault = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/users/address/${id}/default`, {
        method: "PUT",
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setAddresses(Array.isArray(data) ? data : addresses);
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="account__panel">
      <div className="account__panel-head">
        <h2 className="account__panel-title">Addresses</h2>
        {!showForm && (
          <button className="btn btn-outline btn-sm" onClick={openAdd}>
            <FaPlus aria-hidden="true" /> Add address
          </button>
        )}
      </div>

      {showForm && (
        <form className="addr-form" onSubmit={submit}>
          <div className="addr-form__head">
            <h3>{editing ? "Edit address" : "New address"}</h3>
            <button type="button" className="addr-form__close" onClick={closeForm} aria-label="Close form">
              <FaTimes />
            </button>
          </div>

          <div className="addr-form__grid">
            <label className="addr-field">
              <span>Label</span>
              <select name="label" value={form.label} onChange={change}>
                <option value="home">Home</option>
                <option value="work">Work</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="addr-field">
              <span>Full name</span>
              <input name="fullName" value={form.fullName} onChange={change} placeholder="Recipient name" />
            </label>
            <label className="addr-field">
              <span>Phone</span>
              <input name="phone" value={form.phone} onChange={change} placeholder="10-digit mobile" />
            </label>
            <label className="addr-field addr-field--full">
              <span>Address line *</span>
              <input name="addressLine" value={form.addressLine} onChange={change} placeholder="House / flat, street" required />
            </label>
            <label className="addr-field addr-field--full">
              <span>Address line 2</span>
              <input name="addressLine2" value={form.addressLine2} onChange={change} placeholder="Area, colony (optional)" />
            </label>
            <label className="addr-field">
              <span>Landmark</span>
              <input name="landmark" value={form.landmark} onChange={change} placeholder="Nearby landmark" />
            </label>
            <label className="addr-field">
              <span>City *</span>
              <input name="city" value={form.city} onChange={change} required />
            </label>
            <label className="addr-field">
              <span>State</span>
              <input name="state" value={form.state} onChange={change} />
            </label>
            <label className="addr-field">
              <span>Pincode *</span>
              <input name="pincode" value={form.pincode} onChange={change} inputMode="numeric" maxLength={6} required />
            </label>
            <label className="addr-field">
              <span>Country</span>
              <input name="country" value={form.country} onChange={change} />
            </label>
          </div>

          <label className="addr-form__default">
            <input type="checkbox" name="isDefault" checked={form.isDefault} onChange={change} />
            <span>Set as default delivery address</span>
          </label>

          {formError && <p className="addr-form__error">{formError}</p>}

          <div className="addr-form__actions">
            <button type="button" className="btn btn-ghost" onClick={closeForm}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add address"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="account__loading">Loading addresses…</div>
      ) : addresses.length === 0 && !showForm ? (
        <div className="account__empty">
          <FaMapMarkerAlt className="account__empty-icon" />
          <h3>No addresses saved</h3>
          <p>Add a delivery address to check out faster.</p>
          <button className="btn btn-primary" onClick={openAdd}>Add your first address</button>
        </div>
      ) : (
        <div className="addr-grid">
          {addresses.map((addr) => (
            <article key={addr._id} className={`addr-card ${addr.isDefault ? "addr-card--default" : ""}`}>
              <div className="addr-card__top">
                <span className="addr-card__label">{addr.label}</span>
                {addr.isDefault && <span className="addr-card__default-badge">Default</span>}
              </div>
              {addr.fullName && <p className="addr-card__name">{addr.fullName}</p>}
              <p className="addr-card__lines">
                {addr.addressLine}
                {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}
                {addr.landmark ? `, ${addr.landmark}` : ""}
              </p>
              <p className="addr-card__lines">
                {addr.city}{addr.state ? `, ${addr.state}` : ""} — {addr.pincode}
              </p>
              <p className="addr-card__lines">{addr.country}</p>
              {addr.phone && <p className="addr-card__phone">Phone: {addr.phone}</p>}

              <div className="addr-card__actions">
                {!addr.isDefault && (
                  <button className="addr-card__action" onClick={() => setDefault(addr._id)}>
                    Set default
                  </button>
                )}
                <button className="addr-card__action" onClick={() => openEdit(addr)}>
                  <FaPen aria-hidden="true" /> Edit
                </button>
                <button className="addr-card__action addr-card__action--danger" onClick={() => remove(addr._id)}>
                  <FaTrashAlt aria-hidden="true" /> Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default Account;
