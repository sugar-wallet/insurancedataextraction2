import React, { useState } from 'react';
import { ExtractedData, Policy } from '../App';
import { API_ENDPOINTS } from '../config/api';

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
      const policy = data.policies.find(p => p.id === policyId);
      if (!policy) return;

      // Combine existing fields with their edited values and newly filled missing fields
      const allFields: { [key: string]: any } = {};
      
      // Add known fields (with edits if any)
      Object.entries(policy.categorized_fields.known).forEach(([fieldName, fieldData]) => {
        allFields[fieldName] = {
          value: editedFields[policyId]?.[fieldName] || fieldData.value,
          confidence: fieldData.confidence,
          source: 'extracted'
        };
      });
      
      // Add manually filled missing fields
      Object.keys(policy.categorized_fields.unknown).forEach(fieldName => {
        if (editedFields[policyId]?.[fieldName]) {
          allFields[fieldName] = {
            value: editedFields[policyId][fieldName],
            confidence: 1.0,
            source: 'manual'
          };
        }
      });

      const response = await fetch(API_ENDPOINTS.saveCorrections, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: policyId,
          correctedFields: editedFields[policyId] || {},
          allFields: allFields,
          insuranceType: policy.insurance_type
        }),
      });

      if (response.ok) {
        alert('Corrections and manually entered fields saved successfully!');
      }
    } catch (error) {
      console.error('Failed to save corrections:', error);
    }
  };

  const generateQuestionnaire = async (policy: Policy) => {
    setIsGeneratingQuestionnaire(true);
    
    try {
      const response = await fetch(API_ENDPOINTS.generateQuestionnaire, {
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
      const response = await fetch(API_ENDPOINTS.downloadCollectedData, {
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

  // Combine all fields into one array for easier rendering
  const getAllFields = (policy: Policy) => {
    const fields: Array<{ name: string; value: string; confidence: number; isExtracted: boolean }> = [];
    
    // Add known fields
    Object.entries(policy.categorized_fields.known).forEach(([fieldName, fieldData]) => {
      fields.push({
        name: fieldName,
        value: fieldData.value,
        confidence: fieldData.confidence,
        isExtracted: true
      });
    });
    
    // Add unknown fields
    Object.keys(policy.categorized_fields.unknown).forEach(fieldName => {
      fields.push({
        name: fieldName,
        value: '',
        confidence: 0,
        isExtracted: false
      });
    });
    
    return fields;
  };

  return (
    <div className="data-review-container">
      <div className="review-header" style={{ backgroundColor: '#e8f5e9', padding: '2rem', borderRadius: '8px' }}>
        <h2 style={{ color: '#2e7d32' }}>🎉 UPDATED VERSION - All Fields Are Now Editable! 🎉</h2>
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
            <h4 style={{ color: '#1976d2', fontSize: '1.5rem' }}>
              ✏️ Edit Any Field Below (Including Missing Ones!)
            </h4>
            <div className="fields-grid">
              {getAllFields(policy).map((field) => (
                <div key={field.name} className="field-item">
                  <label className="field-label">
                    {formatFieldName(field.name)}
                  </label>
                  <div className="field-value-container">
                    <input
                      type="text"
                      value={editedFields[policy.id]?.[field.name] || field.value}
                      onChange={(e) => handleFieldEdit(policy.id, field.name, e.target.value)}
                      className="field-input"
                      placeholder={field.isExtracted ? '' : '❗ Missing - Please enter manually'}
                      style={{
                        borderColor: field.isExtracted ? '#e0e0e0' : '#ff9800',
                        backgroundColor: field.isExtracted ? '#fff' : '#fff3e0'
                      }}
                    />
                    <div 
                      className="confidence-indicator"
                      style={{ 
                        backgroundColor: field.isExtracted ? getConfidenceColor(field.confidence) : '#ff5722'
                      }}
                      title={field.isExtracted ? `Confidence: ${(field.confidence * 100).toFixed(1)}%` : 'Not found in document'}
                    >
                      {field.isExtracted ? `${(field.confidence * 100).toFixed(0)}%` : 'MISSING'}
                    </div>
                  </div>
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
              Save All Changes
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