import React, { useState, useRef } from 'react';
import { ExtractedData } from '../App';

interface MultiFileUploadProps {
  onUploadSuccess: (data: ExtractedData) => void;
  onUploadError: (error: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const MultiFileUpload: React.FC<MultiFileUploadProps> = ({
  onUploadSuccess,
  onUploadError,
  isLoading,
  setIsLoading
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [uploadType, setUploadType] = useState<'file' | 'text'>('file');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    const file = files[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      onUploadError('Please select a PDF, image (PNG/JPG), or text file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      onUploadError('File size must be less than 10MB');
      return;
    }

    setIsLoading(true);

    const formData = new FormData();
    
    // Determine which endpoint to use based on file type
    const endpoint = file.type === 'application/pdf' 
      ? 'http://localhost:3001/api/upload-pdf'
      : 'http://localhost:3001/api/upload-text-image';
    
    formData.append(file.type === 'application/pdf' ? 'pdf' : 'file', file);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        onUploadSuccess(result.data);
      } else {
        onUploadError(result.error || 'Failed to process file');
      }
    } catch (error) {
      onUploadError('Network error: Please check if the server is running');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) {
      onUploadError('Please enter some text');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/upload-text-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: textInput }),
      });

      const result = await response.json();

      if (result.success) {
        onUploadSuccess(result.data);
        setTextInput('');
      } else {
        onUploadError(result.error || 'Failed to process text');
      }
    } catch (error) {
      onUploadError('Network error: Please check if the server is running');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="upload-container">
      <div className="upload-tabs">
        <button
          className={`tab-button ${uploadType === 'file' ? 'active' : ''}`}
          onClick={() => setUploadType('file')}
        >
          📄 Upload File
        </button>
        <button
          className={`tab-button ${uploadType === 'text' ? 'active' : ''}`}
          onClick={() => setUploadType('text')}
        >
          ✏️ Paste Text
        </button>
      </div>

      {uploadType === 'file' ? (
        <>
          <div
            className={`upload-area ${dragActive ? 'drag-active' : ''} ${isLoading ? 'loading' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={onButtonClick}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="upload-input"
              accept=".pdf,image/*,.txt"
              onChange={handleChange}
              disabled={isLoading}
            />
            
            {isLoading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Processing file...</p>
                <p className="sub-text">Extracting data with AI</p>
              </div>
            ) : (
              <div className="upload-content">
                <div className="upload-icon">📁</div>
                <h3>Upload Insurance Document</h3>
                <p>Drag and drop your file here, or click to select</p>
                <p className="file-requirements">
                  Supported: PDF, Images (PNG/JPG), Text files | Max: 10MB
                </p>
                <div className="file-type-badges">
                  <span className="badge">📄 PDF</span>
                  <span className="badge">🖼️ Images</span>
                  <span className="badge">📝 Text</span>
                  <span className="badge new">🚗 Carjam Reports</span>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-input-area">
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Paste insurance details, vehicle information, or any relevant text here..."
            className="text-input"
            rows={10}
            disabled={isLoading}
          />
          <button
            onClick={handleTextSubmit}
            className="submit-text-btn"
            disabled={isLoading || !textInput.trim()}
          >
            {isLoading ? 'Processing...' : 'Process Text'}
          </button>
        </div>
      )}
      
      <div className="upload-info">
        <h4>What you can upload:</h4>
        <ul>
          <li>📄 Insurance policy PDFs</li>
          <li>🚗 Carjam vehicle reports</li>
          <li>📱 Screenshots of insurance details</li>
          <li>💬 Text messages with policy info</li>
          <li>📝 Any text with insurance data</li>
        </ul>
      </div>

    </div>
  );
};

export default MultiFileUpload;