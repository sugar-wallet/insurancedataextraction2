import React, { useState } from 'react';
import { ExtractedData } from '../App';

interface BatchDataReviewProps {
  results: ExtractedData[];
  onReset: () => void;
}

const BatchDataReview: React.FC<BatchDataReviewProps> = ({ results, onReset }) => {
  const [selectedResult, setSelectedResult] = useState(0);
  const [editedFields, setEditedFields] = useState<{ [key: string]: { [key: string]: string } }>({});
  const [showMerged, setShowMerged] = useState(false);
  const [mergedData, setMergedData] = useState<ExtractedData | null>(null);

  const currentData = showMerged && mergedData ? mergedData : results[selectedResult];

  const handleFieldEdit = (policyId: string, fieldName: string, value: string) => {
    setEditedFields(prev => ({
      ...prev,
      [policyId]: {
        ...prev[policyId],
        [fieldName]: value
      }
    }));
  };

  const saveChanges = () => {
    // Update the results with edited fields
    const updatedResults = results.map((result, idx) => {
      if (idx !== selectedResult && !showMerged) return result;
      
      return {
        ...result,
        policies: result.policies.map(policy => {
          const policyEdits = editedFields[policy.id];
          if (!policyEdits) return policy;
          
          const updatedKnown = { ...policy.categorized_fields.known };
          const updatedUnknown = { ...policy.categorized_fields.unknown };
          
          // Update existing known fields
          Object.entries(updatedKnown).forEach(([fieldName, fieldData]) => {
            if (policyEdits[fieldName]) {
              updatedKnown[fieldName] = {
                ...fieldData,
                value: policyEdits[fieldName],
                confidence: 1.0 // Set to 100% since user manually entered
              };
            }
          });
          
          // Move filled missing fields to known fields
          Object.keys(updatedUnknown).forEach(fieldName => {
            if (policyEdits[fieldName] && policyEdits[fieldName].trim()) {
              updatedKnown[fieldName] = {
                value: policyEdits[fieldName],
                confidence: 1.0 // Set to 100% since user manually entered
              };
              delete updatedUnknown[fieldName];
            }
          });
          
          return {
            ...policy,
            categorized_fields: {
              known: updatedKnown,
              unknown: updatedUnknown
            }
          };
        })
      };
    });
    
    // Update the state
    results.splice(0, results.length, ...updatedResults);
    
    // Clear edited fields for saved policy
    const currentPolicyIds = currentData?.policies.map(p => p.id) || [];
    setEditedFields(prev => {
      const newEditedFields = { ...prev };
      currentPolicyIds.forEach(id => {
        delete newEditedFields[id];
      });
      return newEditedFields;
    });
    
    alert('Changes saved successfully!');
  };

  const mergeData = () => {
    // Create a merged dataset combining all extracted fields
    const merged: ExtractedData = {
      id: 'merged-' + Date.now(),
      filename: 'Merged Data',
      policies: [{
        id: 'merged-policy',
        insurance_type: 'auto',
        policy_number: '',
        categorized_fields: {
          known: {},
          unknown: {}
        },
        ai_response: { merged: true, sources: {} }
      }],
      extracted_text: 'Combined data from multiple sources',
      timestamp: new Date().toISOString(),
      multiple_policies: false
    };

    // Collect all fields from all results
    const allKnownFields: { [key: string]: { value: string; confidence: number; source: string } } = {};
    const fieldSources: { [key: string]: string[] } = {};

    results.forEach((result, resultIndex) => {
      result.policies.forEach(policy => {
        // Process known fields
        Object.entries(policy.categorized_fields.known).forEach(([fieldName, fieldData]) => {
          if (!allKnownFields[fieldName] || fieldData.confidence > allKnownFields[fieldName].confidence) {
            allKnownFields[fieldName] = {
              ...fieldData,
              source: result.filename
            };
          }
          
          if (!fieldSources[fieldName]) {
            fieldSources[fieldName] = [];
          }
          fieldSources[fieldName].push(result.filename);
        });
      });
    });

    // Build merged policy with highest confidence values
    Object.entries(allKnownFields).forEach(([fieldName, fieldData]) => {
      merged.policies[0].categorized_fields.known[fieldName] = {
        value: fieldData.value,
        confidence: fieldData.confidence
      };
      merged.policies[0].ai_response.sources[fieldName] = fieldData.source;
    });

    // Identify still missing fields
    const allPossibleFields = [
      'policy_number', 'policy_start_date', 'policy_end_date',
      'registration_number', 'car_make', 'car_model', 'car_year', 'car_value', 
      'body_type', 'transmission', 'engine_capacity', 'cylinders', 'variant', 
      'wof_status', 'vin', 'odometer_reading', 'fuel_type', 'color', 'seats',
      'client_address', 'gender', 'dob', 'licence_obtained_date', 'licence_type',
      'years_full_licence', 'residency_type', 'preferred_excess', 'payment_schedule',
      'usage_type', 'annual_kilometres', 'finance_status', 'finance_provider',
      'windscreen_excess_waiver', 'rental_car_coverage', 'roadside_assistance',
      'personal_belongings_coverage', 'claims_last_5_years', 'claim_years',
      'driving_convictions', 'immobiliser_security', 'modifications',
      'additional_drivers', 'drivers_under_25', 'excluded_providers'
    ];

    allPossibleFields.forEach(field => {
      if (!merged.policies[0].categorized_fields.known[field]) {
        merged.policies[0].categorized_fields.unknown[field] = null;
      }
    });

    setMergedData(merged);
    setShowMerged(true);
  };

  const downloadAllData = async () => {
    try {
      let dataToDownload;
      
      if (showMerged && mergedData) {
        // Download merged data
        dataToDownload = {
          files_processed: results.length,
          extraction_date: new Date().toISOString(),
          merged: true,
          all_data: [{
            filename: 'Merged from: ' + results.map(r => r.filename).join(', '),
            policies: mergedData.policies.map(policy => ({
              type: policy.insurance_type,
              policy_number: policy.policy_number,
              fields: {
                ...Object.entries(policy.categorized_fields.known).reduce((acc, [key, value]) => {
                  acc[key] = editedFields[policy.id]?.[key] || value.value;
                  return acc;
                }, {} as { [key: string]: string }),
                ...Object.keys(policy.categorized_fields.unknown).reduce((acc, key) => {
                  if (editedFields[policy.id]?.[key]) {
                    acc[key] = editedFields[policy.id][key];
                  }
                  return acc;
                }, {} as { [key: string]: string })
              }
            }))
          }]
        };
      } else {
        // Download all separate data
        dataToDownload = {
          files_processed: results.length,
          extraction_date: new Date().toISOString(),
          merged: false,
          all_data: results.map(result => ({
            filename: result.filename,
            policies: result.policies.map(policy => ({
              type: policy.insurance_type,
              policy_number: policy.policy_number,
              fields: {
                ...Object.entries(policy.categorized_fields.known).reduce((acc, [key, value]) => {
                  acc[key] = editedFields[policy.id]?.[key] || value.value;
                  return acc;
                }, {} as { [key: string]: string }),
                ...Object.keys(policy.categorized_fields.unknown).reduce((acc, key) => {
                  if (editedFields[policy.id]?.[key]) {
                    acc[key] = editedFields[policy.id][key];
                  }
                  return acc;
                }, {} as { [key: string]: string })
              }
            }))
          }))
        };
      }

      const content = generateCombinedReport(dataToDownload);
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = showMerged ? `merged-insurance-data-${Date.now()}.txt` : `combined-insurance-data-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download combined data:', error);
    }
  };

  const downloadMissingQuestions = async () => {
    try {
      // Collect all missing fields from all results
      const allMissingFields = new Set<string>();
      
      results.forEach(result => {
        result.policies.forEach(policy => {
          Object.keys(policy.categorized_fields.unknown).forEach(field => {
            allMissingFields.add(field);
          });
        });
      });

      const questionnaire = generateCombinedQuestionnaire(Array.from(allMissingFields));
      
      const blob = new Blob([questionnaire], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `combined-questionnaire-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download questionnaire:', error);
    }
  };

  const generateCombinedReport = (data: any) => {
    let content = `COMBINED INSURANCE DATA REPORT
Generated: ${new Date().toLocaleDateString()}
Files Processed: ${data.files_processed}

================================================================================

`;

    data.all_data.forEach((file: any, index: number) => {
      content += `FILE ${index + 1}: ${file.filename}
${'-'.repeat(50)}

`;
      file.policies.forEach((policy: any) => {
        content += `${policy.type.toUpperCase()} INSURANCE
Policy Number: ${policy.policy_number || 'N/A'}

`;
        Object.entries(policy.fields).forEach(([key, value]) => {
          content += `${formatFieldName(key)}: ${value}\n`;
        });
        content += '\n';
      });
      content += '\n';
    });

    return content;
  };

  const generateCombinedQuestionnaire = (missingFields: string[]) => {
    const fieldQuestions: { [key: string]: string } = {
      registration_number: "What is the vehicle's registration/number plate?",
      car_make: "What is the car's make/manufacturer?",
      car_model: "What is the car model?",
      car_year: "What year is the car?",
      car_value: "What is the estimated vehicle value?",
      body_type: "What is the body type (hatchback, wagon, sedan, SUV, ute, van)?",
      transmission: "Is the car automatic or manual?",
      engine_capacity: "What is the engine capacity (cc or litres)?",
      cylinders: "How many cylinders does the engine have?",
      variant: "What is the vehicle variant/trim level?",
      wof_status: "Does the car have a current Warrant of Fitness (WOF)?",
      vin: "What is the Vehicle Identification Number (VIN)?",
      odometer_reading: "What is the current odometer reading (km)?",
      fuel_type: "What type of fuel does the vehicle use?",
      color: "What color is the vehicle?",
      seats: "How many seats does the vehicle have?",
      client_address: "What is your residential address?",
      gender: "What is your gender?",
      dob: "What is your date of birth?",
      licence_obtained_date: "When did you get your driver's licence?",
      licence_type: "What type of licence do you have (full, restricted, learners)?",
      years_full_licence: "How many years have you held your full licence?",
      residency_type: "What is your residency status?",
      preferred_excess: "What excess amount would you prefer?",
      payment_schedule: "How would you like to pay (monthly, annually, fortnightly)?",
      usage_type: "Is the car used for business or personal use?",
      annual_kilometres: "How many kilometres do you drive per year?",
      finance_status: "Is the car under finance?",
      finance_provider: "If financed, who is the finance provider?",
      claims_last_5_years: "Have you made any claims in the last 5 years?",
      claim_years: "If yes, what years were the claims made?",
      driving_convictions: "Have you had any driving convictions?",
      modifications: "Are there any modifications on the car?",
      additional_drivers: "Are there any additional drivers?",
      drivers_under_25: "Are there any drivers under 25?"
    };

    let content = `COMBINED INSURANCE QUESTIONNAIRE
Generated: ${new Date().toLocaleDateString()}
Total Missing Fields: ${missingFields.length}

Please provide the following information:

`;

    missingFields.forEach((field, index) => {
      content += `${index + 1}. ${fieldQuestions[field] || `Please provide: ${formatFieldName(field)}`}\n\n`;
    });

    return content;
  };

  const formatFieldName = (fieldName: string): string => {
    return fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return '#4CAF50';
    if (confidence >= 0.6) return '#FF9800';
    return '#F44336';
  };

  const hasUnsavedChanges = () => {
    if (!currentData) return false;
    return currentData.policies.some(policy => editedFields[policy.id] && Object.keys(editedFields[policy.id]).length > 0);
  };

  return (
    <div className="batch-review-container">
      <div className="review-header">
        <h2>Batch Processing Results</h2>
        <div className="summary">
          <p>Files Processed: {results.length}</p>
          <p>Total Policies Found: {results.reduce((sum, r) => sum + r.policies.length, 0)}</p>
        </div>
      </div>

      <div className="batch-controls">
        {hasUnsavedChanges() && (
          <button onClick={saveChanges} className="save-btn save-changes-btn">
            💾 Save Changes
          </button>
        )}
        <button onClick={mergeData} className="merge-btn">
          🔀 Merge All Data
        </button>
        <button onClick={downloadAllData} className="download-all-btn">
          📥 Download All Data
        </button>
        <button onClick={downloadMissingQuestions} className="download-questions-btn">
          📋 Download All Missing Questions
        </button>
        <button onClick={onReset} className="reset-btn">
          🔄 Process More Files
        </button>
      </div>

      <div className="file-selector">
        <h3>Select File to Review:</h3>
        <div className="file-tabs">
          {showMerged && (
            <button
              className={`file-tab merged-tab active`}
              onClick={() => setShowMerged(true)}
            >
              🔀 Merged Data
            </button>
          )}
          {results.map((result, index) => (
            <button
              key={index}
              className={`file-tab ${!showMerged && selectedResult === index ? 'active' : ''}`}
              onClick={() => {
                setShowMerged(false);
                setSelectedResult(index);
              }}
            >
              {result.filename}
            </button>
          ))}
        </div>
      </div>

      {currentData && (
        <div className="data-section">
          {currentData.policies.map((policy) => (
            <div key={policy.id} className="policy-section">
              <div className="policy-header">
                <h3>{policy.insurance_type.toUpperCase()} Insurance</h3>
                {policy.policy_number && <p>Policy #: {policy.policy_number}</p>}
              </div>

              <div className="fields-section">
                <h4>Extracted Fields {showMerged && '(Combined from all sources)'}</h4>
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
                          className={`field-input ${editedFields[policy.id]?.[fieldName] ? 'edited' : ''}`}
                        />
                        <div 
                          className="confidence-indicator"
                          style={{ backgroundColor: getConfidenceColor(fieldData.confidence) }}
                          title={`Confidence: ${(fieldData.confidence * 100).toFixed(1)}%`}
                        >
                          {(fieldData.confidence * 100).toFixed(0)}%
                        </div>
                        {showMerged && policy.ai_response?.sources?.[fieldName] && (
                          <div className="source-indicator" title={`Source: ${policy.ai_response.sources[fieldName]}`}>
                            📄 {policy.ai_response.sources[fieldName].split('/').pop()?.substring(0, 15)}...
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="fields-section">
                <h4>Missing Fields</h4>
                <div className="fields-grid">
                  {Object.keys(policy.categorized_fields.unknown).map(fieldName => (
                    <div key={fieldName} className="field-item missing-field">
                      <label className="field-label">
                        {formatFieldName(fieldName)}
                      </label>
                      <div className="field-value-container">
                        <input
                          type="text"
                          value={editedFields[policy.id]?.[fieldName] || ''}
                          onChange={(e) => handleFieldEdit(policy.id, fieldName, e.target.value)}
                          className={`field-input missing-field-input ${editedFields[policy.id]?.[fieldName] ? 'edited' : ''}`}
                          placeholder="Enter value..."
                        />
                        <div className="missing-indicator">
                          Missing
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};

export default BatchDataReview;