import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { FaLock, FaMapMarkerAlt, FaShieldAlt, FaArrowLeft, FaPlus, FaCheck } from 'react-icons/fa';
import { API_URL, imageUrl } from '../config';
import { useCart } from './CartContext';
import './checkout.css';

const EMPTY_ADDRESS = {
  label: 'home',
  fullName: '',
  phone: '',
  addressLine: '',
  addressLine2: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
  isDefault: false,
};

export default function Checkout() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { items: cartItems, clearCart } = useCart();

  const fromCart = !!state?.fromCart;

  const [addresses, setAddresses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [quantity, setQuantity] = useState(state?.quantity || 1);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [error, setError] = useState(null);

  // Inline "add address" form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [savingAddr, setSavingAddr] = useState(false);
  const [formError, setFormError] = useState(null);

  const getAuth = () => {
    try {
      const raw = localStorage.getItem('userInfo');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const loadAddresses = useCallback(async () => {
    const userInfo = getAuth();
    if (!userInfo || !userInfo.token) {
      navigate('/login');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/users/addresses`, {
        headers: { Authorization: `Bearer ${userInfo.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setAddresses(list);
        setSelectedId((prev) => {
          if (prev && list.some((a) => a._id === prev)) return prev;
          const def = list.find((a) => a.isDefault) || list[0];
          return def ? def._id : null;
        });
        if (list.length === 0) setShowForm(true);
      }
    } catch (err) {
      console.error('Error fetching addresses:', err);
    } finally {
      setLoadingAddress(false);
    }
  }, [navigate]);

  useEffect(() => {
    // Allow either a single "Buy Now" product or a cart checkout. If neither
    // is present (or the cart is empty), there's nothing to check out.
    const hasSingle = !!state?.product;
    const hasCart = fromCart && cartItems.length > 0;
    if (!hasSingle && !hasCart) {
      navigate(fromCart ? '/cart' : '/categories');
      return;
    }
    loadAddresses();
  }, [state, fromCart, cartItems.length, navigate, loadAddresses]);

  // Unified list of line items for rendering + order payload.
  // Buy Now: a single line with the editable `quantity`.
  // Cart: one line per cart item, using each item's stored quantity.
  const lineItems = fromCart
    ? cartItems.map((it) => ({
        productId: it.id,
        title: it.title,
        image: it.image,
        category: it.category,
        price: it.price,
        quantity: it.quantity,
      }))
    : state?.product
    ? [
        {
          productId: state.product._id,
          title: state.product.title,
          image: state.product.image,
          category: state.product.category,
          price: state.product.price,
          quantity,
        },
      ]
    : [];

  const totalItems = lineItems.reduce((n, l) => n + l.quantity, 0);
  const subtotal = lineItems.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const shipping = subtotal >= 999 ? 0 : 99;
  const total = subtotal + shipping;

  const changeForm = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const saveAddress = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!form.addressLine.trim() || !form.city.trim() || !form.pincode.trim()) {
      setFormError('Address line, city, and pincode are required.');
      return;
    }
    if (!/^[0-9]{6}$/.test(form.pincode.trim())) {
      setFormError('Please enter a valid 6-digit pincode.');
      return;
    }
    setSavingAddr(true);
    try {
      const userInfo = getAuth();
      const res = await fetch(`${API_URL}/api/users/address`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo.token}`,
        },
        body: JSON.stringify({ ...form, isDefault: form.isDefault || addresses.length === 0 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Could not save address');
      }
      const created = await res.json();
      setShowForm(false);
      setForm(EMPTY_ADDRESS);
      await loadAddresses();
      if (created && created._id) setSelectedId(created._id);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSavingAddr(false);
    }
  };

  const handlePlaceOrder = async () => {
    setError(null);
    if (!selectedId) {
      setError('Please select or add a delivery address.');
      return;
    }
    if (lineItems.length === 0) {
      setError('Your order is empty.');
      return;
    }
    setPlacing(true);
    try {
      const userInfo = getAuth();
      const orderData = {
        items: lineItems.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        totalPrice: total,
        paymentMethod,
        addressId: selectedId,
      };

      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo.token}`,
        },
        body: JSON.stringify(orderData),
      });

      if (response.ok) {
        if (fromCart) clearCart();
        navigate('/order-completed');
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to place order');
        setPlacing(false);
      }
    } catch (err) {
      console.error('Error placing order:', err);
      setError('An error occurred. Please try again.');
      setPlacing(false);
    }
  };

  if (lineItems.length === 0) return null;

  return (
    <div className="checkout">
      <div className="checkout__container">
        <div className="checkout__header">
          <button className="checkout__back" onClick={() => navigate(-1)}>
            <FaArrowLeft /> Back
          </button>
          <h1 className="checkout__title">Checkout</h1>
          <p className="checkout__subtitle">Review your order and confirm your purchase</p>
        </div>

        <div className="checkout__grid">
          {/* LEFT: Details */}
          <div className="checkout__main">
            {/* Product(s) */}
            <section className="checkout__section">
              <div className="checkout__section-head">
                <h2 className="checkout__section-title">
                  {lineItems.length > 1 ? `Your Items (${lineItems.length})` : 'Your Item'}
                </h2>
                {fromCart && (
                  <Link to="/cart" className="checkout__add-btn">Edit cart</Link>
                )}
              </div>

              {lineItems.map((line) => (
                <div className="checkout__product" key={line.productId}>
                  <div className="checkout__product-image">
                    <img src={imageUrl(line.image)} alt={line.title} />
                  </div>
                  <div className="checkout__product-info">
                    <span className="checkout__product-category">{line.category}</span>
                    <h3 className="checkout__product-name">{line.title}</h3>
                    <span className="checkout__product-price">₹{line.price?.toLocaleString()}</span>
                  </div>

                  {fromCart ? (
                    <div className="checkout__product-qty-static">Qty {line.quantity}</div>
                  ) : (
                    <div className="checkout__quantity">
                      <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="checkout__qty-btn" aria-label="Decrease quantity">−</button>
                      <span className="checkout__qty-value">{line.quantity}</span>
                      <button onClick={() => setQuantity((q) => q + 1)} className="checkout__qty-btn" aria-label="Increase quantity">+</button>
                    </div>
                  )}
                </div>
              ))}
            </section>

            {/* Shipping address selection */}
            <section className="checkout__section">
              <div className="checkout__section-head">
                <h2 className="checkout__section-title">
                  <FaMapMarkerAlt /> Delivery Address
                </h2>
                {addresses.length > 0 && !showForm && (
                  <button className="checkout__add-btn" onClick={() => { setForm({ ...EMPTY_ADDRESS }); setShowForm(true); }}>
                    <FaPlus aria-hidden="true" /> Add new
                  </button>
                )}
              </div>

              {loadingAddress ? (
                <div className="checkout__address-loading">Loading your addresses…</div>
              ) : (
                <>
                  {addresses.length > 0 && (
                    <div className="checkout__addr-list">
                      {addresses.map((addr) => (
                        <label
                          key={addr._id}
                          className={`checkout__addr-option ${selectedId === addr._id ? 'checkout__addr-option--active' : ''}`}
                        >
                          <input
                            type="radio"
                            name="address"
                            value={addr._id}
                            checked={selectedId === addr._id}
                            onChange={() => setSelectedId(addr._id)}
                          />
                          <span className="checkout__addr-radio" aria-hidden="true">
                            {selectedId === addr._id && <FaCheck />}
                          </span>
                          <span className="checkout__addr-body">
                            <span className="checkout__addr-top">
                              <span className="checkout__addr-label">{addr.label}</span>
                              {addr.isDefault && <span className="checkout__addr-default">Default</span>}
                            </span>
                            {addr.fullName && <strong>{addr.fullName}</strong>}
                            <span>
                              {addr.addressLine}{addr.addressLine2 ? `, ${addr.addressLine2}` : ''}
                            </span>
                            <span>{addr.city}{addr.state ? `, ${addr.state}` : ''} — {addr.pincode}</span>
                            {addr.phone && <span className="checkout__addr-phone">Phone: {addr.phone}</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {showForm ? (
                    <form className="checkout__addr-form" onSubmit={saveAddress}>
                      <h3 className="checkout__addr-form-title">Add a delivery address</h3>
                      <div className="checkout__addr-form-grid">
                        <input name="fullName" value={form.fullName} onChange={changeForm} placeholder="Full name" />
                        <input name="phone" value={form.phone} onChange={changeForm} placeholder="Phone" />
                        <input className="checkout__addr-full" name="addressLine" value={form.addressLine} onChange={changeForm} placeholder="Address line *" required />
                        <input className="checkout__addr-full" name="addressLine2" value={form.addressLine2} onChange={changeForm} placeholder="Apartment, area (optional)" />
                        <input name="city" value={form.city} onChange={changeForm} placeholder="City *" required />
                        <input name="state" value={form.state} onChange={changeForm} placeholder="State" />
                        <input name="pincode" value={form.pincode} onChange={changeForm} placeholder="Pincode *" inputMode="numeric" maxLength={6} required />
                        <input name="country" value={form.country} onChange={changeForm} placeholder="Country" />
                      </div>
                      {formError && <p className="checkout__addr-form-error">{formError}</p>}
                      <div className="checkout__addr-form-actions">
                        {addresses.length > 0 && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
                        )}
                        <button type="submit" className="btn btn-primary btn-sm" disabled={savingAddr}>
                          {savingAddr ? 'Saving…' : 'Save address'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    addresses.length === 0 && (
                      <div className="checkout__no-address">
                        <p>No delivery address on record.</p>
                        <button className="checkout__add-address" onClick={() => setShowForm(true)}>
                          Add an address to continue
                        </button>
                      </div>
                    )
                  )}

                  <p className="checkout__manage-note">
                    Manage all your addresses in <Link to="/account?tab=addresses">your account</Link>.
                  </p>
                </>
              )}
            </section>

            {/* Payment */}
            <section className="checkout__section">
              <h2 className="checkout__section-title">Payment Method</h2>
              <div className="checkout__payment-options">
                <label className={`checkout__payment-option ${paymentMethod === 'cod' ? 'checkout__payment-option--active' : ''}`}>
                  <input type="radio" name="payment" value="cod" checked={paymentMethod === 'cod'} onChange={(e) => setPaymentMethod(e.target.value)} />
                  <div>
                    <strong>Cash on Delivery</strong>
                    <span>Pay when your order arrives</span>
                  </div>
                </label>
                <label className={`checkout__payment-option ${paymentMethod === 'upi' ? 'checkout__payment-option--active' : ''}`}>
                  <input type="radio" name="payment" value="upi" checked={paymentMethod === 'upi'} onChange={(e) => setPaymentMethod(e.target.value)} />
                  <div>
                    <strong>UPI / Online</strong>
                    <span>Pay securely online</span>
                  </div>
                </label>
              </div>
            </section>
          </div>

          {/* RIGHT: Summary */}
          <aside className="checkout__summary">
            <div className="checkout__summary-card">
              <h2 className="checkout__summary-title">Order Summary</h2>

              <div className="checkout__summary-row">
                <span>Subtotal ({totalItems} {totalItems === 1 ? 'item' : 'items'})</span>
                <span>₹{subtotal.toLocaleString()}</span>
              </div>
              <div className="checkout__summary-row">
                <span>Shipping</span>
                <span>{shipping === 0 ? <em className="checkout__free">FREE</em> : `₹${shipping}`}</span>
              </div>
              {shipping > 0 && (
                <p className="checkout__shipping-note">
                  Add ₹{(999 - subtotal).toLocaleString()} more for free shipping
                </p>
              )}

              <div className="checkout__summary-divider" />

              <div className="checkout__summary-total">
                <span>Total</span>
                <span>₹{total.toLocaleString()}</span>
              </div>

              {error && <div className="checkout__error">{error}</div>}

              <button
                className="checkout__place-btn"
                onClick={handlePlaceOrder}
                disabled={placing || !selectedId}
              >
                {placing ? (
                  <span className="checkout__btn-loading">
                    <span className="checkout__spinner" /> Placing Order…
                  </span>
                ) : (
                  <>
                    <FaLock /> Place Order
                  </>
                )}
              </button>

              <div className="checkout__secure">
                <FaShieldAlt />
                <span>Secure checkout — your data is protected</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
