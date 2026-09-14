import { useState } from "react";
import { Link } from "react-router-dom";
import { FaPhone, FaEnvelope, FaMapMarkerAlt, FaCheckCircle, FaLifeRing } from "react-icons/fa";
import { API_URL } from "../config";
import "./contact.css";

const CATEGORIES = [
  { value: "order", label: "Order issue" },
  { value: "delivery", label: "Delivery" },
  { value: "product", label: "Product" },
  { value: "payment", label: "Payment" },
  { value: "return", label: "Return / refund" },
  { value: "other", label: "Something else" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function getUser() {
  try {
    const raw = localStorage.getItem("userInfo");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function ContactUs() {
  const user = getUser();

  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: "",
    orderNumber: "",
    category: "order",
    priority: "normal",
    subject: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null); // { ticketNumber }

  const change = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) return setError("Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      return setError("Please enter a valid email address.");
    if (!form.subject.trim()) return setError("Please add a short subject.");
    if (!form.message.trim()) return setError("Please describe how we can help.");

    setSubmitting(true);
    try {
      const headers = { "Content-Type": "application/json" };
      // Attach the token when signed in so the ticket links to the account.
      if (user?.token) headers.Authorization = `Bearer ${user.token}`;

      const res = await fetch(`${API_URL}/api/tickets`, {
        method: "POST",
        headers,
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.message || "Could not raise your ticket. Please try again.");

      setSuccess({ ticketNumber: data.ticketNumber });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSuccess(null);
    setForm((f) => ({
      ...f,
      phone: "",
      orderNumber: "",
      category: "order",
      priority: "normal",
      subject: "",
      message: "",
    }));
  };

  return (
    <div className="contact">
      <div className="contact__hero">
        <div className="contact__hero-inner">
          <span className="contact__label">We're Here to Help</span>
          <h1 className="contact__title">Get in Touch</h1>
          <p className="contact__subtitle">
            Have a question or need support? Raise a ticket below and our team will get back to
            you — or reach us directly through any of the channels here.
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
            <a href="mailto:care@towelcrafts.in" className="contact-card__link">
              care@towelcrafts.in
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

        {/* ── Raise a ticket ─────────────────────────── */}
        <section className="ticket" id="raise-ticket">
          <div className="ticket__intro">
            <span className="ticket__eyebrow"><FaLifeRing aria-hidden="true" /> Support</span>
            <h2 className="ticket__title">Raise a help ticket</h2>
            <p className="ticket__lead">
              Tell us what's going on and we'll sort it out. Share as much detail as you can —
              order number, what happened, and how we can make it right.
            </p>
          </div>

          <div className="ticket__panel">
            {success ? (
              <div className="ticket__success" role="status">
                <FaCheckCircle className="ticket__success-icon" aria-hidden="true" />
                <h3>Ticket raised</h3>
                <p>
                  Thank you. Your ticket
                  {success.ticketNumber ? (
                    <> reference is <strong>{success.ticketNumber}</strong></>
                  ) : (
                    " has been received"
                  )}
                  . We've emailed our team and will get back to you at{" "}
                  <strong>{form.email}</strong> as soon as possible.
                </p>
                <button type="button" className="ticket__btn ticket__btn--ghost" onClick={resetForm}>
                  Raise another ticket
                </button>
              </div>
            ) : (
              <form className="ticket__form" onSubmit={submit} noValidate>
                <div className="ticket__row">
                  <label className="ticket__field">
                    <span className="ticket__label">Your name</span>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={change}
                      autoComplete="name"
                      required
                    />
                  </label>
                  <label className="ticket__field">
                    <span className="ticket__label">Email</span>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={change}
                      autoComplete="email"
                      required
                    />
                  </label>
                </div>

                <div className="ticket__row">
                  <label className="ticket__field">
                    <span className="ticket__label">Phone <em>(optional)</em></span>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={change}
                      autoComplete="tel"
                    />
                  </label>
                  <label className="ticket__field">
                    <span className="ticket__label">Order number <em>(optional)</em></span>
                    <input
                      type="text"
                      name="orderNumber"
                      value={form.orderNumber}
                      onChange={change}
                      placeholder="e.g. ORD-2609-0042"
                    />
                  </label>
                </div>

                <div className="ticket__row">
                  <label className="ticket__field">
                    <span className="ticket__label">Topic</span>
                    <select name="category" value={form.category} onChange={change}>
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="ticket__field">
                    <span className="ticket__label">Priority</span>
                    <select name="priority" value={form.priority} onChange={change}>
                      {PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="ticket__field">
                  <span className="ticket__label">Subject</span>
                  <input
                    type="text"
                    name="subject"
                    value={form.subject}
                    onChange={change}
                    placeholder="A one-line summary"
                    maxLength={150}
                    required
                  />
                </label>

                <label className="ticket__field">
                  <span className="ticket__label">How can we help?</span>
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={change}
                    rows={6}
                    placeholder="Describe the issue in detail…"
                    maxLength={4000}
                    required
                  />
                </label>

                {error && <p className="ticket__error" role="alert">{error}</p>}

                <div className="ticket__actions">
                  <button type="submit" className="ticket__btn" disabled={submitting}>
                    {submitting ? "Raising ticket…" : "Raise ticket"}
                  </button>
                  <span className="ticket__note">
                    We'll reply by email. Typical response time is within 1 business day.
                  </span>
                </div>
              </form>
            )}
          </div>
        </section>

        <div className="contact__footer">
          <p>
            Want to know more about us? Visit our <Link to="/about">About Us</Link> page.
          </p>
        </div>
      </div>
    </div>
  );
}
