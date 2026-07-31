import { GoogleLogin } from '@react-oauth/google';
import { API_URL, GOOGLE_CLIENT_ID } from '../config';

/**
 * Reusable Google Sign-In button.
 * Exchanges the Google credential for an app JWT via the backend,
 * stores userInfo in localStorage, then calls onSuccess.
 */
export default function GoogleSignInButton({ onSuccess, onError }) {
  // Hide the button entirely when no client ID is configured
  if (!GOOGLE_CLIENT_ID) return null;

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const res = await fetch(`${API_URL}/api/users/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('userInfo', JSON.stringify(data));
        onSuccess?.(data);
      } else {
        onError?.(data.message || 'Google sign-in failed');
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
      onError?.('An error occurred during Google sign-in');
    }
  };

  return (
    <div className="auth__google">
      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={() => onError?.('Google sign-in was cancelled or failed')}
        theme="outline"
        size="large"
        width="100%"
        text="continue_with"
        shape="rectangular"
      />
    </div>
  );
}
