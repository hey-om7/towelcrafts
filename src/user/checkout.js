import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { FaLock, FaMapMarkerAlt, FaShieldAlt, FaArrowLeft } from 'react-icons/fa';
import './checkout.css';

export default function Checkout() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const [address, setAddress] = useState(null);
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [quantity, setQuantity] = useState(state?.quantity || 1);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!state || !state.product) {
      navigate('/categories');
      return;
    }

    const fetchAddress = async () => {
      try {
        const userInfoRaw = localStorage.getItem('userInfo');
        const userInfo = userInfoRaw ? JSON.parse(userInfoRaw) : null;

        if (!userInfo || !userInfo.token) {
          navigate('/login');
          return;
        }

        const res = await fetch('http://localhost:5001/api/users/address', {
          headers: { Authorization: `Bearer ${userInfo.token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setAddress(data);
        }
      } catch (err) {
        console.error('Error fetching address:', err);
      } finally {
        setLoadingAddress(false);
      }
    };

    fetchAddress();
  }, [state, navigate]);

  const product = state?.product;

  const subtotal = product ? product.price * quantity : 0;
  const shipping = subtotal >= 999 ? 0 : 99;
  const total = subtotal + shipping;

  const handlePlaceOrder = async () => {
    setError(null);
    setPlacing(true);
    try {
      const userInfoRaw = localStorage.getItem('userInfo');
      const userInfo = userInfoRaw ? JSON.parse(userInfoRaw) : null;

      const orderData = {
        productId: product._id,
        quantity,
        totalPrice: total,
        paymentMethod,
      };

      const response = await fetch('http://localhost:5001/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo.token}`,
        },
        body: JSON.stringify(orderData),
      });

      if (response.ok) {
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

  if (!product) return null;

  return (
    <div className="checkout">
      <div className="checkout__container">
        {/* Header */}
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
            {/* Product */}
            <section className="checkout__section">
              <h2 className="checkout__section-title">Your Item</h2>
              <div className="checkout__product">
                <div className="checkout__product-image">
                  <img src={product.image} alt={product.title} />
                </div>
                <div className="checkout__product-info">
                  <span className="checkout__product-category">{product.category}</span>
                  <h3 className="checkout__product-name">{product.title}</h3>
                  <span className="checkout__product-price">₹{product.price?.toLocaleString()}</span>
                </div>
                <div className="checkout__quantity">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="checkout__qty-btn"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="checkout__qty-value">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="checkout__qty-btn"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>
            </section>

            {/* Shipping */}
            <section className="checkout__section">
              <h2 className="checkout__section-title">
                <FaMapMarkerAlt /> Shipping Address
              </h2>
              {loadingAddress ? (
                <div className="checkout__address-loading">Loading your address...</div>
              ) : address ? (
                <div className="checkout__address">
                  {address.fullName && <strong>{address.fullName}</strong>}
                  <p>{address.addressLine}</p>
                  {address.addressLine2 && <p>{address.addressLine2}</p>}
                  <p>
                    {address.city}{address.state ? `, ${address.state}` : ''} — {address.pincode}
                  </p>
                  <p>{address.country}</p>
                  {address.phone && <p className="checkout__address-phone">Phone: {address.phone}</p>}
                </div>
              ) : (
                <div className="checkout__no-address">
                  <p>No shipping address on record.</p>
                  <Link to="/register" className="checkout__add-address">
                    Add an address to continue
                  </Link>
                </div>
              )}
            </section>

            {/* Payment */}
            <section className="checkout__section">
              <h2 className="checkout__section-title">Payment Method</h2>
              <div className="checkout__payment-options">
                <label className={`checkout__payment-option ${paymentMethod === 'cod' ? 'checkout__payment-option--active' : ''}`}>
                  <input
                    type="radio"
                    name="payment"
                    value="cod"
                    checked={paymentMethod === 'cod'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  />
                  <div>
                    <strong>Cash on Delivery</strong>
                    <span>Pay when your order arrives</span>
                  </div>
                </label>
                <label className={`checkout__payment-option ${paymentMethod === 'upi' ? 'checkout__payment-option--active' : ''}`}>
                  <input
                    type="radio"
                    name="payment"
                    value="upi"
                    checked={paymentMethod === 'upi'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  />
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
                <span>Subtotal ({quantity} {quantity === 1 ? 'item' : 'items'})</span>
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
                disabled={placing || !address}
              >
                {placing ? (
                  <span className="checkout__btn-loading">
                    <span className="checkout__spinner" /> Placing Order...
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
