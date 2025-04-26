import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import * as pdfjsLib from 'pdfjs-dist';
import ProgressBar from './ProgressBar';

// Ensure PDF.js worker is configured
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Base dimension requirements
const BASE_WIDTH = 5100;
const BASE_HEIGHT = 3300;
const TOLERANCE_PERCENT = 5; // 5% tolerance

// Acceptable scale factors (1 = original size, 0.5 = half size, etc.)
const ACCEPTABLE_SCALE_FACTORS = [0.25, 0.5, 1, 1.5, 2];

const FileUpload = ({ onFileProcessed, isProcessing }) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [dimensionError, setDimensionError] = useState(null);

  const validateImageDimensions = (img) => {
    const tolerance = TOLERANCE_PERCENT / 100;
    
    // Check if dimensions match any of the acceptable scaled dimensions
    return ACCEPTABLE_SCALE_FACTORS.some(scale => {
      const targetWidth = BASE_WIDTH * scale;
      const targetHeight = BASE_HEIGHT * scale;
      
      const minWidth = targetWidth * (1 - tolerance);
      const maxWidth = targetWidth * (1 + tolerance);
      const minHeight = targetHeight * (1 - tolerance);
      const maxHeight = targetHeight * (1 + tolerance);
      
      return (img.width >= minWidth && img.width <= maxWidth && 
              img.height >= minHeight && img.height <= maxHeight);
    });
  };

  const getAcceptableDimensionsText = () => {
    return ACCEPTABLE_SCALE_FACTORS.map(scale => {
      return `${Math.round(BASE_WIDTH * scale)}×${Math.round(BASE_HEIGHT * scale)}`;
    }).join(', ');
  };

  const processPdf = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    // Get the page count
    const pageCount = pdf.numPages;
    
    // Choose which page to render (2nd page if available, otherwise 1st)
    const pageNum = pageCount >= 2 ? 2 : 1;
    
    // Get the page
    const page = await pdf.getPage(pageNum);
    
    // Get viewport at a scale of 1
    const viewport = page.getViewport({ scale: 1 });
    
    // Create a canvas to render the page
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // Render the PDF page
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    // Convert canvas to image
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        // Check dimensions
        if (!validateImageDimensions(image)) {
          reject(new Error(`PDF page dimensions don't match any acceptable sizes. Your PDF page is ${image.width}×${image.height} pixels. Acceptable dimensions (with ${TOLERANCE_PERCENT}% tolerance): ${getAcceptableDimensionsText()}`));
          return;
        }
        resolve(canvas.toDataURL('image/png'));
      };
      image.src = canvas.toDataURL('image/png');
    });
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
      let processedFile = file;
      
      // Handle different file types
      if (file.type === 'application/pdf') {
        // For PDFs, extract the second page (if available) or first page
        const pdfImageData = await processPdf(file);
        
        // Convert data URL to file
        const base64Response = await fetch(pdfImageData);
        const blob = await base64Response.blob();
        processedFile = new File([blob], file.name.replace('.pdf', '.png'), { type: 'image/png' });
        
      } else if (file.type.startsWith('image/')) {
        // For images, validate dimensions
        const fileUrl = URL.createObjectURL(file);
        const img = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = fileUrl;
        });
        
        if (!validateImageDimensions(img)) {
          throw new Error(`Image dimensions don't match any acceptable sizes. Your image is ${img.width}×${img.height} pixels. Acceptable dimensions (with ${TOLERANCE_PERCENT}% tolerance): ${getAcceptableDimensionsText()}`);
        }
      }
      
      // Process the file if dimensions are valid
      await onFileProcessed(processedFile);
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
      {/* Warning note with explicit Tailwind text-red-600 class */}
      <div className="mb-4 p-4 border-2 border-red-600 bg-red-50 rounded-md">
        <h4 className="text-red-600 font-bold mb-1">Important File Preparation Note:</h4>
        <p className="text-red-600">
          It is recommended to either upload the original PDF containing the result or convert your PDF to images (JPG/JPEG/PNG) and upload. 
          Avoid taking screenshots as they will not match the required image dimensions.
        </p>
      </div>
      
      <div
        {...getRootProps()}
        className={`upload-container border-2 p-6 rounded-lg text-center ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 border-dashed'}`}
      >
        <input {...getInputProps()} />
        {
          isDragActive ?
            <p className="text-lg">Drop the file here...</p> :
            <div>
              <p className="text-lg mb-2">Drag & drop an exam score chart image or PDF file here, or click to select</p>
              <p className="text-sm text-gray-500">Supported formats: JPEG, PNG, PDF</p>
              <p className="text-sm font-medium text-blue-600 mt-2">
                Important: Images must be one of these approximate dimensions: {getAcceptableDimensionsText()} pixels
              </p>
              <p className="text-sm text-gray-500 mt-1">
                For multi-page PDFs, the second page will be automatically selected
              </p>
            </div>
        }
      </div>
      
      {dimensionError && (
        <div className="mt-2 text-red-600">
          <p>{dimensionError}</p>
          <p className="text-sm mt-1">Please upload a full PDF or image with dimensions matching one of the acceptable sizes.</p>
        </div>
      )}
      
      {fileName && !dimensionError && (
        <div className="mt-4">
          <p className="text-sm font-medium">Processing: {fileName}</p>
          <ProgressBar progress={uploadProgress} />
        </div>
      )}
      
     {isProcessing && (
  <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
    <div className="text-center p-8 rounded-lg w-full max-w-lg">
      <div className="analyzing-container">
        <div className="analyzing-wave">
          <span data-text="A">A</span>
          <span data-text="N">N</span>
          <span data-text="A">A</span>
          <span data-text="L">L</span>
          <span data-text="Y">Y</span>
          <span data-text="Z">Z</span>
          <span data-text="I">I</span>
          <span data-text="N">N</span>
          <span data-text="G">G</span>
          <span className="analyzing-dots">
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </span>
        </div>
        <div className="analyzing-pulse"></div>
      </div>
      <p className="text-white text-opacity-80 mt-4">Extracting score data from your exam...</p>
    </div>
  </div>
)}
    </div>
  );
};

export default FileUpload;
