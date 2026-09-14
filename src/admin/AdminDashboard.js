import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  FaBox, FaShoppingCart, FaSignOutAlt, FaArrowLeft,
  FaChartPie, FaTags, FaUsers, FaStar, FaLifeRing, FaFileAlt, FaWallet, FaBars, FaTimes, FaTicketAlt,
} from "react-icons/fa";
import Overview from "./Overview";
import { ProductList } from "./ProductList";
import { ProductEdit } from "./ProductEdit";
import CategoryManager from "./CategoryManager";
import Orders from "./orders";
import Payments from "./Payments";
import Customers from "./Customers";
import Reviews from "./Reviews";
import Support from "./Support";
import Tickets from "./Tickets";
import Reports from "./Reports";
import "./admin.css";

const TABS = [
  { id: "overview", label: "Overview", icon: <FaChartPie />, group: "Analyse", sub: "Business analytics and performance at a glance" },
  { id: "reports", label: "Reports", icon: <FaFileAlt />, group: "Analyse", sub: "Monthly performance reports — export or print" },
  { id: "orders", label: "Orders", icon: <FaShoppingCart />, group: "Sell", sub: "View, modify, and fulfil customer orders" },
  { id: "payments", label: "Payments", icon: <FaWallet />, group: "Sell", sub: "Track collections and payment status" },
  { id: "products", label: "Products", icon: <FaBox />, group: "Catalog", sub: "Manage your product catalog" },
  { id: "categories", label: "Categories", icon: <FaTags />, group: "Catalog", sub: "Organize your product collections" },
  { id: "customers", label: "Customers", icon: <FaUsers />, group: "People", sub: "Manage users, access, orders, and addresses" },
  { id: "reviews", label: "Reviews", icon: <FaStar />, group: "People", sub: "Moderate product reviews and ratings" },
  { id: "support", label: "Support", icon: <FaLifeRing />, group: "People", sub: "Customer help, complaints, and suggestions" },
  { id: "tickets", label: "Tickets", icon: <FaTicketAlt />, group: "People", sub: "Support tickets raised from the contact page" },
];

const GROUPS = ["Analyse", "Sell", "Catalog", "People"];

export function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Derive the active tab from the URL so a refresh (or a shared link) keeps
  // the admin on the same section. Falls back to "overview" for an unknown or
  // missing tab.
  const tabParam = searchParams.get("tab");
  const activeTab = TABS.some((t) => t.id === tabParam) ? tabParam : "overview";
  const [editingProduct, setEditingProduct] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();

  // Determine access from the stored session. This mirrors the server's admin
  // rule (isAdmin OR role admin/superadmin) so the client gate never disagrees
  // with the API. Rendered as a clear screen — not a silent redirect.
  const userInfo = JSON.parse(localStorage.getItem("userInfo") || "null");
  const isLoggedIn = Boolean(userInfo && userInfo.token);
  const isAdminUser =
    isLoggedIn &&
    Array.isArray(userInfo.roles) &&
    userInfo.roles.some((r) => r === "admin" || r === "manager");

  const handleLogout = () => {
    localStorage.removeItem("userInfo");
    navigate("/");
    window.location.reload();
  };

  // Gate: show an explicit access screen instead of rendering the dashboard.
  if (!isAdminUser) {
    return (
      <div className="admin-denied">
        <div className="admin-denied__card">
          <span className="admin-denied__badge">Restricted area</span>
          <h1 className="admin-denied__title">
            {isLoggedIn ? "You don't have admin access" : "Please sign in"}
          </h1>
          <p className="admin-denied__text">
            {isLoggedIn ? (
              <>
                You're signed in{userInfo?.email ? ` as ${userInfo.email}` : ""}, but this
                account doesn't have administrator rights. If you believe this is a
                mistake, contact an existing administrator to request access.
              </>
            ) : (
              <>You need to sign in with an administrator account to view this area.</>
            )}
          </p>
          <div className="admin-denied__actions">
            <Link to="/" className="admin__btn admin__btn--ghost">
              <FaArrowLeft /> Back to store
            </Link>
            {isLoggedIn ? (
              <button className="admin__btn admin__btn--primary" onClick={handleLogout}>
                Sign in as a different user
              </button>
            ) : (
              <Link to="/login" className="admin__btn admin__btn--primary">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const handleTabChange = (tab) => {
    // Persist the tab in the URL (?tab=…) so it survives a refresh; keep the
    // URL clean for the default Overview tab.
    setSearchParams(tab === "overview" ? {} : { tab }, { replace: true });
    setEditingProduct(null);
    setDrawerOpen(false);
  };

  const activeMeta = TABS.find((t) => t.id === activeTab);

  const NavItems = () => (
    <>
      {GROUPS.map((group) => (
        <div className="admin__nav-group" key={group}>
          <span className="admin__nav-group-label">{group}</span>
          {TABS.filter((t) => t.group === group).map((tab) => (
            <button
              key={tab.id}
              className={`admin__nav-item ${activeTab === tab.id ? "admin__nav-item--active" : ""}`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      ))}
    </>
  );

  return (
    <div className="admin">
      {/* Sidebar (desktop) */}
      <aside className="admin__sidebar">
        <div className="admin__brand">
          <img src="/towelcrafts-logo.png" alt="" className="admin__brand-mark" aria-hidden="true" />
          <span className="admin__brand-text">TowelCrafts</span>
          <span className="admin__brand-accent">Admin</span>
        </div>
        <nav className="admin__nav"><NavItems /></nav>
        <div className="admin__sidebar-footer">
          <Link to="/" className="admin__back-site"><FaArrowLeft /> Back to Store</Link>
          <button className="admin__back-site admin__signout" onClick={handleLogout}>
            <FaSignOutAlt /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="admin__topbar">
        <button className="admin__topbar-toggle" onClick={() => setDrawerOpen(true)} aria-label="Open menu"><FaBars /></button>
        <span className="admin__topbar-title">{activeMeta?.label}</span>
        <Link to="/" className="admin__topbar-home" aria-label="Back to store"><FaArrowLeft /></Link>
      </header>

      {/* Mobile drawer */}
      <div className={`admin__drawer ${drawerOpen ? "admin__drawer--open" : ""}`}>
        <div className="admin__drawer-backdrop" onClick={() => setDrawerOpen(false)} />
        <div className="admin__drawer-panel">
          <div className="admin__brand">
            <img src="/towelcrafts-logo.png" alt="" className="admin__brand-mark" aria-hidden="true" />
            <span className="admin__brand-text">TowelCrafts</span>
            <span className="admin__brand-accent">Admin</span>
            <button className="admin__drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Close menu"><FaTimes /></button>
          </div>
          <nav className="admin__nav"><NavItems /></nav>
          <div className="admin__sidebar-footer">
            <Link to="/" className="admin__back-site"><FaArrowLeft /> Back to Store</Link>
            <button className="admin__back-site admin__signout" onClick={handleLogout}><FaSignOutAlt /> Sign Out</button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="admin__content">
        <div className="admin__header">
          <div>
            <h1 className="admin__header-title">{editingProduct ? "Manage Product" : activeMeta?.label}</h1>
            <p className="admin__header-subtitle">{activeMeta?.sub}</p>
          </div>
        </div>

        {activeTab === "overview" && <Overview />}
        {activeTab === "reports" && <Reports />}
        {activeTab === "orders" && <Orders />}
        {activeTab === "payments" && <Payments />}
        {activeTab === "products" && !editingProduct && <ProductList onEdit={(product) => setEditingProduct(product)} />}
        {activeTab === "products" && editingProduct && <ProductEdit product={editingProduct} onCancel={() => setEditingProduct(null)} />}
        {activeTab === "categories" && <CategoryManager />}
        {activeTab === "customers" && <Customers />}
        {activeTab === "reviews" && <Reviews />}
        {activeTab === "support" && <Support />}
        {activeTab === "tickets" && <Tickets />}
      </main>
    </div>
  );
}
