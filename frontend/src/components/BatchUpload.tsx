import React, { useState, useRef } from 'react';
import { ExtractedData } from '../App';

interface FileItem {
  id: string;
  file?: File;
  text?: string;
  type: 'pdf' | 'image' | 'text';
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: ExtractedData;
  error?: string;
}

interface BatchUploadProps {
  onProcessComplete: (results: ExtractedData[]) => void;
  onError: (error: string) => void;
}

const BatchUpload: React.FC<BatchUploadProps> = ({ onProcessComplete, onError }) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [textInput, setTextInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (newFiles: FileList) => {
    const fileItems: FileItem[] = Array.from(newFiles).map(file => {
      let type: 'pdf' | 'image' | 'text' = 'text';
      if (file.type === 'application/pdf') type = 'pdf';
      else if (file.type.startsWith('image/')) type = 'image';
      
      return {
        id: `${Date.now()}-${Math.random()}`,
        file,
        type,
        name: file.name,
        status: 'pending' as const
      };
    });

    setFiles(prev => [...prev, ...fileItems]);
  };

  const addText = () => {
    if (!textInput.trim()) return;

    const textItem: FileItem = {
      id: `${Date.now()}-${Math.random()}`,
      text: textInput,
      type: 'text',
      name: `Text input ${new Date().toLocaleTimeString()}`,
      status: 'pending'
    };

    setFiles(prev => [...prev, textItem]);
    setTextInput('');
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const processAllFiles = async () => {
    if (files.length === 0) {
      onError('No files to process');
      return;
    }

    setIsProcessing(true);
    const results: ExtractedData[] = [];

    for (const fileItem of files) {
      try {
        // Update status
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { ...f, status: 'processing' as const } : f
        ));

        let result: ExtractedData;

        if (fileItem.file) {
          const formData = new FormData();
          
          if (fileItem.type === 'pdf') {
            formData.append('pdf', fileItem.file);
            const response = await fetch('http://localhost:3001/api/upload-pdf', {
              method: 'POST',
              body: formData,
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to process PDF');
            result = data.data;
          } else {
            formData.append('file', fileItem.file);
            const response = await fetch('http://localhost:3001/api/upload-text-image', {
              method: 'POST',
              body: formData,
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to process file');
            result = data.data;
          }
        } else if (fileItem.text) {
          const response = await fetch('http://localhost:3001/api/upload-text-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: fileItem.text }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Failed to process text');
          result = data.data;
        } else {
          throw new Error('No file or text provided');
        }

        results.push(result);
        
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { ...f, status: 'completed' as const, result } : f
        ));
      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { 
            ...f, 
            status: 'error' as const, 
            error: error instanceof Error ? error.message : 'Processing failed' 
          } : f
        ));
      }
    }

    setIsProcessing(false);
    
    if (results.length > 0) {
      onProcessComplete(results);
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
      addFiles(e.dataTransfer.files);
    }
  };

  const getStatusIcon = (status: FileItem['status']) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'processing': return '🔄';
      case 'completed': return '✅';
      case 'error': return '❌';
    }
  };

  const getFileIcon = (type: FileItem['type']) => {
    switch (type) {
      case 'pdf': return '📄';
      case 'image': return '🖼️';
      case 'text': return '📝';
    }
  };

  return (
    <div className="batch-upload-container">
      <h2>Multi-File Insurance Data Processor</h2>
      
      <div className="upload-section">
        <div
          className={`drop-zone ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,image/*,.txt"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
            style={{ display: 'none' }}
          />
          <div className="drop-zone-content">
            <span className="drop-icon">📁</span>
            <h3>Drop files here or click to browse</h3>
            <p>Supports: PDF, Images (PNG/JPG), Text files, Carjam reports</p>
          </div>
        </div>

        <div className="text-input-section">
          <h3>Or paste text directly</h3>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Paste insurance details, vehicle info, or text messages here..."
            rows={4}
            className="text-input"
          />
          <button 
            onClick={addText} 
            disabled={!textInput.trim()}
            className="add-text-btn"
          >
            Add Text
          </button>
        </div>
      </div>

      {files.length > 0 && (
        <div className="files-list">
          <h3>Files to Process ({files.length})</h3>
          {files.map(file => (
            <div key={file.id} className={`file-item ${file.status}`}>
              <span className="file-icon">{getFileIcon(file.type)}</span>
              <span className="file-name">{file.name}</span>
              <span className="status-icon">{getStatusIcon(file.status)}</span>
              {file.error && <span className="error-text">{file.error}</span>}
              {file.status === 'pending' && !isProcessing && (
                <button 
                  onClick={() => removeFile(file.id)}
                  className="remove-btn"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="actions">
        <button
          onClick={processAllFiles}
          disabled={files.length === 0 || isProcessing}
          className="process-btn"
        >
          {isProcessing ? 'Processing...' : `Process ${files.length} File${files.length !== 1 ? 's' : ''}`}
        </button>
        
        {files.length > 0 && !isProcessing && (
          <button
            onClick={() => setFiles([])}
            className="clear-btn"
          >
            Clear All
          </button>
        )}
      </div>

    </div>
  );
};

export default BatchUpload;