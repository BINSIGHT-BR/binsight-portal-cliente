import { Navigate } from 'react-router-dom';
import AuthScreen from '../components/AuthScreen';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { needsAuth, isLoggingIn, authError, login, loginWithCredentials, loginAsDemo, portalUser, usingMockData } = useAuth();

  if (!needsAuth && portalUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthScreen
      onLogin={() => void login()}
      onLoginWithCredentials={(email, password) => void loginWithCredentials(email, password)}
      onLoginAsDemo={loginAsDemo}
      isLoggingIn={isLoggingIn}
      authError={authError}
      usingMockData={usingMockData}
    />
  );
}
