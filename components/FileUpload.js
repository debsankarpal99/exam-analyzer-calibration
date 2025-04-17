import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import ProgressBar from './ProgressBar';

const REQUIRED_WIDTH = 5100;
const REQUIRED_HEIGHT = 3300;
const TOLERANCE_PERCENT = 5; // 5% tolerance

const FileUpload = ({ onFileProcessed, isProcessing }) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [dimensionError, setDimensionError] = useState(null);

  const validateImageDimensions = (img) => {
    const tolerance = TOLERANCE_PERCENT / 100;
    const minWidth = REQUIRED_WIDTH * (1 - tolerance);
    const maxWidth = REQUIRED_WIDTH * (1 + tolerance);
    const minHeight = REQUIRED_HEIGHT * (1 - tolerance);
    const maxHeight = REQUIRED_HEIGHT * (1 + tolerance);
    
    if (img.width < minWidth || img.width > maxWidth || 
        img.height < minHeight || img.height > maxHeight) {
      return false;
    }
    return true;
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    setFileName(file.name);
    setDimensionError(null);
    
    // Start progress animation
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
      // Check dimensions before processing
      if (file.type.startsWith('image/')) {
        const fileUrl = URL.createObjectURL(file);
        const img = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = fileUrl;
        });
        
        if (!validateImageDimensions(img)) {
          throw new Error(`Image dimensions must be approximately ${REQUIRED_WIDTH}×${REQUIRED_HEIGHT} pixels. Your image is ${img.width}×${img.height} pixels.`);
        }
      }
      
      // Process the file if dimensions are valid
      await onFileProcessed(file);
      setUploadProgress(100);
      
      // Reset progress after a moment
      setTimeout(() => {
        setUploadProgress(0);
      }, 1000);
    } catch (error) {
      console.error('Error processing file:', error);
      setDimensionError(error.message);
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
              <p className="text-sm font-medium text-blue-600 mt-2">
                Important: Images must be approximately {REQUIRED_WIDTH}×{REQUIRED_HEIGHT} pixels for accurate analysis
              </p>
            </div>
        }
      </div>
      
      {dimensionError && (
        <div className="mt-2 text-red-600">
          <p>{dimensionError}</p>
          <p className="text-sm mt-1">Please upload the full PDF or a high-resolution image of the correct dimensions.</p>
        </div>
      )}
      
      {fileName && !dimensionError && (
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
