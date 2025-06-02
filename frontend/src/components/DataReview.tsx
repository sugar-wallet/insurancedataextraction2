import React, { useState } from 'react';
import { ExtractedData, Policy } from '../App';

interface DataReviewProps {
  data: ExtractedData;
  onReset: () => void;
}

const DataReview: React.FC<DataReviewProps> = ({ data, onReset }) => {
  const [editedFields, setEditedFields] = useState<{ [policyId: string]: { [key: string]: string } }>({});
  const [isGeneratingQuestionnaire, setIsGeneratingQuestionnaire] = useState(false);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>(data.policies[0]?.id || '');

  const handleFieldEdit = (policyId: string, fieldName: string, value: string) => {
    setEditedFields(prev => ({
      ...prev,
      [policyId]: {
        ...prev[policyId],
        [fieldName]: value
      }
    }));
  };

  const saveCorrections = async (policyId: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/save-corrections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: policyId,
          correctedFields: editedFields[policyId] || {}
        }),
      });

      if (response.ok) {
        alert('Corrections saved for future learning!');
      }
    } catch (error) {
      console.error('Failed to save corrections:', error);
    }
  };

  const generateQuestionnaire = async (policy: Policy) => {
    setIsGeneratingQuestionnaire(true);
    
    try {
      const response = await fetch('http://localhost:3001/api/generate-questionnaire', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            ...data,
            insurance_type: policy.insurance_type,
            categorized_fields: policy.categorized_fields
          },
          insuranceType: policy.insurance_type
        }),
      });

      const result = await response.json();

      if (result.success) {
        const blob = new Blob([result.questionnaire], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to generate questionnaire:', error);
      alert('Failed to generate questionnaire');
    } finally {
      setIsGeneratingQuestionnaire(false);
    }
  };

  const downloadCollectedData = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/download-collected-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: data,
          insuranceType: data.policies[0]?.insurance_type || 'auto'
        }),
      });

      const result = await response.json();

      if (result.success) {
        const blob = new Blob([result.content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to download collected data:', error);
      alert('Failed to download collected data');
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return '#4CAF50';
    if (confidence >= 0.6) return '#FF9800';
    return '#F44336';
  };

  const formatFieldName = (fieldName: string): string => {
    return fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="data-review-container">
      <div className="review-header">
        <h2>Extracted Data Review</h2>
        <div className="file-info">
          <p><strong>File:</strong> {data.filename}</p>
          <p><strong>Processed:</strong> {new Date(data.timestamp).toLocaleString()}</p>
          {data.multiple_policies && (
            <p className="multiple-policies-notice">
              <strong>Note:</strong> This document contains {data.policies.length} policies
            </p>
          )}
        </div>
      </div>

      {data.policies.length > 1 && (
        <div className="policy-tabs">
          {data.policies.map((policy, index) => (
            <button
              key={policy.id}
              className={`policy-tab ${selectedPolicyId === policy.id ? 'active' : ''}`}
              onClick={() => setSelectedPolicyId(policy.id)}
            >
              {policy.insurance_type.toUpperCase()} Policy {index + 1}
              {policy.policy_number && ` (${policy.policy_number})`}
            </button>
          ))}
        </div>
      )}

      {data.policies.map((policy) => (
        <div
          key={policy.id}
          className={`policy-section ${selectedPolicyId === policy.id ? 'active' : 'hidden'}`}
        >
          <div className="policy-header">
            <h3>{policy.insurance_type.toUpperCase()} Insurance</h3>
            {policy.policy_number && <p>Policy #: {policy.policy_number}</p>}
          </div>

          <div className="fields-section">
            <h4>Extracted Fields</h4>
            <div className="fields-grid">
              {Object.entries(policy.categorized_fields.known).map(([fieldName, fieldData]) => (
                <div key={fieldName} className="field-item">
                  <label className="field-label">
                    {formatFieldName(fieldName)}
                  </label>
                  <div className="field-value-container">
                    <input
                      type="text"
                      value={editedFields[policy.id]?.[fieldName] || fieldData.value}
                      onChange={(e) => handleFieldEdit(policy.id, fieldName, e.target.value)}
                      className="field-input"
                    />
                    <div 
                      className="confidence-indicator"
                      style={{ backgroundColor: getConfidenceColor(fieldData.confidence) }}
                      title={`Confidence: ${(fieldData.confidence * 100).toFixed(1)}%`}
                    >
                      {(fieldData.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="fields-section">
            <h4>Missing Fields</h4>
            <div className="missing-fields">
              {Object.keys(policy.categorized_fields.unknown).map(fieldName => (
                <div key={fieldName} className="missing-field-item">
                  <span className="missing-field-name">
                    {formatFieldName(fieldName)}
                  </span>
                  <span className="missing-indicator">Missing</span>
                </div>
              ))}
            </div>
          </div>

          <div className="actions-section">
            <button 
              onClick={() => saveCorrections(policy.id)}
              className="save-corrections-btn"
              disabled={!editedFields[policy.id] || Object.keys(editedFields[policy.id]).length === 0}
            >
              Save Corrections
            </button>
            
            <button 
              onClick={() => generateQuestionnaire(policy)}
              className="generate-questionnaire-btn"
              disabled={isGeneratingQuestionnaire}
            >
              {isGeneratingQuestionnaire ? 'Generating...' : 'Download Questions'}
            </button>
            
            <button 
              onClick={downloadCollectedData}
              className="download-data-btn"
              style={{ backgroundColor: '#4CAF50' }}
            >
              Download Collected Data
            </button>
          </div>
        </div>
      ))}

      <button 
        onClick={onReset}
        className="reset-btn"
        style={{ marginTop: '2rem' }}
      >
        Process Another PDF
      </button>

      <div className="extracted-text-section">
        <h3>Raw Extracted Text</h3>
        <div className="extracted-text">
          {data.extracted_text.substring(0, 500)}...
        </div>
      </div>
    </div>
  );
};

export default DataReview;