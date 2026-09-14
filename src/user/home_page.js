import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaInstagram, FaTwitter, FaLinkedin, FaArrowRight } from "react-icons/fa";
import { categories as fallbackCategories } from "./data";
import { useScrollReveal } from "./useScrollReveal";
import { API_URL, imageUrlSized, imageSrcSet } from "../config";
import "./home_page.css";

const VALUES = [
  "100% Organic Cotton",
  "Handcrafted Quality",
  "5-Year Guarantee",
  "Rated 4.9 / 5",
];

const CRAFT = [
  {
    index: "01",
    title: "Unmatched Softness",
    image: "/feature_softness.png",
    body:
      "Woven from the finest long-staple Egyptian cotton for a touch that stays impossibly gentle on the skin — wash after wash, year after year.",
  },
  {
    index: "02",
    title: "Superior Absorbency",
    image: "/feature_absorbent.png",
    body:
      "A unique looped weave draws water in on contact, leaving you dry within moments and the towel quick to breathe and recover.",
  },
];

export function HomePage() {
  const [categories, setCategories] = useState(fallbackCategories);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/categories`);
        if (res.ok) {
          const data = await res.json();
          if (active && Array.isArray(data) && data.length > 0) {
            setCategories(data.map((c) => ({ ...c, id: c._id })));
          }
        }
      } catch (err) {
        /* keep static fallback */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useScrollReveal([categories.length]);

  const featured = categories[0];
  const rest = categories.slice(1, 5);

  return (
    <div className="home">
      {/* ── HERO ─────────────────────────────── */}
      <section className="hero">
        <div className="hero__media">
          <picture>
            <source
              media="(min-width: 768px)"
              srcSet="/hero_landscape.jpeg"
            />
            <img
              src="/hero_luxury_towel.png"
              alt="Folded premium cotton towels arranged on soft linen"
              className="hero__image"
              fetchPriority="high"
              decoding="async"
            />
          </picture>
          <div className="hero__scrim" />
        </div>

        <div className="hero__inner">
          <div className="hero__content">
            <span className="hero__eyebrow">Premium Textiles · Since 1970</span>
            <h1 className="hero__title">
              Wrap yourself
              <br />
              in <span className="serif-italic">pure luxury</span>
            </h1>
            <p className="hero__subtitle">
              The softness of premium cotton, meticulously woven for the quiet
              rituals of refined living.
            </p>
            <div className="hero__actions">
              <Link to="/categories" className="btn btn-accent btn-lg hero__cta">
                Explore the Collection
                <FaArrowRight aria-hidden="true" />
              </Link>
              <Link to="/about" className="hero__link">
                Our Story
              </Link>
            </div>
          </div>
        </div>

        <div className="hero__scroll" aria-hidden="true">
          <span>Scroll</span>
          <span className="hero__scroll-line" />
        </div>
      </section>

      {/* ── VALUES STRIP ─────────────────────── */}
      <section className="values" aria-label="What sets us apart">
        <ul className="values__list">
          {VALUES.map((v) => (
            <li key={v} className="values__item">
              {v}
            </li>
          ))}
        </ul>
      </section>

      {/* ── MANIFESTO ────────────────────────── */}
      <section className="manifesto">
        <div className="manifesto__inner">
          <span className="eyebrow eyebrow--rule" data-reveal>
            The House of TowelCrafts
          </span>
          <p className="manifesto__lead" data-reveal data-reveal-delay="1">
            We believe a towel is not an afterthought. It is the first thing
            that touches you each morning and the last comfort of the day —
            <span className="serif-italic"> so we make it worth the moment.</span>
          </p>
          <div className="manifesto__meta" data-reveal data-reveal-delay="2">
            <Link to="/about" className="link-underline">
              Read our story
            </Link>
          </div>
        </div>
      </section>

      {/* ── CRAFT ────────────────────────────── */}
      <section className="craft">
        {CRAFT.map((item, i) => (
          <article
            key={item.index}
            className={`craft__row ${i % 2 === 1 ? "craft__row--reverse" : ""}`}
          >
            <div className="craft__media" data-reveal>
              <span className="craft__index">{item.index}</span>
              <img src={imageUrlSized(item, "large")} alt={item.title} loading="lazy" />
            </div>
            <div className="craft__body" data-reveal data-reveal-delay="1">
              <h2 className="craft__title">{item.title}</h2>
              <p className="craft__text">{item.body}</p>
            </div>
          </article>
        ))}
      </section>

      {/* ── COLLECTIONS ──────────────────────── */}
      <section className="collections">
        <div className="collections__head">
          <span className="eyebrow eyebrow--rule" data-reveal>
            The Collections
          </span>
          <h2 className="collections__title" data-reveal data-reveal-delay="1">
            Curated for every
            <br />
            <span className="serif-italic">ritual of comfort</span>
          </h2>
        </div>

        <div className="collections__grid">
          {featured && (
            <Link
              to={`/category/${featured.id || featured._id}`}
              className="collections__feature"
              data-reveal
            >
              <div className="collections__feature-media">
                <img
                  src={imageUrlSized(featured, "large")}
                  srcSet={imageSrcSet(featured, ["medium", "large"]) || undefined}
                  sizes="(max-width: 900px) 92vw, 720px"
                  alt={featured.title}
                  loading="lazy"
                />
              </div>
              <div className="collections__feature-body">
                <span className="collections__sub">{featured.subtitle}</span>
                <h3 className="collections__name">{featured.title}</h3>
                <p className="collections__desc">{featured.description}</p>
                <span className="link-underline">Explore</span>
              </div>
            </Link>
          )}

          <ul className="collections__list">
            {rest.map((cat, i) => (
              <li key={cat.id || cat._id} data-reveal data-reveal-delay={i + 1}>
                <Link
                  to={`/category/${cat.id || cat._id}`}
                  className="collections__row"
                >
                  <span className="collections__row-index">
                    {String(i + 2).padStart(2, "0")}
                  </span>
                  <span className="collections__row-thumb">
                    <img src={imageUrlSized(cat, "thumb")} alt="" loading="lazy" />
                  </span>
                  <span className="collections__row-text">
                    <span className="collections__row-name">{cat.title}</span>
                    <span className="collections__row-sub">{cat.subtitle}</span>
                  </span>
                  <FaArrowRight className="collections__row-arrow" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="collections__foot" data-reveal>
          <Link to="/categories" className="btn btn-outline">
            View all collections
          </Link>
        </div>
      </section>

      {/* ── SHOWCASE / RITUAL ────────────────── */}
      <section className="showcase">
        <div className="showcase__inner">
          <div className="showcase__media" data-reveal>
            <img src="/product_stack.png" alt="A stack of folded premium towels" loading="lazy" />
          </div>
          <div className="showcase__content" data-reveal data-reveal-delay="1">
            <span className="eyebrow eyebrow--rule">Elevate the Everyday</span>
            <h2 className="showcase__title">
              A five-star ritual,
              <br />
              <span className="serif-italic">brought home</span>
            </h2>
            <p className="showcase__desc">
              Transform your bathroom into a sanctuary with a curated palette of
              colours and textures — the spa experience, made daily.
            </p>

            <ul className="showcase__benefits">
              <li>
                <strong>100% Organic Cotton</strong>
                <span>Sustainably sourced, free of harsh chemicals</span>
              </li>
              <li>
                <strong>Eco-friendly Dyeing</strong>
                <span>Kind to your skin and the planet</span>
              </li>
              <li>
                <strong>Made to Last</strong>
                <span>Holds its softness beyond 500 washes</span>
              </li>
            </ul>

            <Link to="/categories" className="link-underline showcase__link">
              View all products
              <FaArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIAL ──────────────────────── */}
      <section className="quote">
        <div className="quote__inner" data-reveal>
          <span className="quote__mark" aria-hidden="true">&ldquo;</span>
          <blockquote className="quote__body">
            The softest towels I have ever owned. After switching to TowelCrafts, I
            cannot imagine anything else — it is like wrapping yourself in a
            cloud.
          </blockquote>
          <cite className="quote__author">
            <span className="quote__name">Priya Sharma</span>
            <span className="quote__role">Verified Customer</span>
          </cite>
        </div>
      </section>

      {/* ── CTA BAND ─────────────────────────── */}
      <section className="cta-band">
        <div className="cta-band__inner">
          <h2 className="cta-band__title">
            Bring the ritual <span className="serif-italic">home</span>
          </h2>
          <Link to="/categories" className="btn btn-accent btn-lg">
            Shop the Collection
            <FaArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────── */}
      <SiteFooter />
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="footer__container">
        <div className="footer__top">
          <div className="footer__brand">
            <div className="footer__logo">
              <img src="/towelcrafts-logo.png" alt="" className="footer__logo-mark" aria-hidden="true" />
              <span className="footer__logo-text">Towel</span>
              <span className="footer__logo-accent">Crafts</span>
            </div>
            <p className="footer__tagline">
              Redefining comfort, one towel at a time. Premium textiles crafted
              with patience and purpose.
            </p>
          </div>

          <nav className="footer__links-group" aria-label="Company">
            <h4>Company</h4>
            <Link to="/about">About Us</Link>
            <Link to="/categories">Collection</Link>
            <Link to="/contact">Contact</Link>
          </nav>

          <nav className="footer__links-group" aria-label="Support">
            <h4>Support</h4>
            <Link to="/faq">FAQ</Link>
            <Link to="/shipping">Shipping</Link>
            <Link to="/returns">Returns</Link>
          </nav>

          <div className="footer__links-group footer__connect">
            <h4>Connect</h4>
            <div className="footer__socials">
              <a href="https://instagram.com" aria-label="Instagram" target="_blank" rel="noreferrer">
                <FaInstagram aria-hidden="true" />
                <span className="footer__social-label">Instagram</span>
              </a>
              <a href="https://twitter.com" aria-label="Twitter" target="_blank" rel="noreferrer">
                <FaTwitter aria-hidden="true" />
                <span className="footer__social-label">Twitter</span>
              </a>
              <a href="https://linkedin.com" aria-label="LinkedIn" target="_blank" rel="noreferrer">
                <FaLinkedin aria-hidden="true" />
                <span className="footer__social-label">LinkedIn</span>
              </a>
            </div>
          </div>
        </div>

        <div className="footer__bottom">
          <p>&copy; {new Date().getFullYear()} TowelCrafts. All rights reserved.</p>
          <p>Crafted with care in India</p>
        </div>
      </div>
    </footer>
  );
}
