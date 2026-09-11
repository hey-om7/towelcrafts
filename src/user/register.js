import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash, FaGift, FaHeart, FaStar } from "react-icons/fa";
import GoogleSignInButton from "./GoogleSignInButton";
import { API_URL, GOOGLE_CLIENT_ID } from "../config";
import "./auth.css";

export function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    addressLine: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("userInfo", JSON.stringify(data));
        navigate("/");
      } else {
        setError(data.message || "Registration failed");
        setLoading(false);
      }
    } catch (err) {
      console.error("Registration error:", err);
      setError("An error occurred during registration. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="auth">
      {/* Visual Panel */}
      <div className="auth__visual">
        <div className="auth__brand">
          <img src="/towelcrafts-logo.png" alt="" className="auth__brand-mark auth__brand-mark--light" aria-hidden="true" />
          <span className="auth__brand-text">Towel</span>
          <span className="auth__brand-accent">Crafts</span>
        </div>

        <div className="auth__visual-content">
          <h1 className="auth__visual-title">
            Join the world of<br />
            <em>everyday luxury</em>
          </h1>
          <p className="auth__visual-text">
            Create your account to enjoy a personalized shopping experience,
            faster checkout, and exclusive member benefits.
          </p>
        </div>

        <div className="auth__visual-features">
          <div className="auth__visual-feature">
            <FaGift />
            <span>Welcome offer on your first order</span>
          </div>
          <div className="auth__visual-feature">
            <FaHeart />
            <span>Save your favorite products & addresses</span>
          </div>
          <div className="auth__visual-feature">
            <FaStar />
            <span>Early access to new collections</span>
          </div>
        </div>
      </div>

      {/* Form Panel */}
      <div className="auth__form-panel">
        <div className="auth__form-wrap">
          <div className="auth__mobile-brand">
            <img src="/towelcrafts-logo.png" alt="" className="auth__brand-mark" aria-hidden="true" />
            <span className="auth__brand-text">Towel</span>
            <span className="auth__brand-accent">Crafts</span>
          </div>

          <div className="auth__header">
            <h2 className="auth__title">Create Account</h2>
            <p className="auth__subtitle">Join us and start shopping premium towels</p>
          </div>

          <form onSubmit={handleRegister} className="auth__form">
            {error && <div className="auth__error">{error}</div>}

            <div className="auth__field">
              <label className="auth__label">Full Name</label>
              <input
                type="text"
                name="name"
                className="auth__input"
                value={form.name}
                onChange={handleChange}
                placeholder="Your full name"
                required
                autoComplete="name"
              />
            </div>

            <div className="auth__row">
              <div className="auth__field">
                <label className="auth__label">Email Address</label>
                <input
                  type="email"
                  name="email"
                  className="auth__input"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="auth__field">
                <label className="auth__label">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  className="auth__input"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="10-digit number"
                  autoComplete="tel"
                />
              </div>
            </div>

            <div className="auth__field">
              <label className="auth__label">Password</label>
              <div className="auth__input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className="auth__input"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Minimum 6 characters"
                  required
                  autoComplete="new-password"
                  style={{ width: "100%", paddingRight: "44px" }}
                />
                <button
                  type="button"
                  className="auth__input-toggle"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <div className="auth__section-label">Shipping Address</div>

            <div className="auth__field">
              <label className="auth__label">Address Line</label>
              <input
                type="text"
                name="addressLine"
                className="auth__input"
                value={form.addressLine}
                onChange={handleChange}
                placeholder="Street, house/flat number"
                required
                autoComplete="street-address"
              />
            </div>

            <div className="auth__row">
              <div className="auth__field">
                <label className="auth__label">City</label>
                <input
                  type="text"
                  name="city"
                  className="auth__input"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="City"
                  required
                />
              </div>
              <div className="auth__field">
                <label className="auth__label">State</label>
                <input
                  type="text"
                  name="state"
                  className="auth__input"
                  value={form.state}
                  onChange={handleChange}
                  placeholder="State"
                />
              </div>
            </div>

            <div className="auth__row">
              <div className="auth__field">
                <label className="auth__label">Pincode</label>
                <input
                  type="text"
                  name="pincode"
                  className="auth__input"
                  value={form.pincode}
                  onChange={handleChange}
                  placeholder="6-digit pincode"
                  required
                />
              </div>
              <div className="auth__field">
                <label className="auth__label">Country</label>
                <input
                  type="text"
                  name="country"
                  className="auth__input"
                  value={form.country}
                  onChange={handleChange}
                  placeholder="Country"
                  required
                />
              </div>
            </div>

            <button type="submit" className="auth__submit" disabled={loading}>
              {loading ? <span className="auth__spinner" /> : "Create Account"}
            </button>
          </form>

          {GOOGLE_CLIENT_ID && (
            <>
              <div className="divider">or</div>
              <GoogleSignInButton
                onSuccess={() => navigate("/")}
                onError={(msg) => setError(msg)}
              />
            </>
          )}

          <div className="auth__footer">
            Already have an account?
            <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
