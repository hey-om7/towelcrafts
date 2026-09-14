// Razorpay Checkout loader.
//
// The Razorpay Checkout script is loaded lazily (only when a customer chooses
// online payment) rather than on every page, and cached so it loads once.

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

let loadPromise = null;

/**
 * Ensure the Razorpay Checkout script is present. Resolves with the global
 * `window.Razorpay` constructor, or rejects if the script fails to load
 * (e.g. offline or blocked).
 *
 * @returns {Promise<any>} the window.Razorpay constructor
 */
export function loadRazorpay() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay can only load in the browser'));
  }
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Razorpay));
      existing.addEventListener('error', () => {
        loadPromise = null;
        reject(new Error('Failed to load Razorpay'));
      });
      if (window.Razorpay) resolve(window.Razorpay);
      return;
    }

    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Failed to load Razorpay'));
    };
    document.body.appendChild(script);
  });

  return loadPromise;
}
