import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaUser, FaBars, FaTimes, FaChevronDown, FaUserCircle, FaBoxOpen, FaMapMarkerAlt, FaShoppingBag } from "react-icons/fa";
import { useCart } from "./CartContext";
import "./navbar.css";

function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const { count } = useCart();
  const userInfo = JSON.parse(localStorage.getItem("userInfo"));
  const isStaffUser =
    Array.isArray(userInfo?.roles) &&
    userInfo.roles.some((r) => r === "admin" || r === "manager");

  const handleLogout = () => {
    localStorage.removeItem("userInfo");
    setDropdownOpen(false);
    setMobileOpen(false);
    navigate("/");
    window.location.reload();
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setDropdownOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // Hide the storefront navbar on admin routes — the admin section has its own chrome.
  if (location.pathname.startsWith("/admin")) {
    return null;
  }

  const isHome = location.pathname === "/";
  const isActive = (path) => location.pathname === path;

  const navLinks = [
    { path: "/", label: "Home" },
    { path: "/about", label: "About" },
    { path: "/categories", label: "Collection" },
    { path: "/contact", label: "Contact" },
  ];

  return (
    <>
      <nav
        className={`navbar ${scrolled ? "navbar--scrolled" : ""} ${
          isHome && !scrolled ? "navbar--transparent" : ""
        }`}
      >
        <div className="navbar__inner">
          {/* Logo */}
          <Link to="/" className="navbar__logo">
            <img src="/towelcrafts-logo.png" alt="" className="navbar__logo-mark" aria-hidden="true" />
            <span className="navbar__logo-text">Towel</span>
            <span className="navbar__logo-accent">Crafts</span>
          </Link>

          {/* Desktop Navigation */}
          <ul className="navbar__links">
            {navLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  className={`navbar__link ${
                    isActive(link.path) ? "navbar__link--active" : ""
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Right Actions */}
          <div className="navbar__actions">
            <Link to="/cart" className="navbar__cart" aria-label={`Cart${count ? `, ${count} item${count === 1 ? "" : "s"}` : ", empty"}`}>
              <FaShoppingBag />
              {count > 0 && <span className="navbar__cart-badge">{count > 99 ? "99+" : count}</span>}
            </Link>
            {userInfo ? (
              <div className="navbar__profile" ref={dropdownRef}>
                <button
                  className="navbar__profile-btn"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  aria-label="Account menu"
                  aria-expanded={dropdownOpen}
                >
                  <div className="navbar__avatar">
                    {userInfo.name ? userInfo.name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <span className="navbar__profile-name">{userInfo.name?.split(" ")[0]}</span>
                  <FaChevronDown
                    className={`navbar__profile-chevron ${
                      dropdownOpen ? "navbar__profile-chevron--open" : ""
                    }`}
                  />
                </button>

                {dropdownOpen && (
                  <div className="navbar__dropdown">
                    <div className="navbar__dropdown-header">
                      <p className="navbar__dropdown-name">{userInfo.name}</p>
                      <p className="navbar__dropdown-email">{userInfo.email}</p>
                    </div>
                    <div className="navbar__dropdown-divider" />
                    <Link to="/account" className="navbar__dropdown-item">
                      <FaUserCircle size={16} />
                      My Account
                    </Link>
                    <Link to="/account?tab=orders" className="navbar__dropdown-item">
                      <FaBoxOpen size={16} />
                      My Orders
                    </Link>
                    <Link to="/account?tab=addresses" className="navbar__dropdown-item">
                      <FaMapMarkerAlt size={16} />
                      Addresses
                    </Link>
                    <div className="navbar__dropdown-divider" />
                    {isStaffUser && (
                      <Link to="/admin" className="navbar__dropdown-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                          <path d="M2 17l10 5 10-5"/>
                          <path d="M2 12l10 5 10-5"/>
                        </svg>
                        Admin Panel
                      </Link>
                    )}
                    <button onClick={handleLogout} className="navbar__dropdown-item navbar__dropdown-item--danger">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="navbar__login-btn">
                <FaUser size={14} />
                <span>Sign In</span>
              </Link>
            )}

            {/* Mobile Toggle */}
            <button
              className="navbar__mobile-toggle"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <FaTimes /> : <FaBars />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div className={`mobile-menu ${mobileOpen ? "mobile-menu--open" : ""}`}>
        <div className="mobile-menu__backdrop" onClick={() => setMobileOpen(false)} />
        <div className="mobile-menu__panel">
          <div className="mobile-menu__header">
            <Link to="/" className="navbar__logo" onClick={() => setMobileOpen(false)}>
              <img src="/towelcrafts-logo.png" alt="" className="navbar__logo-mark" aria-hidden="true" />
              <span className="navbar__logo-text">Towel</span>
              <span className="navbar__logo-accent">Crafts</span>
            </Link>
            <button
              className="mobile-menu__close"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <FaTimes />
            </button>
          </div>

          <ul className="mobile-menu__links">
            {navLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  className={`mobile-menu__link ${
                    isActive(link.path) ? "mobile-menu__link--active" : ""
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/cart"
                className={`mobile-menu__link ${isActive("/cart") ? "mobile-menu__link--active" : ""}`}
                onClick={() => setMobileOpen(false)}
              >
                Cart{count > 0 ? ` (${count})` : ""}
              </Link>
            </li>
          </ul>

          <div className="mobile-menu__footer">
            {userInfo ? (
              <>
                <div className="mobile-menu__user">
                  <div className="navbar__avatar navbar__avatar--lg">
                    {userInfo.name ? userInfo.name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div>
                    <p className="mobile-menu__user-name">{userInfo.name}</p>
                    <p className="mobile-menu__user-email">{userInfo.email}</p>
                  </div>
                </div>
                {isStaffUser && (
                  <Link
                    to="/admin"
                    className="mobile-menu__action-btn"
                    onClick={() => setMobileOpen(false)}
                  >
                    Admin Panel
                  </Link>
                )}
                <Link
                  to="/account"
                  className="mobile-menu__action-btn"
                  onClick={() => setMobileOpen(false)}
                >
                  My Account
                </Link>
                <Link
                  to="/account?tab=orders"
                  className="mobile-menu__action-btn"
                  onClick={() => setMobileOpen(false)}
                >
                  My Orders
                </Link>
                <Link
                  to="/account?tab=addresses"
                  className="mobile-menu__action-btn"
                  onClick={() => setMobileOpen(false)}
                >
                  Addresses
                </Link>
                <button onClick={handleLogout} className="mobile-menu__logout-btn">
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="mobile-menu__login-btn"
                onClick={() => setMobileOpen(false)}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default NavBar;
