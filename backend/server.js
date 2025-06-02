const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'text/plain'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, image (PNG, JPG), and text files are allowed'), false);
    }
  }
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const FIELD_TEMPLATES = {
  auto: {
    known: ['policy_number', 'policy_start_date', 'policy_end_date'],
    unknown: [
      // Vehicle Details
      'registration_number', 'car_make', 'car_model', 'car_year', 'car_value', 'body_type', 'transmission', 
      'engine_capacity', 'cylinders', 'variant', 'wof_status', 'vin', 'odometer_reading', 'fuel_type', 
      'color', 'seats',
      
      // Client Details
      'client_address', 'gender', 'dob', 'licence_obtained_date', 'licence_type', 
      'years_full_licence', 'residency_type',
      
      // Coverage & Finance
      'preferred_excess', 'payment_schedule', 'usage_type', 'annual_kilometres', 
      'finance_status', 'finance_provider', 'windscreen_excess_waiver', 
      'rental_car_coverage', 'roadside_assistance', 'personal_belongings_coverage',
      'premium', 'payment_frequency',
      
      // History & Security
      'claims_last_5_years', 'claim_years', 'driving_convictions', 
      'immobiliser_security', 'modifications',
      
      // Additional Drivers
      'additional_drivers', 'drivers_under_25',
      
      // Preferences
      'excluded_providers'
    ]
  },
  carjam: {
    known: [],
    unknown: [
      // Vehicle Details (excluding wof_status, usage_type, finance_status)
      'registration_number', 'car_make', 'car_model', 'car_year', 'car_value', 'body_type', 'transmission', 
      'engine_capacity', 'cylinders', 'variant', 'vin', 'odometer_reading', 'fuel_type', 
      'color', 'seats',
      
      // Security & Condition
      'immobiliser_security', 'modifications',
      
      // Finance Details (only if mentioned)
      'finance_provider'
    ]
  },
  home: {
    known: ['policy_number', 'property_address', 'policy_start_date', 'policy_end_date'],
    unknown: ['excess', 'premium', 'property_value', 'building_sum_insured', 'liability_coverage', 'natural_disaster_coverage']
  },
  contents: {
    known: ['policy_number', 'property_address', 'policy_start_date', 'policy_end_date'],
    unknown: ['excess', 'premium', 'contents_sum_insured', 'specified_items', 'liability_coverage']
  },
  life: {
    known: ['policy_number', 'beneficiary', 'coverage_amount', 'policy_type', 'policy_start_date'],
    unknown: ['premium', 'health_conditions', 'smoking_status', 'occupation', 'age_at_issue']
  },
  health: {
    known: ['policy_number', 'plan_name', 'network', 'policy_start_date', 'policy_end_date'],
    unknown: ['premium', 'deductible', 'out_of_pocket_max', 'prescription_coverage', 'copay_amounts']
  },
  commercial: {
    known: ['policy_number', 'business_name', 'coverage_type', 'policy_start_date', 'policy_end_date'],
    unknown: ['premium', 'liability_limits', 'property_coverage', 'business_interruption', 'workers_comp']
  }
};

let extractionsDatabase = [];

// Helper function to convert file to generative parts for Gemini
async function fileToGenerativePart(path, mimeType) {
  const fileData = await fs.readFile(path, { encoding: 'base64' });
  return {
    inlineData: {
      data: fileData,
      mimeType
    },
  };
}

app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    console.log('PDF upload request received');
    
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    console.log('File uploaded:', req.file.filename, 'Size:', req.file.size);

    const pdfBuffer = await fs.readFile(req.file.path);
    console.log('PDF file read successfully');
    
    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData.text;
    console.log('PDF parsed successfully. Text length:', extractedText.length);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro-preview-05-06' });
    console.log('Gemini model initialized');
    
    // Check if this might be a carjam report
    const isCarjamReport = extractedText.toLowerCase().includes('carjam') || 
                          extractedText.toLowerCase().includes('vehicle report') ||
                          extractedText.toLowerCase().includes('nzta records');
    
    const prompt = `
    Analyze this ${isCarjamReport ? 'vehicle report/carjam document' : 'insurance policy document'}. 
    ${isCarjamReport ? 'This is a CARJAM vehicle report that contains detailed vehicle specifications.' : 'IMPORTANT: Documents may contain MULTIPLE policies (e.g., home AND contents insurance as separate policies).'}
    
    ${isCarjamReport ? 'Extract vehicle details for AUTO insurance purposes:' : 'Identify ALL policies in the document and classify each as: auto, home, contents, life, health, or commercial.'}
    
    For AUTO/VEHICLE ${isCarjamReport ? 'details' : 'insurance'}, extract these specific fields with their common variations:
    - registration_number: "number plate", "rego", "registration", "plate number", "vehicle registration"
    - car_make: "manufacturer", "brand", "make", "vehicle make"
    - car_model: "model", "vehicle model"
    - car_year: "year of manufacture", "year", "YOM", "model year", "first registered"
    - car_value: "vehicle value", "market value", "sum insured", "insured value", "agreed value", "car worth"
    - body_type: "hatchback", "wagon", "sedan", "SUV", "ute", "van", "body style", "vehicle type"
    - transmission: "automatic", "manual", "auto", "gear type", "gearbox", "trans"
    - engine_capacity: "engine size", "cc", "displacement", "litres", "engine displacement", "capacity"
    - cylinders: "number of cylinders", "cyl", "cylinder count"
    - variant: "trim level", "grade", "variant", "model variant", "spec"
    - wof_status: "warrant of fitness", "WOF", "fitness", "roadworthy", "wof expiry"
    - vin: "vehicle identification number", "chassis number", "VIN"
    - odometer_reading: "odometer", "kilometres", "mileage", "odo reading"
    - fuel_type: "fuel", "petrol", "diesel", "hybrid", "electric", "fuel system"
    - color: "colour", "vehicle colour", "paint color"
    - seats: "seating capacity", "number of seats", "passenger capacity"
    - client_address: "risk address", "garaging address", "home address"
    - gender: "sex", "M/F", "male/female"
    - dob: "date of birth", "birth date", "DOB"
    - licence_obtained_date: "licence issue date", "when got licence", "licence from"
    - licence_type: "full licence", "restricted", "learners", "licence class"
    - years_full_licence: "years on full licence", "full licence held"
    - residency_type: "citizen", "permanent resident", "visa", "residency status"
    - preferred_excess: "excess", "deductible", "voluntary excess"
    - payment_schedule: "monthly", "annually", "fortnightly", "payment frequency"
    - usage_type: "business", "personal", "private", "commercial use"
    - annual_kilometres: "km per year", "annual mileage", "kilometres driven"
    - finance_status: "under finance", "loan", "financed", "security interest"
    - finance_provider: "finance company", "loan provider", "lienholder"
    - windscreen_excess_waiver: "glass cover", "windscreen cover", "glass protection"
    - rental_car_coverage: "rental vehicle", "courtesy car", "replacement vehicle"
    - roadside_assistance: "breakdown", "roadside", "emergency assistance"
    - personal_belongings_coverage: "contents cover", "personal items", "belongings"
    - claims_last_5_years: "claims history", "previous claims", "accident history"
    - claim_years: "when were claims", "claim dates", "years of claims"
    - driving_convictions: "traffic offences", "convictions", "infringements"
    - immobiliser_security: "alarm", "immobiliser", "security system", "anti-theft"
    - modifications: "mods", "alterations", "non-standard", "aftermarket"
    - additional_drivers: "named drivers", "other drivers", "additional driver details"
    - drivers_under_25: "young drivers", "under 25", "driver ages"
    - excluded_providers: "don't want", "exclude", "not interested in"
    - premium: "annual premium", "monthly premium", "premium amount", "cost", "price"
    - payment_frequency: "payment frequency", "how often", "payment schedule"
    
    Return in this format:
    {
      "policies": [
        {
          "insurance_type": "${isCarjamReport ? 'auto' : 'auto/home/contents/life/health/commercial'}",
          "policy_number": "value or null",
          "extracted_fields": {
            // Include ALL fields ${isCarjamReport ? 'found in the vehicle report' : 'relevant to the insurance type'}
          },
          "confidence_scores": {
            // Confidence 0.0-1.0 for each extracted field
          }
        }
      ]
    }
    
    ${isCarjamReport ? 'IMPORTANT: This is a vehicle report, so insurance_type should be "auto".' : 'IMPORTANT: If multiple policies exist (e.g., home AND contents), return each as a separate object in the policies array.'}
    
    Policy text:
    ${extractedText.substring(0, 6000)}
    `;

    console.log('Calling Gemini API...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log('Gemini API response received');
    
    let extractedData;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      return res.status(500).json({ 
        error: 'Failed to parse AI response',
        aiResponse: text
      });
    }

    // Handle multiple policies
    const policies = extractedData.policies || [extractedData];
    const processedPolicies = [];

    policies.forEach((policy, index) => {
      const insuranceType = policy.insurance_type || 'auto';
      // Use carjam template if it's a carjam report
      const template = isCarjamReport ? FIELD_TEMPLATES.carjam : (FIELD_TEMPLATES[insuranceType] || FIELD_TEMPLATES.auto);
      
      const categorizedFields = {
        known: {},
        unknown: {}
      };

      // Process known fields
      template.known.forEach(field => {
        if (policy.extracted_fields && policy.extracted_fields[field]) {
          categorizedFields.known[field] = {
            value: policy.extracted_fields[field],
            confidence: policy.confidence_scores?.[field] || 0.8
          };
        }
      });

      // Process unknown fields - check if they were extracted
      template.unknown.forEach(field => {
        if (policy.extracted_fields && policy.extracted_fields[field]) {
          categorizedFields.known[field] = {
            value: policy.extracted_fields[field],
            confidence: policy.confidence_scores?.[field] || 0.8
          };
        } else {
          categorizedFields.unknown[field] = null;
        }
      });

      processedPolicies.push({
        id: `${Date.now()}-${index}`,
        policy_number: policy.policy_number || policy.extracted_fields?.policy_number,
        insurance_type: insuranceType,
        categorized_fields: categorizedFields,
        ai_response: policy
      });
    });

    const processedData = {
      id: Date.now().toString(),
      filename: req.file.originalname,
      policies: processedPolicies,
      extracted_text: extractedText,
      timestamp: new Date().toISOString(),
      multiple_policies: processedPolicies.length > 1
    };

    await fs.unlink(req.file.path);

    res.json({
      success: true,
      data: processedData
    });

  } catch (error) {
    console.error('Error processing PDF:', error);
    console.error('Error stack:', error.stack);
    
    if (req.file) {
      await fs.unlink(req.file.path).catch(console.error);
    }
    
    res.status(500).json({ 
      error: 'Failed to process PDF',
      details: error.message,
      stack: error.stack
    });
  }
});

app.post('/api/upload-text-image', upload.single('file'), async (req, res) => {
  try {
    console.log('Text/Image upload request received');
    
    // Handle both multipart form data and JSON body
    const textInput = req.body.text || (req.headers['content-type']?.includes('application/json') && req.body?.text);
    
    if (!req.file && !textInput) {
      return res.status(400).json({ error: 'No file or text provided' });
    }

    let extractedText = '';
    let prompt = '';
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro-preview-05-06' });

    if (textInput) {
      // Direct text input
      extractedText = textInput;
      prompt = `
      Analyze this text which contains insurance or vehicle details. Extract any relevant fields for auto insurance.
      
      Text: ${extractedText}
      `;
    } else if (req.file) {
      if (req.file.mimetype === 'text/plain') {
        // Text file
        extractedText = await fs.readFile(req.file.path, 'utf-8');
        prompt = `
        Analyze this text which contains insurance or vehicle details. Extract any relevant fields for auto insurance.
        
        Text: ${extractedText}
        `;
      } else {
        // Image file - use vision capabilities
        const imagePart = await fileToGenerativePart(req.file.path, req.file.mimetype);
        prompt = `
        Analyze this image which may contain insurance details, vehicle information, or a screenshot of text messages.
        Extract any relevant fields for auto insurance. Look for vehicle details, insurance information, or any text that might be relevant.
        `;
        
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        extractedText = response.text();
      }
    }

    // Common field extraction prompt
    const extractionPrompt = `
    Based on the following information, extract auto insurance relevant fields.
    
    Look for these specific fields:
    - registration_number
    - car_make
    - car_model
    - car_year
    - car_value
    - body_type
    - transmission
    - engine_capacity
    - cylinders
    - variant
    - wof_status
    - vin
    - odometer_reading
    - fuel_type
    - color
    - seats
    - client_address
    - gender
    - dob
    - licence_obtained_date
    - licence_type
    - years_full_licence
    - residency_type
    - preferred_excess
    - payment_schedule
    - usage_type
    - annual_kilometres
    - finance_status
    - finance_provider
    - claims_last_5_years
    - driving_convictions
    - modifications
    
    Return in this format:
    {
      "insurance_type": "auto",
      "extracted_fields": {
        // Include only fields found in the text
      },
      "confidence_scores": {
        // Confidence 0.0-1.0 for each extracted field
      },
      "source_type": "${req.file ? (req.file.mimetype.includes('image') ? 'image' : 'text_file') : 'text_input'}"
    }
    
    ${req.file?.mimetype.includes('image') ? 'Extracted text from image:' : 'Text to analyze:'}
    ${extractedText}
    `;

    const result = await model.generateContent(extractionPrompt);
    const response = await result.response;
    const text = response.text();
    
    let extractedData;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      return res.status(500).json({ 
        error: 'Failed to parse AI response',
        aiResponse: text
      });
    }

    // Process the extracted data
    const template = FIELD_TEMPLATES.auto;
    const categorizedFields = {
      known: {},
      unknown: {}
    };

    // Add extracted fields to known
    if (extractedData.extracted_fields) {
      Object.entries(extractedData.extracted_fields).forEach(([field, value]) => {
        if (value) {
          categorizedFields.known[field] = {
            value: value,
            confidence: extractedData.confidence_scores?.[field] || 0.8
          };
        }
      });
    }

    // Mark remaining fields as unknown
    [...template.known, ...template.unknown].forEach(field => {
      if (!categorizedFields.known[field]) {
        categorizedFields.unknown[field] = null;
      }
    });

    const processedData = {
      id: Date.now().toString(),
      filename: req.file?.originalname || 'text-input',
      policies: [{
        id: Date.now().toString(),
        insurance_type: 'auto',
        categorized_fields: categorizedFields,
        source_type: extractedData.source_type,
        ai_response: extractedData
      }],
      extracted_text: extractedText.substring(0, 1000), // Limit for response size
      timestamp: new Date().toISOString(),
      upload_type: 'text_or_image'
    };

    if (req.file) {
      await fs.unlink(req.file.path).catch(console.error);
    }

    res.json({
      success: true,
      data: processedData
    });

  } catch (error) {
    console.error('Error processing text/image:', error);
    
    if (req.file) {
      await fs.unlink(req.file.path).catch(console.error);
    }
    
    res.status(500).json({ 
      error: 'Failed to process text/image',
      details: error.message
    });
  }
});

app.post('/api/save-corrections', (req, res) => {
  try {
    const { id, correctedFields } = req.body;
    
    const correctedData = {
      id,
      corrected_fields: correctedFields,
      timestamp: new Date().toISOString()
    };
    
    extractionsDatabase.push(correctedData);
    
    res.json({ success: true, message: 'Corrections saved for learning' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save corrections' });
  }
});

app.post('/api/download-collected-data', (req, res) => {
  try {
    const { data, insuranceType } = req.body;
    
    if (!data || !data.policies || data.policies.length === 0) {
      return res.status(400).json({ error: 'No data provided' });
    }

    let content = `COLLECTED INSURANCE DATA
Generated: ${new Date().toLocaleDateString()}
File Source: ${data.filename}

================================================================================

`;

    // Process each policy
    data.policies.forEach((policy, index) => {
      content += `${policy.insurance_type.toUpperCase()} INSURANCE${data.policies.length > 1 ? ` (Policy ${index + 1})` : ''}
${policy.policy_number ? `Policy Number: ${policy.policy_number}` : ''}

COLLECTED INFORMATION:
`;

      // Group fields by category
      const vehicleFields = ['registration_number', 'car_make', 'car_model', 'car_year', 'car_value', 
        'body_type', 'transmission', 'engine_capacity', 'cylinders', 'variant', 'wof_status', 
        'vin', 'odometer_reading', 'fuel_type', 'color', 'seats'];
      
      const clientFields = ['client_address', 'gender', 'dob', 'licence_obtained_date', 
        'licence_type', 'years_full_licence', 'residency_type'];
      
      const coverageFields = ['preferred_excess', 'payment_schedule', 'usage_type', 'annual_kilometres',
        'finance_status', 'finance_provider', 'windscreen_excess_waiver', 'rental_car_coverage',
        'roadside_assistance', 'personal_belongings_coverage'];
      
      const historyFields = ['claims_last_5_years', 'claim_years', 'driving_convictions',
        'immobiliser_security', 'modifications', 'additional_drivers', 'drivers_under_25'];

      // Vehicle Details
      content += '\nVEHICLE DETAILS:\n';
      vehicleFields.forEach(field => {
        if (policy.categorized_fields.known[field]) {
          const fieldData = policy.categorized_fields.known[field];
          content += `- ${formatFieldName(field)}: ${fieldData.value} (${(fieldData.confidence * 100).toFixed(0)}% confidence)\n`;
        }
      });

      // Client Details
      content += '\nCLIENT DETAILS:\n';
      clientFields.forEach(field => {
        if (policy.categorized_fields.known[field]) {
          const fieldData = policy.categorized_fields.known[field];
          content += `- ${formatFieldName(field)}: ${fieldData.value} (${(fieldData.confidence * 100).toFixed(0)}% confidence)\n`;
        }
      });

      // Coverage & Finance
      content += '\nCOVERAGE & FINANCE:\n';
      coverageFields.forEach(field => {
        if (policy.categorized_fields.known[field]) {
          const fieldData = policy.categorized_fields.known[field];
          content += `- ${formatFieldName(field)}: ${fieldData.value} (${(fieldData.confidence * 100).toFixed(0)}% confidence)\n`;
        }
      });

      // History & Security
      content += '\nHISTORY & SECURITY:\n';
      historyFields.forEach(field => {
        if (policy.categorized_fields.known[field]) {
          const fieldData = policy.categorized_fields.known[field];
          content += `- ${formatFieldName(field)}: ${fieldData.value} (${(fieldData.confidence * 100).toFixed(0)}% confidence)\n`;
        }
      });

      // Other fields
      const categorizedFieldNames = [...vehicleFields, ...clientFields, ...coverageFields, ...historyFields];
      const otherKnownFields = Object.keys(policy.categorized_fields.known)
        .filter(field => !categorizedFieldNames.includes(field) && field !== 'policy_number');
      
      if (otherKnownFields.length > 0) {
        content += '\nOTHER INFORMATION:\n';
        otherKnownFields.forEach(field => {
          const fieldData = policy.categorized_fields.known[field];
          content += `- ${formatFieldName(field)}: ${fieldData.value} (${(fieldData.confidence * 100).toFixed(0)}% confidence)\n`;
        });
      }

      content += '\n' + '='.repeat(80) + '\n\n';
    });

    // Add summary
    const totalFields = data.policies.reduce((sum, policy) => 
      sum + Object.keys(policy.categorized_fields.known).length, 0);
    const missingFields = data.policies.reduce((sum, policy) => 
      sum + Object.keys(policy.categorized_fields.unknown).length, 0);

    content += `SUMMARY:
- Total policies processed: ${data.policies.length}
- Total fields collected: ${totalFields}
- Total fields missing: ${missingFields}
- Data extraction date: ${new Date(data.timestamp).toLocaleString()}
`;

    res.json({
      success: true,
      content: content,
      filename: `insurance-data-${data.id}.txt`
    });

  } catch (error) {
    console.error('Error generating collected data report:', error);
    res.status(500).json({ error: 'Failed to generate collected data report' });
  }
});

// Helper function for field name formatting
function formatFieldName(fieldName) {
  return fieldName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

app.post('/api/generate-questionnaire', (req, res) => {
  try {
    const { data, insuranceType } = req.body;
    
    console.log('Generate questionnaire request:', {
      insuranceType,
      knownFieldsCount: Object.keys(data.categorized_fields.known).length,
      unknownFieldsCount: Object.keys(data.categorized_fields.unknown).length
    });
    
    const template = FIELD_TEMPLATES[insuranceType] || FIELD_TEMPLATES.auto;
    const missingFields = template.unknown.filter(field => 
      !data.categorized_fields.known[field]
    );
    
    console.log('Template unknown fields:', template.unknown.length);
    console.log('Actual missing fields:', missingFields.length);
    
    const questionnaire = generateQuestionnaire(missingFields, insuranceType, data);
    
    res.json({
      success: true,
      questionnaire: questionnaire,
      filename: `questionnaire-${data.id}.txt`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate questionnaire' });
  }
});

function generateQuestionnaire(missingFields, insuranceType, data) {
  const questions = {
    // Personal Details
    client_address: "What is your residential address?",
    gender: "What is your gender?",
    dob: "What is your date of birth (DD/MM/YYYY)?",
    licence_obtained_date: "When did you obtain your driver's licence (DD/MM/YYYY)?",
    licence_type: "What type of licence do you hold (full, provisional, learner)?",
    years_full_licence: "How many years have you held your full licence?",
    residency_type: "What is your residency status (citizen, permanent resident, visa holder)?",
    
    // Vehicle Details
    registration_number: "What is your vehicle's registration number?",
    car_make: "What is the make of your vehicle (e.g., Toyota, Ford)?",
    car_model: "What is the model of your vehicle (e.g., Camry, Ranger)?",
    car_year: "What year was your vehicle manufactured?",
    body_type: "What is your vehicle's body type (hatchback, wagon, sedan, SUV, ute, van)?",
    transmission: "Does your vehicle have automatic or manual transmission?",
    engine_capacity: "What is your engine capacity in litres (e.g., 2.0L)?",
    cylinders: "How many cylinders does your engine have?",
    variant: "What is your vehicle's variant or trim level (e.g., SR5, GLX)?",
    wof_status: "Does your vehicle have a current Warrant of Fitness (WOF) or roadworthy certificate?",
    vin: "What is your Vehicle Identification Number (VIN)?",
    odometer_reading: "What is your current odometer reading in kilometres?",
    fuel_type: "What type of fuel does your vehicle use (petrol, diesel, hybrid, electric)?",
    color: "What colour is your vehicle?",
    seats: "How many seats does your vehicle have?",
    
    // Vehicle Security & Condition
    immobiliser_security: "Does your vehicle have an immobiliser or alarm system?",
    modifications: "Have any modifications been made to your vehicle from manufacturer specifications?",
    
    // Usage & Coverage
    usage_type: "What do you primarily use your vehicle for (private, business, rideshare)?",
    annual_kilometres: "How many kilometres do you expect to drive annually?",
    preferred_excess: "What excess amount would you prefer ($400, $600, $800, $1000)?",
    payment_schedule: "How would you prefer to pay your premium (monthly, fortnightly, annually)?",
    
    // Additional Coverage Options
    windscreen_excess_waiver: "Would you like windscreen excess waiver coverage?",
    rental_car_coverage: "Would you like rental car coverage after an accident?",
    roadside_assistance: "Would you like roadside assistance included?",
    personal_belongings_coverage: "Would you like coverage for personal belongings in the vehicle?",
    
    // Finance Details
    finance_status: "Is your vehicle currently under finance (yes/no)?",
    finance_provider: "If financed, who is your finance provider?",
    
    // Premium Details
    premium: "What is your current insurance premium amount?",
    payment_frequency: "How often do you pay your premium (monthly, fortnightly, annually)?",
    
    // Claims & Driving History
    claims_last_5_years: "Have you made any insurance claims in the last 5 years (yes/no)?",
    claim_years: "If yes, which years did you make claims (e.g., 2021, 2023)?",
    driving_convictions: "Do you have any driving convictions or traffic offences in the last 5 years?",
    
    // Additional Drivers
    additional_drivers: "Will there be any additional drivers on this policy (yes/no)?",
    drivers_under_25: "Will any drivers be under 25 years of age?",
    excluded_providers: "Are there any insurance providers you would prefer not to receive quotes from?",
    
    // Home/Contents Insurance Questions
    excess: "What is your preferred excess amount?",
    premium: "What is your current premium?",
    property_value: "What is the estimated value of your property?",
    building_sum_insured: "What building sum insured do you require?",
    contents_sum_insured: "What contents sum insured do you require?",
    specified_items: "Do you have any specified items to list?",
    liability_coverage: "What liability coverage limits do you require?",
    natural_disaster_coverage: "Do you need natural disaster coverage?",
    
    // Other Insurance Types
    health_conditions: "Please list any pre-existing health conditions:",
    smoking_status: "Are you a smoker? (Yes/No)",
    occupation: "What is your current occupation?",
    age_at_issue: "What was your age when the policy was issued?",
    deductible: "What is your deductible amount?",
    out_of_pocket_max: "What is your out-of-pocket maximum?",
    prescription_coverage: "Do you have prescription drug coverage?",
    copay_amounts: "What are your copay amounts for different services?",
    liability_limits: "What are your liability coverage limits?",
    property_coverage: "What property coverage do you need?",
    business_interruption: "Do you need business interruption coverage?",
    workers_comp: "Do you need workers' compensation coverage?"
  };
  
  const header = `INSURANCE POLICY QUESTIONNAIRE
${insuranceType.toUpperCase()} INSURANCE

Policy Reference: ${data.categorized_fields.known.policy_number?.value || 'N/A'}
Generated: ${new Date().toLocaleDateString()}

Please provide the following missing information:

`;

  // Organize fields by category
  const fieldCategories = {
    'Personal Details': ['client_address', 'gender', 'dob', 'licence_obtained_date', 'licence_type', 'years_full_licence', 'residency_type'],
    'Vehicle Details': ['registration_number', 'car_make', 'car_model', 'car_year', 'body_type', 'transmission', 'engine_capacity', 'cylinders', 'variant', 'wof_status', 'vin', 'odometer_reading', 'fuel_type', 'color', 'colour', 'seats'],
    'Vehicle Security & Condition': ['immobiliser_security', 'modifications'],
    'Usage & Coverage': ['usage_type', 'annual_kilometres', 'preferred_excess', 'payment_schedule'],
    'Premium & Payment': ['premium', 'payment_frequency'],
    'Additional Coverage Options': ['windscreen_excess_waiver', 'rental_car_coverage', 'roadside_assistance', 'personal_belongings_coverage'],
    'Finance Details': ['finance_status', 'finance_provider'],
    'Claims & Driving History': ['claims_last_5_years', 'claim_years', 'driving_convictions'],
    'Additional Drivers': ['additional_drivers', 'drivers_under_25'],
    'Preferences': ['excluded_providers']
  };

  let questionList = '';
  let questionNumber = 1;

  // Check if this is a carjam report with finance information
  const isCarjamWithFinance = data.insurance_type === 'auto' && 
                              data.categorized_fields.known.finance_status && 
                              data.categorized_fields.known.finance_status.value.toLowerCase().includes('yes');

  // Build questions organized by category
  for (const [category, fields] of Object.entries(fieldCategories)) {
    const categoryFields = missingFields.filter(field => fields.includes(field));
    
    if (categoryFields.length > 0) {
      questionList += `\n${category.toUpperCase()}\n${'='.repeat(category.length)}\n\n`;
      
      categoryFields.forEach(field => {
        questionList += `${questionNumber}. ${questions[field] || `Please provide information for: ${field}`}\n\n`;
        questionNumber++;
      });
    }
  }
  
  // Add special finance follow-up if carjam shows finance
  if (isCarjamWithFinance && !missingFields.includes('finance_status')) {
    questionList += `\nFINANCE VERIFICATION\n${'='.repeat(19)}\n\n`;
    questionList += `${questionNumber}. Our records show this vehicle may have been under finance. Is it still currently under finance (yes/no)?\n\n`;
    questionNumber++;
    if (!missingFields.includes('finance_provider')) {
      questionList += `${questionNumber}. If yes, please confirm the current finance provider.\n\n`;
    }
  }

  const footer = `
Please return this completed questionnaire to process your policy.
Thank you for your cooperation.`;

  return header + questionList + footer;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/test-gemini', async (req, res) => {
  try {
    console.log('Testing Gemini API...');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro-preview-05-06' });
    const result = await model.generateContent('Say "Hello from Gemini!"');
    const response = await result.response;
    const text = response.text();
    console.log('Gemini test response:', text);
    res.json({ success: true, response: text });
  } catch (error) {
    console.error('Gemini test error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});