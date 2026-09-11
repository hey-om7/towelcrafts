import { FaGem, FaCogs, FaAward, FaHandshake } from "react-icons/fa";
import "./aboutus.css";

export function AboutUs() {
  return (
    <div className="page">
      <div className="page__hero">
        <div className="page__hero-inner">
          <span className="page__label">Our Story</span>
          <h1 className="page__title">
            TowelCrafts
          </h1>
          <p className="page__subtitle">
            Crafting excellence in premium textiles for over 25 years
          </p>
        </div>
      </div>

      <div className="page__body">
        <div className="about-story">
          <p>
            At <span className="highlight">TowelCrafts</span>, quality is not just a
            promise — it is a tradition refined over decades. With more than{" "}
            <strong>25 years of experience</strong> in the textile industry, we stand as a
            trusted name known for precision, reliability, and uncompromising standards.
          </p>
          <p>
            Our journey began with a simple vision: to produce the finest towels and textiles
            that combine luxury with durability. Today, we are proud to be a leading
            manufacturer, setting benchmarks through innovation and sustainable practices.
          </p>
        </div>

        <div className="values-section">
          <h2 className="section-title">Our Core Values</h2>
          <div className="about-grid">
            <div className="about-card">
              <div className="about-card__icon"><FaGem /></div>
              <h3>Premium Sourcing</h3>
              <p>
                We source only the finest-grade cotton from the best growing regions, ensuring
                superior softness, strength, and durability in every product.
              </p>
            </div>

            <div className="about-card">
              <div className="about-card__icon"><FaCogs /></div>
              <h3>Advanced Technology</h3>
              <p>
                Our facility is powered by state-of-the-art machines and modern processing
                technology, delivering consistency, efficiency, and precision at scale.
              </p>
            </div>

            <div className="about-card">
              <div className="about-card__icon"><FaAward /></div>
              <h3>Unmatched Quality</h3>
              <p>
                Every stage of production undergoes strict quality checks to ensure our products
                meet international standards and exceed expectations.
              </p>
            </div>

            <div className="about-card">
              <div className="about-card__icon"><FaHandshake /></div>
              <h3>Trusted Expertise</h3>
              <p>
                Backed by decades of expertise, we understand the evolving demands of the
                textile market and deliver products built to last.
              </p>
            </div>
          </div>
        </div>

        <div className="about-footer">
          <p>
            At <span>TowelCrafts</span>, we don't just manufacture textiles —
            we build long-term trust through excellence.
          </p>
        </div>
      </div>
    </div>
  );
}
