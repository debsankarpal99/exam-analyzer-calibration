// /components/FileUpload.js
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
    const pageCount = pdf.numPages;
    const pageNum = pageCount >= 2 ? 2 : 1;
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport: viewport }).promise;
    
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        if (!validateImageDimensions(image)) {
          reject(new Error(`PDF page dimensions don't match any acceptable sizes. Your PDF page is ${image.width}×${image.height} pixels. Acceptable dimensions (with ${TOLERANCE_PERCENT}% tolerance): ${getAcceptableDimensionsText()}`));
          return;
        }
        resolve(canvas.toDataURL('image/png'));
      };
      image.onerror = reject;
      image.src = canvas.toDataURL('image/png');
    });
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    setFileName(file.name);
    setDimensionError(null);
    
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 95) { clearInterval(interval); return 95; }
        return prev + 5;
      });
    }, 100);
    
    try {
      let processedFile = file;
      
      if (file.type === 'application/pdf') {
        const pdfImageData = await processPdf(file);
        const base64Response = await fetch(pdfImageData);
        const blob = await base64Response.blob();
        processedFile = new File([blob], file.name.replace('.pdf', '.png'), { type: 'image/png' });
      } else if (file.type.startsWith('image/')) {
        const fileUrl = URL.createObjectURL(file);
        const img = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => { URL.revokeObjectURL(fileUrl); resolve(image); };
          image.onerror = (err) => { URL.revokeObjectURL(fileUrl); reject(err); };
          image.src = fileUrl;
        });
        if (!validateImageDimensions(img)) {
          throw new Error(`Image dimensions don't match any acceptable sizes. Your image is ${img.width}×${img.height} pixels. Acceptable dimensions (with ${TOLERANCE_PERCENT}% tolerance): ${getAcceptableDimensionsText()}`);
        }
      } else {
        throw new Error(`Unsupported file type: ${file.type}. Please upload JPEG, PNG, or PDF.`);
      }
      
      await onFileProcessed(processedFile);
      setUploadProgress(100);
      setTimeout(() => { setUploadProgress(0); setFileName(''); }, 1000);
    } catch (error) {
      console.error('Error processing file:', error);
      setDimensionError(error.message || 'An unknown error occurred during file processing.');
      clearInterval(interval);
      setUploadProgress(0);
    }
  }, [onFileProcessed]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'], 'application/pdf': ['.pdf'] },
    maxFiles: 1
  });

  return (
    <div className="mb-8">
      {/* Warning note */}
      <div className="mb-4 p-4 border-2 border-red-600 bg-red-50 rounded-md">
        <h4 className="text-red-600 font-bold mb-1">Important File Preparation Note:</h4>
        <p className="text-red-600">
          It is recommended to either upload the original PDF containing the result or convert your PDF to images (JPG/JPEG/PNG) and upload. 
          Avoid taking screenshots as they will not match the required image dimensions.
        </p>
      </div>
      
      <div
        {...getRootProps()}
        className={`upload-container border-2 p-6 rounded-lg text-center cursor-pointer ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 border-dashed hover:border-blue-400'}`}
      >
        <input {...getInputProps()} />
        { /* Dropzone content */ }
         {
          isDragActive ?
            <p className="text-lg text-blue-600 font-medium">Drop the file here...</p> :
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
      
      {dimensionError && ( /* Error display */ )}
       {dimensionError && (
        <div className="mt-2 text-red-600">
          <p>{dimensionError}</p>
          <p className="text-sm mt-1">Please upload a valid file with appropriate dimensions.</p>
        </div>
      )}
      
      {fileName && !dimensionError && uploadProgress > 0 && ( /* Progress bar */ )}
       {fileName && !dimensionError && uploadProgress > 0 && ( // Show progress only when actually uploading/processing
        <div className="mt-4">
          <p className="text-sm font-medium">Processing: {fileName}</p>
          <ProgressBar progress={uploadProgress} />
        </div>
      )}
      
      {isProcessing && (
        // Modal Overlay
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="text-center w-full max-w-md"> 
            {/* --- START: Updated Horizontal Animation --- */}
            <div className="flex flex-col items-center justify-center">
              
              {/* Analyzing Text with Shimmer Effect */}
              <div className="analyzing-text-container mb-3"> {/* Wrapper needed for effect */}
                  Analyzing
                  <span className="analyzing-dots-simple"></span> {/* Simple dots */}
              </div>
              
              {/* Optional: Add a subtle bar below */}
              <div className="w-3/4 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="scan-bar-inner h-full rounded-full"></div>
              </div>

              {/* Subtext (optional, can be removed if too cluttered) */}
              <p className="text-white/80 text-sm mt-4">
                Extracting score data...
              </p>
            </div>
             {/* --- END: Updated Horizontal Animation --- */}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
