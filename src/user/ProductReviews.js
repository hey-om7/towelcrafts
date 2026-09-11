import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { FaStar } from "react-icons/fa";
import { API_URL } from "../config";
import "./product_reviews.css";

function Stars({ value }) {
  return (
    <span className="reviews__stars" aria-label={`${value} out of 5 stars`}>
      {[...Array(5)].map((_, i) => (
        <FaStar
          key={i}
          className={i < Math.round(value) ? "star--filled" : "star--empty"}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function StarSelect({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="reviews__star-select" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`reviews__star-btn ${(hover || value) >= n ? "reviews__star-btn--on" : ""}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          aria-pressed={value === n}
        >
          <FaStar aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function ProductReviews({ productId }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const userInfoRaw = localStorage.getItem("userInfo");
  const userInfo = userInfoRaw ? JSON.parse(userInfoRaw) : null;
  const isLoggedIn = Boolean(userInfo && userInfo.token);

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [myReview, setMyReview] = useState(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`${API_URL}/api/feedbacks/product/${productId}`);
      if (!res.ok) throw new Error("Failed to load reviews");
      const data = await res.json();
      setReviews(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching reviews:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  const fetchMyReview = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const res = await fetch(
        `${API_URL}/api/feedbacks/product/${productId}/mine`,
        { headers: { Authorization: `Bearer ${userInfo.token}` } }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data) {
        setMyReview(data);
        setRating(data.rating || 0);
        setTitle(data.title || "");
        setText(data.review || "");
      } else {
        setMyReview(null);
      }
    } catch (err) {
      console.error("Error fetching your review:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, isLoggedIn]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    fetchMyReview();
  }, [fetchMyReview]);

  const averageRating =
    reviews.length > 0
      ? Math.round(
          (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length) * 10
        ) / 10
      : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (rating < 1) {
      setFormError("Please select a star rating.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/feedbacks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userInfo.token}`,
        },
        body: JSON.stringify({
          product: Number(productId),
          rating,
          title: title.trim(),
          review: text.trim(),
          type: "product_review",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to submit review");
      }

      setSubmitted(true);
      // Refresh the public list and the user's own review so the form
      // reflects the saved state (and stays pre-filled for future edits).
      await Promise.all([fetchReviews(), fetchMyReview()]);
    } catch (err) {
      console.error("Error submitting review:", err);
      setFormError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="reviews" aria-labelledby="reviews-heading">
      <div className="reviews__inner">
        <header className="reviews__header">
          <span className="reviews__eyebrow">Customer Reviews</span>
          <h2 id="reviews-heading" className="reviews__title">
            What our customers say
          </h2>
          {reviews.length > 0 && (
            <div className="reviews__summary">
              <span className="reviews__summary-score">{averageRating.toFixed(1)}</span>
              <Stars value={averageRating} />
              <span className="reviews__summary-count">
                Based on {reviews.length} review{reviews.length > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </header>

        <div className="reviews__layout">
          {/* Review list */}
          <div className="reviews__list-wrap">
            {loading ? (
              <p className="reviews__state">Loading reviews…</p>
            ) : loadError ? (
              <p className="reviews__state reviews__state--error">
                We couldn't load reviews right now. Please try again later.
              </p>
            ) : reviews.length === 0 ? (
              <div className="reviews__empty">
                <p className="reviews__empty-title">No reviews yet</p>
                <p className="reviews__empty-text">
                  Be the first to share your experience with this product.
                </p>
              </div>
            ) : (
              <ul className="reviews__list">
                {reviews.map((r) => (
                  <li key={r._id} className="reviews__item">
                    <div className="reviews__item-head">
                      <span className="reviews__avatar" aria-hidden="true">
                        {(r.user?.name || "A").charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <p className="reviews__author">{r.user?.name || "Anonymous"}</p>
                        <span className="reviews__date">{formatDate(r.createdAt)}</span>
                      </div>
                      {r.rating > 0 && <Stars value={r.rating} />}
                    </div>
                    {r.title && <p className="reviews__item-title">{r.title}</p>}
                    {r.review && <p className="reviews__item-text">{r.review}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Write a review */}
          <aside className="reviews__form-wrap">
            <h3 className="reviews__form-heading">
              {myReview ? "Edit your review" : "Write a review"}
            </h3>

            {!isLoggedIn ? (
              <div className="reviews__login-prompt">
                <p>Sign in to share your experience with this product.</p>
                <Link to="/login" className="reviews__login-btn">
                  Sign In
                </Link>
              </div>
            ) : submitted ? (
              <div className="reviews__thankyou">
                <p className="reviews__thankyou-title">
                  {myReview ? "Your review has been updated!" : "Thank you for your review!"}
                </p>
                <p className="reviews__thankyou-text">
                  It will appear once approved by our team.
                </p>
                <button
                  type="button"
                  className="reviews__link-btn"
                  onClick={() => setSubmitted(false)}
                >
                  Edit your review
                </button>
              </div>
            ) : (
              <form className="reviews__form" onSubmit={handleSubmit}>
                {myReview && (
                  <p className="reviews__edit-note">
                    You've already reviewed this product. You can update your
                    review below.
                  </p>
                )}

                <div className="reviews__field">
                  <label className="reviews__label">Your rating</label>
                  <StarSelect value={rating} onChange={setRating} />
                </div>

                <div className="reviews__field">
                  <label className="reviews__label" htmlFor="review-title">
                    Title <span className="reviews__optional">(optional)</span>
                  </label>
                  <input
                    id="review-title"
                    type="text"
                    className="reviews__input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={100}
                    placeholder="Summarize your experience"
                  />
                </div>

                <div className="reviews__field">
                  <label className="reviews__label" htmlFor="review-text">
                    Your review <span className="reviews__optional">(optional)</span>
                  </label>
                  <textarea
                    id="review-text"
                    className="reviews__textarea"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={1000}
                    rows={4}
                    placeholder="What did you like or dislike? How is the quality?"
                  />
                </div>

                {formError && <p className="reviews__form-error">{formError}</p>}

                <button
                  type="submit"
                  className="reviews__submit"
                  disabled={submitting}
                >
                  {submitting
                    ? "Saving…"
                    : myReview
                    ? "Update Review"
                    : "Submit Review"}
                </button>
              </form>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
