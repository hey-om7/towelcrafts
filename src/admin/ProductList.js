import { useState, useEffect } from "react";
import { FaPlus, FaTrash, FaEdit } from "react-icons/fa";
import { API_URL, ADMIN_API, imageUrl } from "../config";

export function ProductList({ onEdit }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/products?limit=200`);
      const data = await response.json();
      setProducts(data.products || data);
    } catch (err) {
      console.error("Error fetching products:", err);
      setError("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const res = await fetch(`${ADMIN_API}/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${userInfo.token}` },
      });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p._id !== id));
      } else {
        alert("Failed to delete product");
      }
    } catch (err) {
      console.error("Error deleting product:", err);
    }
  };

  if (loading) {
    return (
      <div className="admin__panel">
        <div className="admin__loading">
          <div className="admin__spinner" />
          Loading products...
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="admin__error">{error}</div>;
  }

  return (
    <div>
      <div className="admin__header" style={{ marginBottom: "var(--space-6)" }}>
        <div className="admin__stats" style={{ margin: 0, flex: 1 }}>
          <div className="admin__stat">
            <span className="admin__stat-label">Total Products</span>
            <div className="admin__stat-value">{products.length}</div>
          </div>
          <div className="admin__stat">
            <span className="admin__stat-label">In Stock</span>
            <div className="admin__stat-value">{products.filter((p) => p.inStock).length}</div>
          </div>
          <div className="admin__stat">
            <span className="admin__stat-label">Featured</span>
            <div className="admin__stat-value">{products.filter((p) => p.featured).length}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-4)" }}>
        <button className="admin__btn admin__btn--primary" onClick={() => onEdit("new")}>
          <FaPlus /> Add Product
        </button>
      </div>

      <div className="admin__panel">
        <table className="admin__table">
          <thead>
            <tr>
              <th>Product</th>
              <th>ID</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product._id}>
                <td>
                  <div className="admin__table-product">
                    <img src={imageUrl(product.image)} alt={product.title} />
                    <span className="admin__table-product-name">{product.title}</span>
                  </div>
                </td>
                <td><span className="admin__mono">{product._id}</span></td>
                <td>{product.category || product.categoryId}</td>
                <td><span className="admin__price">₹{product.price?.toLocaleString()}</span></td>
                <td>
                  <span className={`admin__badge ${product.inStock ? "admin__badge--delivered" : "admin__badge--cancelled"}`}>
                    {product.inStock ? `${product.stockQuantity ?? "In stock"}` : "Out of stock"}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    <button className="admin__btn admin__btn--ghost admin__btn--sm" onClick={() => onEdit(product)}>
                      <FaEdit /> Edit
                    </button>
                    <button className="admin__btn admin__btn--danger admin__btn--sm" onClick={() => handleDelete(product._id)}>
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
