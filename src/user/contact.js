import { Link } from "react-router-dom";
import { FaPhone, FaEnvelope, FaMapMarkerAlt } from "react-icons/fa";
import "./contact.css";

export function ContactUs() {
  return (
    <div className="contact">
      <div className="contact__hero">
        <div className="contact__hero-inner">
          <span className="contact__label">We're Here to Help</span>
          <h1 className="contact__title">Get in Touch</h1>
          <p className="contact__subtitle">
            Have a question or need support? Reach out to us — we'd love to hear from you.
          </p>
        </div>
      </div>

      <div className="contact__body">
        <div className="contact__grid">
          <div className="contact-card">
            <div className="contact-card__icon">
              <FaEnvelope />
            </div>
            <h3>Email Us</h3>
            <p>For general inquiries and order support</p>
            <a href="mailto:care.towelcrafts@gmail.com" className="contact-card__link">
              care.towelcrafts@gmail.com
            </a>
          </div>

          <div className="contact-card">
            <div className="contact-card__icon">
              <FaPhone />
            </div>
            <h3>Call Us</h3>
            <p>Monday – Friday, 9am – 6pm IST</p>
            <a href="tel:+919850680630" className="contact-card__link">
              +91 744777 6777
            </a>
          </div>

          <div className="contact-card">
            <div className="contact-card__icon">
              <FaMapMarkerAlt />
            </div>
            <h3>Visit Us</h3>
            <p>TowelCrafts</p>
            <p>Akkalkot Road,<br />Solapur, Maharashtra 413001</p>
          </div>
        </div>

        <div className="contact__footer">
          <p>
            Want to know more about us? Visit our <Link to="/about">About Us</Link> page.
          </p>
        </div>
      </div>
    </div>
  );
}
