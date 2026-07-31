import { Link } from "react-router-dom";
import { FaInstagram, FaTwitter, FaLinkedin, FaArrowRight, FaStar, FaLeaf, FaHandSparkles, FaShieldAlt } from "react-icons/fa";
import "./home_page.css";

export function HomePage() {
  return (
    <div className="home">
      {/* HERO SECTION */}
      <section className="hero" style={{ backgroundImage: "url(/hero_luxury_towel.png)" }}>
        <div className="hero__overlay" />
        <div className="hero__content">
          <span className="hero__badge">Premium Textiles Since 2020</span>
          <h1 className="hero__title">
            Wrap Yourself in
            <br />
            <span className="hero__title-accent">Pure Luxury</span>
          </h1>
          <p className="hero__subtitle">
            Experience the softness of premium cotton towels, meticulously crafted for your ultimate comfort and refined living.
          </p>
          <div className="hero__actions">
            <Link to="/categories" className="hero__btn-primary">
              Explore Collection
              <FaArrowRight />
            </Link>
            <Link to="/about" className="hero__btn-secondary">
              Our Story
            </Link>
          </div>
        </div>
        <div className="hero__scroll-indicator">
          <span>Scroll</span>
          <div className="hero__scroll-line" />
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="trust-strip">
        <div className="trust-strip__inner">
          <div className="trust-strip__item">
            <FaLeaf />
            <span>100% Organic</span>
          </div>
          <div className="trust-strip__item">
            <FaHandSparkles />
            <span>Handcrafted Quality</span>
          </div>
          <div className="trust-strip__item">
            <FaShieldAlt />
            <span>5-Year Guarantee</span>
          </div>
          <div className="trust-strip__item">
            <FaStar />
            <span>4.9/5 Rating</span>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="features">
        <div className="features__container">
          <div className="features__header">
            <span className="features__label">Why Ambarkar?</span>
            <h2 className="features__title">
              Crafted for Those Who
              <br />
              <em>Appreciate the Finer Things</em>
            </h2>
          </div>

          <div className="features__grid">
            <div className="features__card">
              <div className="features__card-image">
                <img src="/feature_softness.png" alt="Ultra Soft Premium Towels" loading="lazy" />
                <div className="features__card-badge">01</div>
              </div>
              <div className="features__card-body">
                <h3>Unmatched Softness</h3>
                <p>
                  Woven from the finest long-staple Egyptian cotton for a touch that is
                  impossibly gentle on your skin, wash after wash.
                </p>
              </div>
            </div>

            <div className="features__card">
              <div className="features__card-image">
                <img src="/feature_absorbent.png" alt="Superior Absorbency Towels" loading="lazy" />
                <div className="features__card-badge">02</div>
              </div>
              <div className="features__card-body">
                <h3>Superior Absorbency</h3>
                <p>
                  Engineered with a unique loop structure to absorb water instantly,
                  leaving you feeling fresh and completely dry.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCT SHOWCASE */}
      <section className="showcase">
        <div className="showcase__container">
          <div className="showcase__image">
            <img src="/product_stack.png" alt="Premium Towel Stack" loading="lazy" />
            <div className="showcase__image-accent" />
          </div>
          <div className="showcase__content">
            <span className="showcase__label">The Collection</span>
            <h2 className="showcase__title">
              Elevate Your<br />Everyday Ritual
            </h2>
            <p className="showcase__desc">
              Transform your bathroom into a sanctuary with our curated selection of colors
              and textures. Bringing the five-star spa experience to your home.
            </p>

            <ul className="showcase__benefits">
              <li>
                <span className="showcase__benefit-icon">
                  <FaStar />
                </span>
                <div>
                  <strong>100% Organic Cotton</strong>
                  <span>Sustainably sourced, zero chemicals</span>
                </div>
              </li>
              <li>
                <span className="showcase__benefit-icon">
                  <FaStar />
                </span>
                <div>
                  <strong>Eco-friendly Dyeing</strong>
                  <span>Safe for your skin and the planet</span>
                </div>
              </li>
              <li>
                <span className="showcase__benefit-icon">
                  <FaStar />
                </span>
                <div>
                  <strong>Durable & Long-lasting</strong>
                  <span>Maintains softness for 500+ washes</span>
                </div>
              </li>
            </ul>

            <Link to="/categories" className="showcase__btn">
              View All Products
              <FaArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {/* TESTIMONIAL STRIP */}
      <section className="testimonial">
        <div className="testimonial__container">
          <div className="testimonial__stars">
            {[...Array(5)].map((_, i) => (
              <FaStar key={i} />
            ))}
          </div>
          <blockquote className="testimonial__quote">
            "The softest towels I've ever owned. After switching to Ambarkar, I can't imagine using anything else. It's like wrapping yourself in a cloud."
          </blockquote>
          <cite className="testimonial__author">
            <strong>Priya Sharma</strong>
            <span>Verified Customer</span>
          </cite>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer__container">
          <div className="footer__top">
            <div className="footer__brand">
              <div className="footer__logo">
                <span className="footer__logo-text">Ambarkar</span>
                <span className="footer__logo-accent">Industries</span>
              </div>
              <p className="footer__tagline">
                Redefining comfort, one towel at a time. Premium textiles crafted with passion and purpose.
              </p>
            </div>

            <div className="footer__links-group">
              <h4>Company</h4>
              <Link to="/about">About Us</Link>
              <Link to="/categories">Collection</Link>
              <Link to="/contact">Contact</Link>
            </div>

            <div className="footer__links-group">
              <h4>Support</h4>
              <Link to="/faq">FAQ</Link>
              <Link to="/shipping">Shipping</Link>
              <Link to="/returns">Returns</Link>
            </div>

            <div className="footer__links-group">
              <h4>Connect</h4>
              <div className="footer__socials">
                <a href="https://instagram.com" aria-label="Instagram" target="_blank" rel="noreferrer">
                  <FaInstagram /> Instagram
                </a>
                <a href="https://twitter.com" aria-label="Twitter" target="_blank" rel="noreferrer">
                  <FaTwitter /> Twitter
                </a>
                <a href="https://linkedin.com" aria-label="LinkedIn" target="_blank" rel="noreferrer">
                  <FaLinkedin /> LinkedIn
                </a>
              </div>
            </div>
          </div>

          <div className="footer__bottom">
            <p>&copy; {new Date().getFullYear()} Ambarkar Industries. All rights reserved.</p>
            <p>Crafted with care in India</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
