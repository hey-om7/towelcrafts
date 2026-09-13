import "./KnowMore.css";

export default function KnowMore() {
  return (
    <section className="know-section">
      <div className="know-container">
        <h1 className="know-title">Know More</h1>
        <p className="know-subtitle">
          Learn more about our industry expertise and the mind behind the code
        </p>

        {/* About Industry */}
        <div className="know-card">
          <h2>About the Industry</h2>
          <p>
            We specialize in manufacturing premium-quality towels that define
            comfort, durability, and craftsmanship. By combining the finest
            cotton sourcing with advanced machinery and decades of industry
            experience, we ensure every towel delivers exceptional softness,
            absorbency, and long-lasting performance. Our commitment to strict
            quality standards, consistency, and customer satisfaction has
            positioned us as a trusted and reliable name in the towel industry.
            We don’t just produce towels — we deliver everyday luxury and
            dependable excellence.
          </p>
        </div>

        {/* About Programmer */}
        <div className="know-card">
          <h2>About the Programmer</h2>
          <p>
            I’m a web developer with strong communication skills and a deep
            passion for marketing. My journey blends technology, creativity, and
            customer understanding—whether I’m building websites, studying user
            behavior, or exploring how brands scale.
          </p>

          <p>
            I enjoy creating digital experiences that solve real problems and
            drive value. With an entrepreneurial mindset, I aim to combine
            technical expertise with strategic marketing to fuel business
            growth, enhance product visibility, and strengthen brand
            storytelling.
          </p>

          <p>
            Always curious. Always learning. Always pursuing opportunities where
            technology, marketing, and entrepreneurship come together.
          </p>

          <p className="contact-text">
            Please email me at{" "}
            <a href="mailto:care@towelcrafts.in">
              care@towelcrafts.in
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
