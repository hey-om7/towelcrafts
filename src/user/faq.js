import { useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import "./aboutus.css";
import "./faq.css";

const FAQS = [
  {
    q: "What types of towels do you offer?",
    a: "We offer a wide range including bath robes, hair towels, bath towels, adult towels, and specialized kids & infant care towels — all crafted from premium materials.",
  },
  {
    q: "What are your business hours?",
    a: "Our customer service team is available Monday through Friday, 9:00 AM to 6:00 PM IST.",
  },
  {
    q: "Do you offer international shipping?",
    a: "Currently, we ship within India only. We are actively working on expanding our reach internationally in the near future.",
  },
  {
    q: "How can I track my order?",
    a: "Once your order is dispatched, you will receive a tracking link via email or SMS. You can also view order status in your account.",
  },
  {
    q: "Can I cancel my order?",
    a: "Orders can be cancelled any time before they are shipped. Simply visit your orders or contact support and we'll process the cancellation and refund.",
  },
  {
    q: "Are your towels safe for infants?",
    a: "Yes. Our kids & infant care towels are made with hypoallergenic, chemical-free organic cotton, dyed with skin-safe, eco-friendly dyes.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState(0);

  return (
    <div className="page">
      <div className="page__hero">
        <div className="page__hero-inner">
          <span className="page__label">Help Center</span>
          <h1 className="page__title">Frequently Asked Questions</h1>
          <p className="page__subtitle">
            Find answers to the questions our customers ask most often.
          </p>
        </div>
      </div>

      <div className="page__body page__body--narrow">
        <div className="faq-list">
          {FAQS.map((item, i) => (
            <div
              key={i}
              className={`faq-item ${open === i ? "faq-item--open" : ""}`}
            >
              <button
                className="faq-item__question"
                onClick={() => setOpen(open === i ? -1 : i)}
                aria-expanded={open === i}
              >
                <span>{item.q}</span>
                <FaChevronDown className="faq-item__chevron" />
              </button>
              <div className="faq-item__answer">
                <p>{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
