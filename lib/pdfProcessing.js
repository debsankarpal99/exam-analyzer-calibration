import * as pdfjs from 'pdfjs-dist';

// Initialize PDF.js worker
const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.entry');
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export const extractImageFromPDF = async (file) => {
  try {
    // Load the PDF document
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    
    // We'll always use page 2 as requested (PDF pages are 1-indexed)
    const pageNum = 2;
    
    // Make sure the PDF has enough pages
    if (pdf.numPages < pageNum) {
      throw new Error(`PDF only has ${pdf.numPages} pages, but page ${pageNum} was requested`);
    }
    
    // Get the requested page
    const page = await pdf.getPage(pageNum);
    
    // Render the page to a canvas at a reasonable scale
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    // Convert the canvas to a data URL
    const dataUrl = canvas.toDataURL('image/png');
    
    // Create an image object from the data URL
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  } catch (error) {
    console.error('Error extracting image from PDF:', error);
    throw error;
  }
};
