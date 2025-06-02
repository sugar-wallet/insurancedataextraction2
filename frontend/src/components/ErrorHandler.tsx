import React from 'react';

interface ErrorHandlerProps {
  error: string;
  onRetry: () => void;
  onManualEntry: () => void;
}

const ErrorHandler: React.FC<ErrorHandlerProps> = ({ error, onRetry, onManualEntry }) => {
  return (
    <div className="error-container">
      <div className="error-content">
        <div className="error-icon">⚠️</div>
        <h3>Processing Error</h3>
        <p className="error-message">{error}</p>
        
        <div className="error-actions">
          <button onClick={onRetry} className="retry-btn">
            Try Another PDF
          </button>
          <button onClick={onManualEntry} className="manual-entry-btn">
            Manual Data Entry
          </button>
        </div>
        
        <div className="error-tips">
          <h4>Tips for better results:</h4>
          <ul>
            <li>Ensure the PDF is a text-based document (not a scanned image)</li>
            <li>Check that the file size is under 10MB</li>
            <li>Make sure the PDF contains insurance policy information</li>
            <li>Verify the server is running on port 3001</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ErrorHandler;