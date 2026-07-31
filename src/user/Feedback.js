import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaStar } from 'react-icons/fa';
import './feedback.css';

export default function Feedback() {
  const [review, setReview] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const userInfoRaw = localStorage.getItem('userInfo');
      const userInfo = userInfoRaw ? JSON.parse(userInfoRaw) : null;

      if (!userInfo || !userInfo.token) {
        setLoading(false);
        navigate('/login');
        return;
      }

      const response = await fetch('http://localhost:5001/api/feedbacks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo.token}`,
        },
        body: JSON.stringify({ review, rating: rating || undefined }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Thank you for your feedback!' });
        setReview('');
        setRating(0);
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.message || 'Failed to submit feedback' });
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setMessage({ type: 'error', text: 'An error occurred while submitting feedback.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="feedback">
      <div className="feedback__header">
        <h2 className="feedback__title">Share Your Experience</h2>
        <p className="feedback__subtitle">
          We'd love to hear your thoughts. Your feedback helps us improve.
        </p>
      </div>

      {message && (
        <div className={`feedback__message feedback__message--${message.type}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="feedback__form">
        {/* Star Rating */}
        <div className="feedback__rating">
          <span className="feedback__rating-label">Rate your experience</span>
          <div className="feedback__stars">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={`feedback__star ${
                  star <= (hoverRating || rating) ? 'feedback__star--active' : ''
                }`}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                aria-label={`${star} star${star > 1 ? 's' : ''}`}
              >
                <FaStar />
              </button>
            ))}
          </div>
        </div>

        <textarea
          className="feedback__textarea"
          placeholder="Tell us about your experience, suggestions, or any issues you encountered..."
          value={review}
          onChange={(e) => setReview(e.target.value)}
          required
          disabled={loading}
          rows={5}
        />

        <button type="submit" className="feedback__submit" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </form>
    </div>
  );
}
