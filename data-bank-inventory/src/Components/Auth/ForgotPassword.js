import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { resetPassword, error, setError } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();

    if (!email) {
      return setError('Please enter your email address');
    }

    try {
      setError('');
      setMessage('');
      setLoading(true);
      await resetPassword(email);
      setMessage('A password reset link has been sent to your email! Please check your inbox and spam folder.');
    } catch (error) {
      console.error('Password reset error:', error);
      if (error.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many reset attempts. Please try again later.');
      } else {
        setError('Failed to send reset email: ' + (error.message || 'Unknown error'));
      }
    }

    setLoading(false);
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Reset Your Password</h2>
          <p>Enter your email to receive a password reset link.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="error-message">{error}</div>}
          {message && (
            <div
              className="success-message"
              style={{
                textAlign: 'center',
                padding: '32px 20px',
                border: '2px solid #28a745',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #e6f9ed 60%, #d4edda 100%)',
                color: '#218838',
                fontSize: '1.15em',
                marginBottom: '24px',
                boxShadow: '0 4px 24px rgba(40,167,69,0.08)'
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #28a745 60%, #218838 100%)',
                  color: 'white',
                  fontSize: '2.5em',
                  marginBottom: 18,
                  boxShadow: '0 2px 8px rgba(40,167,69,0.15)'
                }}
              >
                ✓
              </div>
              <div style={{ marginBottom: '14px', fontWeight: 600, fontSize: '1.1em', color: '#218838' }}>{message}</div>
              <Link to="/login" className="btn btn-primary" style={{ marginTop: '8px', display: 'inline-block', minWidth: 120 }}>
                Go to Sign In
              </Link>
            </div>
          )}
          {!message && (
            <>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email address"
                />
              </div>
              <button 
                disabled={loading} 
                className="auth-btn primary"
                type="submit"
              >
                {loading ? 'Sending...' : 'Send Reset Email'}
              </button>
            </>
          )}
        </form>
        
        <div className="auth-footer">
          <p>
            Remember your password? <Link to="/login">Sign in</Link>
          </p>
          <p>
            Don't have an account? <Link to="/register">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword; 