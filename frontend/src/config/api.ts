// API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const API_ENDPOINTS = {
  uploadPdf: `${API_BASE_URL}/api/upload-pdf`,
  uploadTextImage: `${API_BASE_URL}/api/upload-text-image`,
  saveCorrections: `${API_BASE_URL}/api/save-corrections`,
  generateQuestionnaire: `${API_BASE_URL}/api/generate-questionnaire`,
  downloadCollectedData: `${API_BASE_URL}/api/download-collected-data`,
  health: `${API_BASE_URL}/api/health`
};

export default API_BASE_URL;