import "./products.css";
import { Link, useParams } from "react-router-dom";
import { FaArrowLeft, FaStar } from "react-icons/fa";
import { categories as fallbackCategories } from "./data";
import { API_URL, imageUrlSized } from "../config";
import { ProgressiveImage } from "./ProgressiveImage";
import { useState, useEffect } from "react";

/**
 * Preload a list of image URLs, resolving once they've all settled
 * (loaded or errored) or a safety timeout elapses — so a single slow/broken
 * placeholder can never block the grid from ever appearing.
 */
function preloadImages(urls, timeoutMs = 6000) {
  const list = urls.filter(Boolean);
  if (list.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    let remaining = list.length;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    };
    const settle = () => {
      remaining -= 1;
      if (remaining <= 0) finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    list.forEach((src) => {
      const img = new Image();
      img.onload = settle;
      img.onerror = settle;
      img.src = src;
    });
  });
}

function ProductCards() {
  const { categoryId } = useParams();
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState(
    fallbackCategories.find((c) => c.id === parseInt(categoryId)) || null
  );
  const [loading, setLoading] = useState(true);
  // Second phase: after data loads, warm up the blurred placeholders so the
  // cards can animate in together with their placeholders already painted.
  const [placeholdersReady, setPlaceholdersReady] = useState(false);

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

  // Once the product data is in, preload every card's blurred placeholder
  // (thumb). Only reveal + animate the grid after they're all cached.
  useEffect(() => {
    if (loading) return;
    if (categoryProducts.length === 0) {
      setPlaceholdersReady(true);
      return;
    }
    let cancelled = false;
    setPlaceholdersReady(false);
    const thumbs = categoryProducts.map((p) => imageUrlSized(p, "thumb"));
    preloadImages(thumbs).then(() => {
      if (!cancelled) setPlaceholdersReady(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, products, categoryId]);

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
        {loading || (categoryProducts.length > 0 && !placeholdersReady) ? (
          <div className="products-page__spinner" role="status" aria-live="polite">
            <span className="products-page__spinner-circle" aria-hidden="true" />
            <span className="products-page__spinner-text">Preparing collection…</span>
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
                  <ProgressiveImage
                    item={product}
                    alt={product.title}
                    size="medium"
                    sizes="(max-width: 640px) 45vw, (max-width: 1024px) 48vw, 400px"
                  />
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
