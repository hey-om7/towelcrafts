import "./products.css";
import { Link, useParams } from "react-router-dom";
import { FaArrowLeft, FaStar } from "react-icons/fa";
import { categories as fallbackCategories } from "./data";
import { API_URL, imageUrl } from "../config";
import { useState, useEffect } from "react";

function ProductCards() {
  const { categoryId } = useParams();
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState(
    fallbackCategories.find((c) => c.id === parseInt(categoryId)) || null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          fetch(`${API_URL}/api/products?limit=200`),
          fetch(`${API_URL}/api/categories/${categoryId}`),
        ]);
        const prodData = await prodRes.json();
        setProducts(prodData.products || prodData);

        if (catRes.ok) {
          const catData = await catRes.json();
          setCategory({ ...catData, id: catData._id });
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [categoryId]);

  const categoryProducts = products.filter(
    (p) => p.categoryId === parseInt(categoryId)
  );

  if (!loading && !category) {
    return (
      <div className="products-page">
        <div className="products-page__empty">
          <h2>Category not found</h2>
          <Link to="/categories" className="products-page__back-link">
            <FaArrowLeft /> Back to Collections
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="products-page">
      {/* Page Header */}
      <section className="products-page__header">
        <div className="products-page__header-inner">
          <Link to="/categories" className="products-page__back-link">
            <FaArrowLeft />
            <span>All Collections</span>
          </Link>
          <div className="products-page__title-group">
            <span className="products-page__label">{category?.subtitle}</span>
            <h1 className="products-page__title">{category?.title || "Loading..."}</h1>
            <p className="products-page__count">
              {categoryProducts.length} {categoryProducts.length === 1 ? "product" : "products"}
            </p>
          </div>
        </div>
      </section>

      {/* Product Grid */}
      <section className="products-page__grid-section">
        {loading ? (
          <div className="products-page__loading">
            <div className="products-page__skeleton-grid">
              {[1, 2, 3].map((n) => (
                <div key={n} className="product-skeleton">
                  <div className="product-skeleton__image" />
                  <div className="product-skeleton__body">
                    <div className="product-skeleton__line product-skeleton__line--short" />
                    <div className="product-skeleton__line product-skeleton__line--medium" />
                    <div className="product-skeleton__line product-skeleton__line--long" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : categoryProducts.length > 0 ? (
          <div className="products-grid">
            {categoryProducts.map((product, index) => (
              <Link
                key={product._id}
                to={`/category/${categoryId}/product/${product._id}`}
                className="product-card"
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                <div className="product-card__image">
                  <img src={imageUrl(product.image)} alt={product.title} loading="lazy" />
                  {product.originalPrice && product.originalPrice > product.price && (
                    <span className="product-card__badge">
                      {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
                    </span>
                  )}
                </div>
                <div className="product-card__body">
                  <div className="product-card__meta">
                    <span className="product-card__category">{product.category}</span>
                    {product.rating > 0 && (
                      <span className="product-card__rating">
                        <FaStar /> {product.rating}
                      </span>
                    )}
                  </div>
                  <h3 className="product-card__title">{product.title}</h3>
                  <p className="product-card__desc">
                    {product.shortDescription || (product.description && product.description.length > 80
                      ? product.description.substring(0, 80) + "..."
                      : product.description)}
                  </p>
                  <div className="product-card__footer">
                    <div className="product-card__price-group">
                      <span className="product-card__price">₹{product.price?.toLocaleString()}</span>
                      {product.originalPrice && product.originalPrice > product.price && (
                        <span className="product-card__original-price">₹{product.originalPrice?.toLocaleString()}</span>
                      )}
                    </div>
                    <span className="product-card__action">View</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="products-page__empty">
            <h3>No products found</h3>
            <p>This collection is currently being curated. Check back soon.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default ProductCards;
