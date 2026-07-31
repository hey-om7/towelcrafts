import { FaBox, FaTruck, FaStore, FaMapMarkedAlt } from "react-icons/fa";
import "./aboutus.css";

export function Shipping() {
  return (
    <div className="page">
      <div className="page__hero">
        <div className="page__hero-inner">
          <span className="page__label">Delivery</span>
          <h1 className="page__title">Shipping Policy</h1>
          <p className="page__subtitle">
            Everything you need to know about how we get your order to you.
          </p>
        </div>
      </div>

      <div className="page__body page__body--narrow">
        <div className="prose">
          <div className="prose__block">
            <h3><FaBox /> Processing Time</h3>
            <p>
              All orders are processed within 1 to 2 business days (excluding weekends and
              holidays) after receiving your order confirmation. You will receive another
              notification when your order has shipped.
            </p>
          </div>

          <div className="prose__block">
            <h3><FaTruck /> Shipping Rates & Estimates</h3>
            <p>
              Shipping charges are calculated and displayed at checkout. We offer free shipping
              on all orders over ₹999. Standard and expedited shipping options are available
              across India.
            </p>
          </div>

          <div className="prose__block">
            <h3><FaStore /> In-Store Pickup</h3>
            <p>
              Skip the shipping fees with free local pickup at our main warehouse. After placing
              your order and selecting local pickup at checkout, your order will be prepared and
              ready within 1 to 2 business days.
            </p>
          </div>

          <div className="prose__block">
            <h3><FaMapMarkedAlt /> Order Tracking</h3>
            <p>
              When your order has shipped, you will receive an email with a tracking number you
              can use to check its status. Please allow up to 48 hours for tracking information
              to become available.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
