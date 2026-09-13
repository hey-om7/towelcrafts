import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaArrowRight } from 'react-icons/fa';
import { categories as fallbackCategories } from './data';
import { API_URL, imageUrl } from '../config';
import './categories_page.css';

export function CategoriesPage() {
  const [categories, setCategories] = useState(fallbackCategories);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_URL}/api/categories`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            // Normalize _id -> id for routing
            setCategories(data.map((c) => ({ ...c, id: c._id })));
          }
        }
      } catch (err) {
        // Fall back to static categories on error
        console.error('Error fetching categories:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  return (
    <div className="categories">
      {/* Page Header */}
      <section className="categories__hero">
        <div className="categories__hero-inner">
          <span className="categories__label">Our Collections</span>
          <h1 className="categories__title">
            Curated for<br />
            <em>Every Lifestyle</em>
          </h1>
          <p className="categories__subtitle">
            Explore our premium range of towels — from plush bath robes to gentle
            infant care essentials, crafted for every moment of comfort.
          </p>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="categories__section">
        <div className="categories__grid">
          {categories.map((category, index) => (
            <Link
              to={`/category/${category.id || category._id}`}
              key={category.id || category._id}
              className="cat-card"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="cat-card__image">
                <img src={imageUrl(category.image)} alt={category.title} loading="lazy" />
                <div className="cat-card__overlay">
                  <span className="cat-card__cta">
                    Explore
                    <FaArrowRight />
                  </span>
                </div>
              </div>
              <div className="cat-card__body">
                <span className="cat-card__subtitle">{category.subtitle}</span>
                <h2 className="cat-card__title">{category.title}</h2>
                <p className="cat-card__desc">{category.description}</p>
                <div className="cat-card__footer">
                  <span className="cat-card__count">
                    {category.productCount ?? 0} {category.productCount === 1 ? 'Product' : 'Products'}
                  </span>
                  <span className="cat-card__arrow">
                    <FaArrowRight />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
