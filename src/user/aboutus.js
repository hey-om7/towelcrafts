import { FaGem, FaCogs, FaAward, FaHandshake } from "react-icons/fa";
import "./aboutus.css";

const VALUES = [
  {
    icon: <FaGem />,
    title: "Premium Sourcing",
    text: "We source only the finest-grade cotton from the best growing regions, ensuring superior softness, strength, and durability in every product.",
  },
  {
    icon: <FaCogs />,
    title: "Advanced Technology",
    text: "Our facility is powered by state-of-the-art machines and modern processing technology, delivering consistency, efficiency, and precision at scale.",
  },
  {
    icon: <FaAward />,
    title: "Unmatched Quality",
    text: "Every stage of production undergoes strict quality checks to ensure our products meet international standards and exceed expectations.",
  },
  {
    icon: <FaHandshake />,
    title: "Trusted Expertise",
    text: "Backed by decades of expertise, we understand the evolving demands of the textile market and deliver products built to last.",
  },
];

export function AboutUs() {
  return (
    <div className="about">
      {/* ── Editorial split hero ───────────────── */}
      <header className="about-hero">
        <div className="about-hero__inner">
          <div className="about-hero__copy">
            <div className="about-hero__brand">
              <img
                src="/towelcrafts-logo.png"
                alt="TowelCrafts"
                className="about-hero__logo"
                width="132"
                height="132"
              />
              <span className="about-hero__eyebrow">Our Story</span>
            </div>
            <h1 className="about-hero__title">
              Woven with
              <em> intention.</em>
            </h1>
            <p className="about-hero__lead">
              Crafting excellence in premium textiles for more than
              twenty-five years.
            </p>
          </div>

          <figure className="about-hero__media">
            <img
              src="/hero_luxury_towel.png"
              alt="A stack of neatly folded TowelCrafts luxury towels"
              className="about-hero__image"
              width="3200"
              height="3200"
              loading="eager"
              fetchpriority="high"
            />
            <figcaption className="about-hero__badge">
              <span className="about-hero__badge-num">25</span>
              <span className="about-hero__badge-label">
                Years of
                <br />
                craftsmanship
              </span>
            </figcaption>
          </figure>
        </div>
      </header>

      {/* ── Story ──────────────────────────────── */}
      <section className="about-story">
        <div className="about-story__inner">
          <p className="about-story__marker">01 — The beginning</p>
          <div className="about-story__prose">
            <p>
              At <span className="about-story__hl">TowelCrafts</span>, quality is
              not just a promise — it is a tradition refined over decades. With
              more than <strong>25 years</strong> in the textile industry, we
              stand as a trusted name known for precision, reliability, and
              uncompromising standards.
            </p>
            <p>
              Our journey began with a simple vision: to produce the finest
              towels and textiles that combine luxury with durability. Today, we
              are proud to be a leading manufacturer, setting benchmarks through
              innovation and sustainable practices.
            </p>
          </div>
        </div>
      </section>

      {/* ── Full-bleed editorial band ──────────── */}
      <section className="about-band" aria-hidden="true">
        <img
          src="/hero_landscape.jpeg"
          alt=""
          className="about-band__image"
          width="6880"
          height="3840"
          loading="lazy"
        />
        <blockquote className="about-band__quote">
          <p>
            “Softness you can feel. <span>Quality you can trust.</span>”
          </p>
        </blockquote>
      </section>

      {/* ── Values ─────────────────────────────── */}
      <section className="about-values">
        <div className="about-values__inner">
          <header className="about-values__head">
            <p className="about-story__marker">02 — What guides us</p>
            <h2 className="about-values__title">Our core values</h2>
          </header>

          <ol className="about-values__list">
            {VALUES.map((v, i) => (
              <li className="value" key={v.title}>
                <span className="value__index">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="value__icon">{v.icon}</span>
                <div className="value__body">
                  <h3 className="value__title">{v.title}</h3>
                  <p className="value__text">{v.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Closing statement ──────────────────── */}
      <section className="about-close">
        <div className="about-close__inner">
          <img
            src="/towelcrafts-logo.png"
            alt=""
            className="about-close__logo"
            width="72"
            height="72"
            aria-hidden="true"
          />
          <p className="about-close__statement">
            We don't just manufacture textiles —{" "}
            <span>we weave long-term trust through excellence.</span>
          </p>
        </div>
      </section>
    </div>
  );
}
