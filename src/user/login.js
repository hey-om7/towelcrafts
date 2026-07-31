import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash, FaLeaf, FaShieldAlt, FaTruck } from "react-icons/fa";
import GoogleSignInButton from "./GoogleSignInButton";
import { API_URL, GOOGLE_CLIENT_ID } from "../config";
import "./auth.css";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("userInfo", JSON.stringify(data));
        navigate("/");
      } else {
        setError(data.message || "Invalid email or password");
        setLoading(false);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred during login. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="auth">
      {/* Visual Panel */}
      <div className="auth__visual">
        <div className="auth__brand">
          <span className="auth__brand-text">Ambarkar</span>
          <span className="auth__brand-accent">Industries</span>
        </div>

        <div className="auth__visual-content">
          <h1 className="auth__visual-title">
            Welcome back to<br />
            <em>refined comfort</em>
          </h1>
          <p className="auth__visual-text">
            Sign in to access your orders, manage your addresses, and continue
            your journey with our premium towel collection.
          </p>
        </div>

        <div className="auth__visual-features">
          <div className="auth__visual-feature">
            <FaLeaf />
            <span>100% organic, sustainably sourced materials</span>
          </div>
          <div className="auth__visual-feature">
            <FaTruck />
            <span>Free shipping on orders over ₹999</span>
          </div>
          <div className="auth__visual-feature">
            <FaShieldAlt />
            <span>Secure checkout & 5-year quality guarantee</span>
          </div>
        </div>
      </div>

      {/* Form Panel */}
      <div className="auth__form-panel">
        <div className="auth__form-wrap">
          <div className="auth__mobile-brand">
            <span className="auth__brand-text">Ambarkar</span>
            <span className="auth__brand-accent">Industries</span>
          </div>

          <div className="auth__header">
            <h2 className="auth__title">Sign In</h2>
            <p className="auth__subtitle">Enter your credentials to access your account</p>
          </div>

          <form onSubmit={handleLogin} className="auth__form">
            {error && <div className="auth__error">{error}</div>}

            <div className="auth__field">
              <label className="auth__label">Email Address</label>
              <input
                type="email"
                className="auth__input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="auth__field">
              <label className="auth__label">Password</label>
              <div className="auth__input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  className="auth__input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
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

            <button type="submit" className="auth__submit" disabled={loading}>
              {loading ? <span className="auth__spinner" /> : "Sign In"}
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
            New customer?
            <Link to="/register">Create an account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
