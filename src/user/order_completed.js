import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCheck, FaBox, FaTruck, FaHome } from 'react-icons/fa';
import './order_completed.css';
import Feedback from './Feedback';

function OrderCompleted() {
  const navigate = useNavigate();

  return (
    <div className="order-complete">
      <div className="order-complete__container">
        {/* Success Card */}
        <div className="order-complete__card">
          <div className="order-complete__icon">
            <div className="order-complete__icon-circle">
              <FaCheck />
            </div>
          </div>

          <h1 className="order-complete__title">Order Confirmed!</h1>
          <p className="order-complete__message">
            Thank you for your purchase. Your order has been placed successfully
            and a confirmation has been sent to your email.
          </p>

          {/* Order Progress */}
          <div className="order-complete__progress">
            <div className="order-complete__step order-complete__step--active">
              <div className="order-complete__step-icon">
                <FaCheck />
              </div>
              <span>Placed</span>
            </div>
            <div className="order-complete__step-line" />
            <div className="order-complete__step">
              <div className="order-complete__step-icon">
                <FaBox />
              </div>
              <span>Processing</span>
            </div>
            <div className="order-complete__step-line" />
            <div className="order-complete__step">
              <div className="order-complete__step-icon">
                <FaTruck />
              </div>
              <span>Shipped</span>
            </div>
            <div className="order-complete__step-line" />
            <div className="order-complete__step">
              <div className="order-complete__step-icon">
                <FaHome />
              </div>
              <span>Delivered</span>
            </div>
          </div>

          <button className="order-complete__btn" onClick={() => navigate('/')}>
            Continue Shopping
          </button>
        </div>

        {/* Feedback */}
        <Feedback />
      </div>
    </div>
  );
}

export default OrderCompleted;
