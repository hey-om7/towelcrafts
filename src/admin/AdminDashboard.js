import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaBox, FaShoppingCart, FaCommentDots, FaSignOutAlt, FaArrowLeft, FaChartPie, FaTags } from "react-icons/fa";
import Overview from "./Overview";
import { ProductList } from "./ProductList";
import { ProductEdit } from "./ProductEdit";
import CategoryManager from "./CategoryManager";
import Orders from "./orders";
import Feedbacks from "./Feedbacks";
import "./admin.css";

const TABS = [
  { id: "overview", label: "Overview", icon: <FaChartPie /> },
  { id: "products", label: "Products", icon: <FaBox /> },
  { id: "categories", label: "Categories", icon: <FaTags /> },
  { id: "orders", label: "Orders", icon: <FaShoppingCart /> },
  { id: "feedbacks", label: "Feedbacks", icon: <FaCommentDots /> },
];

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [editingProduct, setEditingProduct] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem("userInfo"));
    if (!userInfo || !userInfo.isAdmin) {
      navigate("/");
    }
  }, [navigate]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setEditingProduct(null);
  };

  const handleLogout = () => {
    localStorage.removeItem("userInfo");
    navigate("/");
    window.location.reload();
  };

  const activeMeta = TABS.find((t) => t.id === activeTab);

  return (
    <div className="admin">
      {/* Sidebar */}
      <aside className="admin__sidebar">
        <div className="admin__brand">
          <span className="admin__brand-text">Ambarkar</span>
          <span className="admin__brand-accent">Admin</span>
        </div>

        <nav className="admin__nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`admin__nav-item ${activeTab === tab.id ? "admin__nav-item--active" : ""}`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="admin__sidebar-footer">
          <Link to="/" className="admin__back-site">
            <FaArrowLeft /> Back to Store
          </Link>
          <button className="admin__back-site" onClick={handleLogout} style={{ width: "100%", border: "none", cursor: "pointer" }}>
            <FaSignOutAlt /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Nav */}
      <div className="admin__mobile-nav">
        {TABS.map((tab) => (
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

      {/* Content */}
      <main className="admin__content">
        <div className="admin__header">
          <div>
            <h1 className="admin__header-title">
              {editingProduct ? "Manage Product" : activeMeta?.label}
            </h1>
            <p className="admin__header-subtitle">
              {activeTab === "overview" && "Business analytics and performance at a glance"}
              {activeTab === "products" && "Manage your product catalog"}
              {activeTab === "categories" && "Organize your product collections"}
              {activeTab === "orders" && "View and update customer orders"}
              {activeTab === "feedbacks" && "Review customer feedback and ratings"}
            </p>
          </div>
        </div>

        {activeTab === "overview" && <Overview />}
        {activeTab === "products" && !editingProduct && (
          <ProductList onEdit={(product) => setEditingProduct(product)} />
        )}
        {activeTab === "products" && editingProduct && (
          <ProductEdit
            product={editingProduct}
            onCancel={() => setEditingProduct(null)}
          />
        )}
        {activeTab === "categories" && <CategoryManager />}
        {activeTab === "orders" && <Orders />}
        {activeTab === "feedbacks" && <Feedbacks />}
      </main>
    </div>
  );
}
