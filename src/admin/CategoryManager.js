import { useState, useEffect } from "react";
import { FaPlus, FaEdit, FaTrash } from "react-icons/fa";
import { API_URL } from "../config";

function CategoryForm({ category, onCancel, onSaved }) {
  const isNew = category === "new" || !category;
  const existing = isNew ? {} : category;

  const [form, setForm] = useState({
    id: existing._id || "",
    title: existing.title || "",
    subtitle: existing.subtitle || "",
    description: existing.description || "",
    image: existing.image || "",
    displayOrder: existing.displayOrder ?? 0,
    active: existing.active !== undefined ? existing.active : true,
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const payload = {
        ...form,
        id: Number(form.id),
        displayOrder: Number(form.displayOrder),
      };
      const url = isNew ? `${API_URL}/api/categories` : `${API_URL}/api/categories/${existing._id}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${userInfo.token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onSaved();
      } else {
        const data = await res.json();
        setError(data.message || "Failed to save category");
        setSaving(false);
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin__form">
      {error && <div className="admin__error" style={{ marginBottom: "var(--space-5)" }}>{error}</div>}
      <div className="admin__form-grid">
        <div className="admin__form-group">
          <label className="admin__form-label">Category ID (unique number)</label>
          <input type="number" name="id" className="admin__form-input" value={form.id} onChange={handleChange} required disabled={!isNew} />
        </div>
        <div className="admin__form-group">
          <label className="admin__form-label">Display Order</label>
          <input type="number" name="displayOrder" className="admin__form-input" value={form.displayOrder} onChange={handleChange} />
        </div>
        <div className="admin__form-group">
          <label className="admin__form-label">Title</label>
          <input type="text" name="title" className="admin__form-input" value={form.title} onChange={handleChange} required />
        </div>
        <div className="admin__form-group">
          <label className="admin__form-label">Subtitle</label>
          <input type="text" name="subtitle" className="admin__form-input" value={form.subtitle} onChange={handleChange} placeholder="e.g. Wrap & Unwind" />
        </div>
        <div className="admin__form-group admin__form-group--full">
          <label className="admin__form-label">Image URL</label>
          <input type="text" name="image" className="admin__form-input" value={form.image} onChange={handleChange} placeholder="/category_image.png" required />
        </div>
        <div className="admin__form-group admin__form-group--full">
          <label className="admin__form-label">Description</label>
          <textarea name="description" className="admin__form-textarea" value={form.description} onChange={handleChange} />
        </div>
        <div className="admin__form-group">
          <label className="admin__form-label" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
            <input type="checkbox" name="active" checked={form.active} onChange={handleChange} style={{ width: 18, height: 18, accentColor: "var(--color-primary)" }} />
            Active (visible on storefront)
          </label>
        </div>
        <div className="admin__form-actions">
          <button type="submit" className="admin__btn admin__btn--primary" disabled={saving}>
            {saving ? "Saving..." : isNew ? "Create Category" : "Save Changes"}
          </button>
          <button type="button" className="admin__btn admin__btn--ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </form>
  );
}

export default function CategoryManager() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_URL}/api/categories?all=true`);
      if (!res.ok) throw new Error("Failed to load categories");
      setCategories(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this category?")) return;
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const res = await fetch(`${API_URL}/api/categories/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${userInfo.token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setCategories((prev) => prev.filter((c) => c._id !== id));
      } else {
        alert(data.message || "Failed to delete category");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaved = () => {
    setEditing(null);
    setLoading(true);
    fetchCategories();
  };

  if (editing) {
    return <CategoryForm category={editing} onCancel={() => setEditing(null)} onSaved={handleSaved} />;
  }

  if (loading) {
    return (
      <div className="admin__panel">
        <div className="admin__loading">
          <div className="admin__spinner" />
          Loading categories...
        </div>
      </div>
    );
  }

  if (error) return <div className="admin__error">{error}</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-4)" }}>
        <button className="admin__btn admin__btn--primary" onClick={() => setEditing("new")}>
          <FaPlus /> Add Category
        </button>
      </div>

      <div className="admin__panel">
        <table className="admin__table">
          <thead>
            <tr>
              <th>Category</th>
              <th>ID</th>
              <th>Products</th>
              <th>Order</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat._id}>
                <td>
                  <div className="admin__table-product">
                    <img src={cat.image} alt={cat.title} />
                    <div>
                      <div className="admin__table-product-name">{cat.title}</div>
                      <div className="admin__mono">{cat.subtitle}</div>
                    </div>
                  </div>
                </td>
                <td><span className="admin__mono">{cat._id}</span></td>
                <td>{cat.productCount ?? 0}</td>
                <td>{cat.displayOrder}</td>
                <td>
                  <span className={`admin__badge ${cat.active ? "admin__badge--delivered" : "admin__badge--cancelled"}`}>
                    {cat.active ? "Active" : "Hidden"}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    <button className="admin__btn admin__btn--ghost admin__btn--sm" onClick={() => setEditing(cat)}>
                      <FaEdit /> Edit
                    </button>
                    <button className="admin__btn admin__btn--danger admin__btn--sm" onClick={() => handleDelete(cat._id)}>
                      <FaTrash />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
