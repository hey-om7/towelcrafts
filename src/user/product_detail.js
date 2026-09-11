import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { FaArrowLeft, FaStar, FaShieldAlt, FaTruck, FaUndo, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { API_URL } from "../config";
import ProductReviews from "./ProductReviews";
import "./product_detail.css";

function ProductDetail() {
  const { productId, categoryId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await fetch(`${API_URL}/api/products/${productId}`);
        if (!response.ok) throw new Error("Product not found");
        const data = await response.json();
        setProduct(data);
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  const handleBuyNow = () => {
    const userInfoRaw = localStorage.getItem("userInfo");
    const userInfo = userInfoRaw ? JSON.parse(userInfoRaw) : null;

    if (!userInfo || !userInfo.token) {
      navigate("/login");
      return;
    }

    navigate("/checkout", { state: { product, quantity } });
  };

  if (loading) {
    return (
      <div className="pd-page">
        <div className="pd-page__loading">
          <div className="pd-page__loading-spinner" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="pd-page">
        <div className="pd-page__not-found">
          <h2>Product Not Found</h2>
          <p>The product you're looking for doesn't exist or has been removed.</p>
          <Link to="/categories" className="pd-page__back-btn">
            <FaArrowLeft /> Back to Collections
          </Link>
        </div>
      </div>
    );
  }

  const images = product.images && product.images.length > 0
    ? [product.image, ...product.images]
    : [product.image];

  const nextImage = () => setCurrentImage((i) => (i + 1) % images.length);
  const prevImage = () => setCurrentImage((i) => (i - 1 + images.length) % images.length);

  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <div className="pd-page">
      {/* Breadcrumb */}
      <div className="pd-page__breadcrumb">
        <div className="pd-page__breadcrumb-inner">
          <Link to="/categories">Collections</Link>
          <span>/</span>
          <Link to={`/category/${categoryId}`}>{product.category}</Link>
          <span>/</span>
          <span className="pd-page__breadcrumb-current">{product.title}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="pd-page__content">
        {/* Image Gallery */}
        <div className="pd-gallery">
          <div className="pd-gallery__main">
            <img
              src={images[currentImage]}
              alt={product.title}
              className="pd-gallery__image"
            />
            {images.length > 1 && (
              <>
                <button className="pd-gallery__nav pd-gallery__nav--prev" onClick={prevImage} aria-label="Previous image">
                  <FaChevronLeft />
                </button>
                <button className="pd-gallery__nav pd-gallery__nav--next" onClick={nextImage} aria-label="Next image">
                  <FaChevronRight />
                </button>
              </>
            )}
            {discount > 0 && (
              <span className="pd-gallery__badge">{discount}% OFF</span>
            )}
          </div>
          {images.length > 1 && (
            <div className="pd-gallery__thumbnails">
              {images.map((img, i) => (
                <button
                  key={i}
                  className={`pd-gallery__thumb ${i === currentImage ? "pd-gallery__thumb--active" : ""}`}
                  onClick={() => setCurrentImage(i)}
                  aria-label={`View image ${i + 1}`}
                >
                  <img src={img} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="pd-info">
          <div className="pd-info__header">
            {product.material && (
              <span className="pd-info__material">{product.material}</span>
            )}
            <h1 className="pd-info__title">{product.title}</h1>

            {product.numReviews > 0 && product.rating > 0 ? (
              <div className="pd-info__rating">
                <div className="pd-info__stars">
                  {[...Array(5)].map((_, i) => (
                    <FaStar
                      key={i}
                      className={i < Math.round(product.rating) ? "star--filled" : "star--empty"}
                    />
                  ))}
                </div>
                <span className="pd-info__rating-text">
                  {product.rating} ({product.numReviews} review{product.numReviews > 1 ? "s" : ""})
                </span>
              </div>
            ) : (
              <div className="pd-info__rating">
                <span className="pd-info__rating-text pd-info__rating-text--empty">
                  No reviews yet
                </span>
              </div>
            )}
          </div>

          {/* Price */}
          <div className="pd-info__price-section">
            <span className="pd-info__price">₹{product.price?.toLocaleString()}</span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="pd-info__original-price">₹{product.originalPrice?.toLocaleString()}</span>
            )}
            {discount > 0 && (
              <span className="pd-info__discount">Save {discount}%</span>
            )}
          </div>

          {/* Description */}
          <p className="pd-info__description">{product.description}</p>

          {/* Specs */}
          {(product.weight || product.dimensions || product.color) && (
            <div className="pd-info__specs">
              {product.weight && (
                <div className="pd-info__spec">
                  <span className="pd-info__spec-label">Weight</span>
                  <span className="pd-info__spec-value">{product.weight}</span>
                </div>
              )}
              {product.dimensions && (
                <div className="pd-info__spec">
                  <span className="pd-info__spec-label">Dimensions</span>
                  <span className="pd-info__spec-value">{product.dimensions}</span>
                </div>
              )}
              {product.color && (
                <div className="pd-info__spec">
                  <span className="pd-info__spec-label">Color</span>
                  <span className="pd-info__spec-value">{product.color}</span>
                </div>
              )}
            </div>
          )}

          {/* Quantity + Buy */}
          <div className="pd-info__actions">
            <div className="pd-info__quantity">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="pd-info__qty-btn"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="pd-info__qty-value">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="pd-info__qty-btn"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
            <button className="pd-info__buy-btn" onClick={handleBuyNow}>
              Buy Now — ₹{(product.price * quantity).toLocaleString()}
            </button>
          </div>

          {/* Trust badges */}
          <div className="pd-info__trust">
            <div className="pd-info__trust-item">
              <FaTruck />
              <span>Free shipping over ₹999</span>
            </div>
            <div className="pd-info__trust-item">
              <FaUndo />
              <span>7-day easy returns</span>
            </div>
            <div className="pd-info__trust-item">
              <FaShieldAlt />
              <span>5-year quality guarantee</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <ProductReviews productId={productId} />
    </div>
  );
}

export default ProductDetail;
