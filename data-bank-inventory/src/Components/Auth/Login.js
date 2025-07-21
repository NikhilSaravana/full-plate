import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { isFirebaseConfigured } from '../../firebase/config';
import FoodBackground from './FoodBackground';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup, error, setError } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();

    if (!email || !password) {
      return setError('Please fill in all fields');
    }

    try {
      setError('');
      setLoading(true);
      await login(email, password);
    } catch (error) {
      console.error('Login error:', error);
      if (error.code === 'auth/user-not-found') {
        setError('No account found with this email. Please register first or create the demo account.');
      } else if (error.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError('Failed to log in: ' + (error.message || 'Unknown error'));
      }
    }

    setLoading(false);
  }

  const createDemoAccount = async () => {
    try {
      setError('');
      setLoading(true);
      
      // Try to create the demo account
      await signup('demo@foodbank.com', 'demo123456', 'Demo User');
      
      // If successful, the user will be automatically logged in
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        // Account exists, try to log in
        try {
          await login('demo@foodbank.com', 'demo123456');
        } catch (loginError) {
          setError('Demo account exists but password is incorrect. Please use the correct password or reset it.');
        }
      } else {
        setError('Failed to create demo account: ' + error.message);
      }
    }
    setLoading(false);
  };

  return (
    <div className="auth-container" style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
      <FoodBackground count={18} />
      <div className="auth-card" style={{ background: 'rgba(255,255,255,0.92)', zIndex: 2, position: 'relative' }}>
        <div className="auth-header">
          <h2>Food Bank Inventory</h2>
          <p>Sign in to your account</p>
          {isFirebaseConfigured && (
            <div className="firebase-status">
              ✅ Connected to Firebase Project
            </div>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
            <div className="forgot-password-link">
              <Link to="/forgot-password">Forgot Password?</Link>
            </div>
          </div>
          
          <button 
            disabled={loading} 
            className="auth-btn primary"
            type="submit"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
        
        <div className="auth-footer">
          <p>
            Don't have an account? <Link to="/register">Sign up</Link>
          </p>
        </div>
        
        {isFirebaseConfigured && (
          <div className="demo-credentials">
            <h4>Demo Account:</h4>
            <p><strong>Email:</strong> demo@foodbank.com</p>
            <p><strong>Password:</strong> demo123456</p>
            
            <div className="demo-actions">
              <button 
                type="button"
                className="demo-btn"
                onClick={() => {
                  setEmail('demo@foodbank.com');
                  setPassword('demo123456');
                }}
              >
                Use Demo Credentials
              </button>
              
              <button 
                type="button"
                className="demo-btn create"
                onClick={createDemoAccount}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Demo Account'}
              </button>
            </div>
            
            <p className="demo-note">
              <small>If the demo account doesn't exist, click "Create Demo Account" first.</small>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login; 