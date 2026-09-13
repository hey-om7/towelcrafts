import { useState, useEffect } from "react";
import { categories as fallbackCategories } from "../user/data";
import { API_URL } from "../config";
import { ImageUploader } from "./ImageUploader";

export function ProductEdit({ product, onCancel }) {
  const isNew = product === "new" || !product;
  const existing = isNew ? {} : product;

  const [categories, setCategories] = useState(fallbackCategories);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_URL}/api/categories?all=true`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setCategories(data.map((c) => ({ ...c, id: c._id })));
          }
        }
      } catch (err) {
        console.error("Error fetching categories:", err);
      }
    };
    fetchCategories();
  }, []);

  const [form, setForm] = useState({
    id: existing._id || "",
    title: existing.title || "",
    price: existing.price || "",
    originalPrice: existing.originalPrice || "",
    image: existing.image || "",
    description: existing.description || "",
    shortDescription: existing.shortDescription || "",
    categoryId: existing.categoryId || 1,
    category: existing.category || categories[0]?.title || "",
    material: existing.material || "",
    weight: existing.weight || "",
    dimensions: existing.dimensions || "",
    color: existing.color || "",
    stockQuantity: existing.stockQuantity ?? 100,
    featured: existing.featured || false,
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === "categoryId") {
      const cat = categories.find((c) => c.id === Number(value));
      setForm((f) => ({ ...f, categoryId: Number(value), category: cat ? cat.title : "" }));
    } else {
      setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
    }
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
        price: Number(form.price),
        originalPrice: form.originalPrice ? Number(form.originalPrice) : undefined,
        categoryId: Number(form.categoryId),
        stockQuantity: Number(form.stockQuantity),
      };

      const url = isNew
        ? `${API_URL}/api/products`
        : `${API_URL}/api/products/${existing._id}`;
      const method = isNew ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userInfo.token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        onCancel();
      } else {
        const data = await response.json();
        setError(data.message || "Failed to save product");
        setSaving(false);
      }
    } catch (err) {
      console.error("Error saving product:", err);
      setError("An error occurred. Please try again.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin__form">
      {error && <div className="admin__error" style={{ marginBottom: "var(--space-5)" }}>{error}</div>}

      <div className="admin__form-grid">
        <div className="admin__form-group">
          <label className="admin__form-label">Product ID (unique number)</label>
          <input
            type="number"
            name="id"
            className="admin__form-input"
            value={form.id}
            onChange={handleChange}
            required
            disabled={!isNew}
          />
        </div>

        <div className="admin__form-group">
          <label className="admin__form-label">Category</label>
          <select
            name="categoryId"
            className="admin__form-select"
            value={form.categoryId}
            onChange={handleChange}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        <div className="admin__form-group admin__form-group--full">
          <label className="admin__form-label">Product Name</label>
          <input
            type="text"
            name="title"
            className="admin__form-input"
            value={form.title}
            onChange={handleChange}
            required
          />
        </div>

        <div className="admin__form-group">
          <label className="admin__form-label">Price (₹)</label>
          <input
            type="number"
            name="price"
            className="admin__form-input"
            value={form.price}
            onChange={handleChange}
            required
          />
        </div>

        <div className="admin__form-group">
          <label className="admin__form-label">Original Price (₹, optional)</label>
          <input
            type="number"
            name="originalPrice"
            className="admin__form-input"
            value={form.originalPrice}
            onChange={handleChange}
          />
        </div>

        <div className="admin__form-group admin__form-group--full">
          <ImageUploader
            label="Product Image"
            required
            folder="products"
            value={form.image}
            onChange={(url) => {
              setForm((f) => ({ ...f, image: url }));
            }}
          />
        </div>

        <div className="admin__form-group admin__form-group--full">
          <label className="admin__form-label">Short Description</label>
          <input
            type="text"
            name="shortDescription"
            className="admin__form-input"
            value={form.shortDescription}
            onChange={handleChange}
            placeholder="One-line summary shown on product cards"
          />
        </div>

        <div className="admin__form-group admin__form-group--full">
          <label className="admin__form-label">Full Description</label>
          <textarea
            name="description"
            className="admin__form-textarea"
            value={form.description}
            onChange={handleChange}
            required
          />
        </div>

        <div className="admin__form-group">
          <label className="admin__form-label">Material</label>
          <input type="text" name="material" className="admin__form-input" value={form.material} onChange={handleChange} placeholder="e.g. 100% Egyptian Cotton" />
        </div>

        <div className="admin__form-group">
          <label className="admin__form-label">Weight (GSM)</label>
          <input type="text" name="weight" className="admin__form-input" value={form.weight} onChange={handleChange} placeholder="e.g. 600 GSM" />
        </div>

        <div className="admin__form-group">
          <label className="admin__form-label">Dimensions</label>
          <input type="text" name="dimensions" className="admin__form-input" value={form.dimensions} onChange={handleChange} placeholder="e.g. 140 x 70 cm" />
        </div>

        <div className="admin__form-group">
          <label className="admin__form-label">Color</label>
          <input type="text" name="color" className="admin__form-input" value={form.color} onChange={handleChange} />
        </div>

        <div className="admin__form-group">
          <label className="admin__form-label">Stock Quantity</label>
          <input type="number" name="stockQuantity" className="admin__form-input" value={form.stockQuantity} onChange={handleChange} />
        </div>

        <div className="admin__form-group" style={{ justifyContent: "flex-end" }}>
          <label className="admin__form-label" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
            <input type="checkbox" name="featured" checked={form.featured} onChange={handleChange} style={{ width: "18px", height: "18px", accentColor: "var(--color-primary)" }} />
            Featured Product
          </label>
        </div>

        <div className="admin__form-actions">
          <button type="submit" className="admin__btn admin__btn--primary" disabled={saving}>
            {saving ? "Saving..." : isNew ? "Create Product" : "Save Changes"}
          </button>
          <button type="button" className="admin__btn admin__btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
