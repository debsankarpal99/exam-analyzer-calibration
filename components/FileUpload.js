import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import ProgressBar from './ProgressBar';

const FileUpload = ({ onFileProcessed, isProcessing }) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState('');

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    setFileName(file.name);
    
    // Simulate upload progress
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + 5;
      });
    }, 100);
    
    try {
      // Pass the file to the parent component
      await onFileProcessed(file);
      setUploadProgress(100);
      
      // Reset progress after a moment
      setTimeout(() => {
        setUploadProgress(0);
      }, 1000);
    } catch (error) {
      console.error('Error processing file:', error);
      clearInterval(interval);
      setUploadProgress(0);
    }
  }, [onFileProcessed]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1
  });

  return (
    <div className="mb-8">
      <div
        {...getRootProps()}
        className={`upload-container ${isDragActive ? 'border-blue-500 bg-blue-50' : ''}`}
      >
        <input {...getInputProps()} />
        {
          isDragActive ?
            <p className="text-lg">Drop the file here...</p> :
            <div>
              <p className="text-lg mb-2">Drag & drop an exam score chart image or PDF file here, or click to select</p>
              <p className="text-sm text-gray-500">Supported formats: JPEG, PNG, PDF</p>
            </div>
        }
      </div>
      
      {fileName && (
        <div className="mt-4">
          <p className="text-sm font-medium">Processing: {fileName}</p>
          <ProgressBar progress={uploadProgress} />
        </div>
      )}
      
      {isProcessing && (
        <div className="mt-4 text-center">
          <p className="text-blue-600 animate-pulse">Analyzing image... This may take a moment</p>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
