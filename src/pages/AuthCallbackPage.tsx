import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from 'aws-amplify/auth';

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Amplify handles the OAuth callback automatically
    // We just need to check if the user is authenticated and redirect
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          navigate('/', { replace: true });
        } else {
          navigate('/login', { replace: true });
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        navigate('/login', { replace: true });
      }
    };

    // Give Amplify a moment to process the callback
    setTimeout(checkAuth, 1000);
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 mx-auto" />
        <p className="text-gray-600">Signing you in...</p>
      </div>
    </div>
  );
}
