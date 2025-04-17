import React, { useState, useRef } from 'react';
import Head from 'next/head';
import FileUpload from '../components/FileUpload';
import ResultTable from '../components/ResultTable';
import ScoreChart from '../components/ScoreChart';
import { extractImageFromPDF } from '../lib/pdfProcessing';
import { analyzeExamScore } from '../lib/imageProcessing';

export default function Home() {
  const [scores, setScores] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImage, setProcessedImage] = useState(null);
  
  const handleFileProcessed = async (file) => {
    try {
      setIsProcessing(true);
      setError(null);
      setScores(null);
      
      let imageElement;
      
      // Handle different file types
      if (file.type === 'application/pdf') {
        // Extract image from PDF (always page 2)
        imageElement = await extractImageFromPDF(file);
      } else if (file.type.startsWith('image/')) {
        // Create an image element from the file
        const fileUrl = URL.createObjectURL(file);
        imageElement = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = fileUrl;
        });
      } else {
        throw new Error('Unsupported file type');
      }
      
      // Save the processed image to display
      setProcessedImage(imageElement.src);
      
      // Analyze the exam score
      const scoreResults = await analyzeExamScore(imageElement);
      setScores(scoreResults);
    } catch (err) {
      console.error('Error processing file:', err);
      setError(err.message || 'Failed to process the file');
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="container">
      <Head>
        <title>Exam Score Analyzer</title>
        <meta name="description" content="Analyze exam score charts from images or PDFs" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <h1 className="text-3xl font-bold mb-4">Exam Score Chart Analyzer</h1>
        <p className="mb-8">Upload an exam score chart image or PDF to analyze the scores by topic.</p>
        
        <FileUpload 
          onFileProcessed={handleFileProcessed}
          isProcessing={isProcessing}
        />
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong>Error: </strong> {error}
          </div>
        )}
        
        {processedImage && (
          <div className="mt-6">
            <h2 className="text-xl font-bold mb-2">Processed Image</h2>
            <div className="border rounded overflow-hidden">
              <img 
                src={processedImage} 
                alt="Processed exam chart"
                className="max-w-full"
              />
            </div>
          </div>
        )}
        
        {scores && (
          <>
            <ScoreChart scores={scores} />
            <ResultTable scores={scores} />
          </>
        )}
      </main>

      <footer className="mt-12 pt-4 border-t text-center text-gray-500">
        <p>Exam Score Analyzer &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
