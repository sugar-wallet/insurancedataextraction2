import React, { useState } from 'react';
import './App.css';
import BatchUpload from './components/BatchUpload';
import BatchDataReview from './components/BatchDataReview';
import ErrorHandler from './components/ErrorHandler';

export interface Policy {
  id: string;
  policy_number?: string;
  insurance_type: string;
  categorized_fields: {
    known: { [key: string]: { value: string; confidence: number } };
    unknown: { [key: string]: null };
  };
  ai_response: any;
}

export interface ExtractedData {
  id: string;
  filename: string;
  policies: Policy[];
  extracted_text: string;
  timestamp: string;
  multiple_policies: boolean;
}

function App() {
  const [batchResults, setBatchResults] = useState<ExtractedData[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleBatchProcessComplete = (results: ExtractedData[]) => {
    setBatchResults(results);
    setError(null);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleRetry = () => {
    setError(null);
    setBatchResults([]);
  };

  const handleReset = () => {
    setBatchResults([]);
    setError(null);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Insurance Data Processor</h1>
        <p>Upload insurance documents, carjam reports, screenshots, or paste text to extract data</p>
      </header>

      <main className="App-main">
        {error && (
          <ErrorHandler 
            error={error} 
            onRetry={handleRetry}
            onManualEntry={() => {/* TODO: Implement manual entry */}}
          />
        )}

        {batchResults.length === 0 && !error && (
          <BatchUpload 
            onProcessComplete={handleBatchProcessComplete}
            onError={handleError}
          />
        )}

        {batchResults.length > 0 && !error && (
          <BatchDataReview 
            results={batchResults}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  );
}

export default App;
