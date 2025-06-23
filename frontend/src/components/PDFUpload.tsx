import React, { useState, useRef } from 'react';
import { ExtractedData } from '../App';
import { API_ENDPOINTS } from '../config/api';

interface PDFUploadProps {
  onUploadSuccess: (data: ExtractedData) => void;
  onUploadError: (error: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const PDFUpload: React.FC<PDFUploadProps> = ({
  onUploadSuccess,
  onUploadError,
  isLoading,
  setIsLoading
}) => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    const file = files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      onUploadError('Please select a PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      onUploadError('File size must be less than 10MB');
      return;
    }

    setIsLoading(true);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await fetch(API_ENDPOINTS.uploadPdf, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        onUploadSuccess(result.data);
      } else {
        onUploadError(result.error || 'Failed to process PDF');
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
          accept=".pdf"
          onChange={handleChange}
          disabled={isLoading}
        />
        
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Processing PDF...</p>
            <p className="sub-text">Extracting data with AI</p>
          </div>
        ) : (
          <div className="upload-content">
            <div className="upload-icon">📄</div>
            <h3>Upload Insurance Policy PDF</h3>
            <p>Drag and drop your PDF here, or click to select</p>
            <p className="file-requirements">
              Maximum file size: 10MB | Supported format: PDF
            </p>
          </div>
        )}
      </div>
      
      <div className="upload-info">
        <h4>Supported Insurance Types:</h4>
        <ul>
          <li>Auto Insurance</li>
          <li>Home Insurance</li>
          <li>Life Insurance</li>
          <li>Health Insurance</li>
          <li>Commercial Insurance</li>
        </ul>
      </div>
    </div>
  );
};

export default PDFUpload;