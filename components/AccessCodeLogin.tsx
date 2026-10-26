import React from 'react';

interface AccessCodeLoginProps {
  firstName: string;
  setFirstName: (val: string) => void;
  accessCode: string;
  setAccessCode: (val: string) => void;
  loginError: string;
  onLogin: () => void;
  lockoutUntil: number | null;
}

export const AccessCodeLogin: React.FC<AccessCodeLoginProps> = ({
  firstName,
  setFirstName,
  accessCode,
  setAccessCode,
  loginError,
  onLogin,
  lockoutUntil
}) => {
  const isLockedOut = lockoutUntil && Date.now() < lockoutUntil;

  return (
    <div className="access-code-container">
      <div className="access-code-card">
        <h2>Welcome to Pixelings!</h2>
        <p className="access-code-subtitle">Enter your name and the magic code from your teacher.</p>
        
        <div className="input-group">
          <label htmlFor="first-name">Your First Name</label>
          <input
            id="first-name"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="e.g. Maya"
            disabled={isLockedOut}
            className={loginError ? 'input-error' : ''}
          />
        </div>

        <div className="input-group">
          <label htmlFor="access-code">Your Magic Code</label>
          <input
            id="access-code"
            type="text"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            placeholder="e.g. 123456"
            disabled={isLockedOut}
            className={loginError ? 'input-error' : ''}
          />
        </div>

        {loginError && <div className="login-error-message">{loginError}</div>}

        <button 
          onClick={onLogin} 
          disabled={isLockedOut} 
          className="login-submit-btn"
        >
          {isLockedOut ? 'Locked' : 'Let\'s Play!'}
        </button>
      </div>
    </div>
  );
};
