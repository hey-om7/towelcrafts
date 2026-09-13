import { Link, useNavigate } from "react-router-dom";
import { FaTrashAlt, FaArrowLeft, FaShoppingBag, FaLock } from "react-icons/fa";
import { useCart } from "./CartContext";
import { imageUrl } from "../config";
import "./cart.css";

export function Cart() {
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, subtotal, count } = useCart();

  const shipping = subtotal === 0 ? 0 : subtotal >= 999 ? 0 : 99;
  const total = subtotal + shipping;

  const handleCheckout = () => {
    const userInfoRaw = localStorage.getItem("userInfo");
    const userInfo = userInfoRaw ? JSON.parse(userInfoRaw) : null;
    if (!userInfo || !userInfo.token) {
      navigate("/login");
      return;
    }
    navigate("/checkout", { state: { fromCart: true } });
  };

  if (items.length === 0) {
    return (
      <div className="cart">
        <div className="cart__container">
          <div className="cart__empty">
            <div className="cart__empty-icon" aria-hidden="true">
              <FaShoppingBag />
            </div>
            <h1 className="cart__empty-title">Your cart is empty</h1>
            <p className="cart__empty-text">
              Explore our collections and add the towels you love — they'll wait
              for you right here.
            </p>
            <Link to="/categories" className="cart__empty-btn">
              Browse Collections
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cart">
      <div className="cart__container">
        <header className="cart__header">
          <Link to="/categories" className="cart__back">
            <FaArrowLeft aria-hidden="true" /> Continue shopping
          </Link>
          <h1 className="cart__title">Shopping Cart</h1>
          <p className="cart__subtitle">
            {count} {count === 1 ? "item" : "items"} in your cart
          </p>
        </header>

        <div className="cart__grid">
          {/* Items */}
          <ul className="cart__list">
            {items.map((item) => (
              <li className="cart-line" key={item.id}>
                <Link to={`/category/${item.categoryId ?? ""}/product/${item.id}`} className="cart-line__image">
                  <img src={imageUrl(item.image)} alt={item.title} loading="lazy" />
                </Link>

                <div className="cart-line__body">
                  <div className="cart-line__info">
                    {item.category && <span className="cart-line__category">{item.category}</span>}
                    <h2 className="cart-line__title">{item.title}</h2>
                    <span className="cart-line__unit">₹{item.price?.toLocaleString()} each</span>
                  </div>

                  <div className="cart-line__controls">
                    <div className="cart-line__qty">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="cart-line__qty-btn"
                        aria-label={`Decrease quantity of ${item.title}`}
                        disabled={item.quantity <= 1}
                      >
                        −
                      </button>
                      <span className="cart-line__qty-value">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="cart-line__qty-btn"
                        aria-label={`Increase quantity of ${item.title}`}
                      >
                        +
                      </button>
                    </div>

                    <span className="cart-line__total">
                      ₹{(item.price * item.quantity).toLocaleString()}
                    </span>

                    <button
                      className="cart-line__remove"
                      onClick={() => removeItem(item.id)}
                      aria-label={`Remove ${item.title} from cart`}
                    >
                      <FaTrashAlt aria-hidden="true" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Summary */}
          <aside className="cart__summary">
            <div className="cart__summary-card">
              <h2 className="cart__summary-title">Order Summary</h2>

              <div className="cart__summary-row">
                <span>Subtotal ({count} {count === 1 ? "item" : "items"})</span>
                <span>₹{subtotal.toLocaleString()}</span>
              </div>
              <div className="cart__summary-row">
                <span>Shipping</span>
                <span>{shipping === 0 ? <em className="cart__free">FREE</em> : `₹${shipping}`}</span>
              </div>
              {shipping > 0 && (
                <p className="cart__shipping-note">
                  Add ₹{(999 - subtotal).toLocaleString()} more for free shipping
                </p>
              )}

              <div className="cart__summary-divider" />

              <div className="cart__summary-total">
                <span>Total</span>
                <span>₹{total.toLocaleString()}</span>
              </div>

              <button className="cart__checkout-btn" onClick={handleCheckout}>
                <FaLock aria-hidden="true" /> Proceed to Checkout
              </button>

              <p className="cart__summary-note">
                Taxes calculated at checkout. Secure payment.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
