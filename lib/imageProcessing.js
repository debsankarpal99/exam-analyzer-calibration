export const analyzeExamScore = async (imageElement) => {
  // Preprocess the image to ensure consistent dimensions for reliable analysis
  const preprocessedImage = await preprocessImage(imageElement);
  
  // Setup canvas with preprocessed image
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = preprocessedImage.width;
  canvas.height = preprocessedImage.height;
  ctx.drawImage(preprocessedImage, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  // Define topics
  const topics = [
    "Ethical and Professional Standards",
    "Quantitative Methods",
    "Economics",
    "Financial Statement Analysis",
    "Corporate Issuers",
    "Equity Investments",
    "Fixed Income",
    "Derivatives",
    "Alternative Investments",
    "Portfolio Management"
  ];

  // Calculate scaling factors
  const baseWidth = 3000;
  const scaleFactorX = width / baseWidth;
  
  // X positions for each topic column
  const xPositions = [
    434, 674, 914, 1154, 1394, 1634, 1874, 2114, 2354, 2594
  ].map(x => Math.round(x * scaleFactorX));
  
  // Y positions for gridlines
  const baseHeight = 2000;
  const scaleFactorY = height / baseHeight;
  
  // Calibration for gridlines with tolerance for detection
  const yZeroPercent = Math.round(831 * scaleFactorY);
  const yHundredPercent = Math.round(526 * scaleFactorY);
  
  // Create enhanced grayscale for better detection
  let grayscale = createGrayscaleArray(data, width, height);
  // Enhance contrast to better identify the score lines
  grayscale = enhanceContrast(grayscale, width, height);
  
  // Function to calculate percentage from y-coordinate
  const yToPercentage = (y) => {
    // Add tolerance to avoid interference with gridlines
    if (y <= yHundredPercent - 5) {
      return 100.0;
    } else if (y >= yZeroPercent + 5) {
      return 0.0;
    } else {
      return 100 - ((y - yHundredPercent) / (yZeroPercent - yHundredPercent) * 100);
    }
  };
  
  // Extract scores
  const scores = {};
  const debugPoints = [];
  
  // Setup debug canvas
  const debugCanvas = document.createElement('canvas');
  const debugCtx = debugCanvas.getContext('2d');
  debugCanvas.width = width;
  debugCanvas.height = height;
  debugCtx.drawImage(preprocessedImage, 0, 0);
  debugCtx.font = '16px Arial'
  
  // Draw reference gridlines
  debugCtx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
  debugCtx.lineWidth = 2;
  
  // Draw 100% and 0% reference lines
  debugCtx.beginPath();
  debugCtx.moveTo(0, yHundredPercent);
  debugCtx.lineTo(width, yHundredPercent);
  debugCtx.stroke();
  debugCtx.fillStyle = 'green';
  debugCtx.fillText('100%', 20, yHundredPercent);
  
  debugCtx.beginPath();
  debugCtx.moveTo(0, yZeroPercent);
  debugCtx.lineTo(width, yZeroPercent);
  debugCtx.stroke();
  debugCtx.fillText('0%', 20, yZeroPercent);
  
  // Improved analysis for each topic column
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    const x = xPositions[i];
    
    // Mark column position on debug image
    debugCtx.fillStyle = 'blue';
    debugCtx.fillRect(x, 0, 2, height);
    debugCtx.fillText(topic.substring(0, 10), x, 20);
    
    // Define a wider vertical region of interest
    const roiYStart = Math.max(yHundredPercent - 50, 0); // Expanded search range
    const roiYEnd = Math.min(yZeroPercent + 50, height);
    // Increase ROI width for better detection
    const roiWidth = 40; // Wider region to capture the score bar
    const roiXStart = Math.max(x - roiWidth/2, 0);
    const roiXEnd = Math.min(x + roiWidth/2, width);
    
    // Multi-pass strategy to find the score line
    let bestLineY = null;
    let minIntensity = 255;
    
    // First pass: Look for the darkest horizontal line in the ROI
    for (let y = roiYStart; y <= roiYEnd; y++) {
     
      
      // Calculate average intensity with greater weight on center pixels
      let totalIntensity = 0;
      let pixelCount = 0;
      
      for (let dx = roiXStart; dx < roiXEnd; dx++) {
        const grayValue = grayscale[y * width + dx];
        // Weight pixels closer to center more heavily
        const distanceFromCenter = Math.abs(dx - x);
        const weight = 1 - (distanceFromCenter / (roiWidth/2)) * 0.5;
        totalIntensity += grayValue * weight;
        pixelCount += weight;
      }
      
      const avgIntensity = totalIntensity / pixelCount;
      
      // Find the darkest line
      if (avgIntensity < minIntensity) {
        minIntensity = avgIntensity;
        bestLineY = y;
      }
    }
    
    // Second pass: If first pass didn't find a strong signal, look for red markers
    // which often indicate score positions in these charts
    if (minIntensity > 150) { // Threshold to identify if detection likely failed
      // Look for red markers which could indicate score positions
      let bestRedY = null;
      let maxRedScore = 0;
      
      for (let y = roiYStart; y <= roiYEnd; y++) {
        let redScore = 0;
        
        for (let dx = roiXStart; dx < roiXEnd; dx++) {
          const idx = (y * width + dx) * 4;
          // Calculate "redness" - how much red dominates over other colors
          const r = data[idx];
          const g = data[idx+1];
          const b = data[idx+2];
          
          // Red detection formula - red must be high, other channels lower
          if (r > 100 && r > g*1.5 && r > b*1.5) {
            // Weight by how "red" the pixel is
            redScore += (r - Math.max(g, b))/255;
          }
        }
        
        // Keep track of the y-position with the highest red score
        if (redScore > maxRedScore) {
          maxRedScore = redScore;
          bestRedY = y;
        }
      }
      
      // If we found a significant red feature, use it instead
      if (bestRedY !== null && maxRedScore > 3.0) {
        bestLineY = bestRedY;
      }
    }
    
    // Third pass: Use edge detection to find horizontal lines
    // This helps when the score line is thin but distinct
    if (minIntensity > 150 && !bestLineY) {
      let bestEdgeY = null;
      let maxEdgeStrength = 0;
      
      // Simple horizontal Sobel-like edge detector
      for (let y = roiYStart + 1; y < roiYEnd - 1; y++) {
        let edgeStrength = 0;
        
        for (let dx = roiXStart; dx < roiXEnd; dx++) {
          // Calculate vertical gradient (difference between pixels above and below)
          const above = grayscale[(y-1) * width + dx];
          const below = grayscale[(y+1) * width + dx];
          const gradient = Math.abs(above - below);
          edgeStrength += gradient;
        }
        
        // Normalize by width of ROI
        edgeStrength /= (roiXEnd - roiXStart);
        
        if (edgeStrength > maxEdgeStrength) {
          maxEdgeStrength = edgeStrength;
          bestEdgeY = y;
        }
      }
      
      // If we found a strong edge, use it
      if (bestEdgeY !== null && maxEdgeStrength > 15) {
        bestLineY = bestEdgeY;
      }
    }
    
    // Calculate and store score if we found a suitable position
    if (bestLineY !== null) {
      const percentage = yToPercentage(bestLineY);
      scores[topic] = Math.round(percentage * 10) / 10; // Round to 1 decimal place
      
      // Mark detected point on debug image
      debugCtx.fillStyle = 'red';
      debugCtx.beginPath();
      debugCtx.arc(x, bestLineY, 5, 0, 2 * Math.PI);
      debugCtx.fill();
      debugCtx.fillStyle = 'black';
      debugCtx.fillText(`${percentage.toFixed(1)}%`, x + 10, bestLineY);
      
      debugPoints.push({ x, y: bestLineY, score: percentage });
    } else {
      console.log(`Could not detect score line for ${topic}`);
      scores[topic] = null; // No fallback, return null for missing data
    }
  }
  
  // Save debug image
  const debugImageUrl = debugCanvas.toDataURL('image/png');
  
  return { scores, debugImageUrl };
};

// New function to preprocess and resize the image to optimal dimensions
async function preprocessImage(imageElement) {
  // Target dimensions that work well (using 2550×1650 as it's more efficient)
  const targetWidth = 2550;
  const targetHeight = 1650;
  
  // Create a temporary canvas for resizing
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  
  // Set the canvas to the target dimensions
  tempCanvas.width = targetWidth;
  tempCanvas.height = targetHeight;
  
  // Use better quality interpolation for resizing
  tempCtx.imageSmoothingEnabled = true;
  tempCtx.imageSmoothingQuality = 'high';
  
  // Draw the original image scaled to target dimensions
  tempCtx.drawImage(imageElement, 0, 0, targetWidth, targetHeight);
  
  // Create a new image with the resized dimensions
  return new Promise((resolve) => {
    const resizedImage = new Image();
    resizedImage.onload = () => resolve(resizedImage);
    resizedImage.src = tempCanvas.toDataURL('image/png');
  });
}

// Enhanced grayscale function with better handling of color information
function createGrayscaleArray(data, width, height) {
  const grayscale = new Uint8Array(width * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Improved grayscale formula that better preserves line features
      grayscale[y * width + x] = Math.round(
        0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
      );
    }
  }
  
  return grayscale;
}

// Enhanced contrast function with adaptive local contrast enhancement
function enhanceContrast(grayscale, width, height) {
  // Find min and max values
  let min = 255;
  let max = 0;
  
  for (let i = 0; i < grayscale.length; i++) {
    if (grayscale[i] < min) min = grayscale[i];
    if (grayscale[i] > max) max = grayscale[i];
  }
  
  // Apply contrast enhancement with gamma correction
  const range = max - min;
  if (range === 0) return grayscale;
  
  const enhanced = new Uint8Array(grayscale.length);
  const gamma = 0.7; // Slightly stronger gamma correction for better visibility
  
  for (let i = 0; i < grayscale.length; i++) {
    // Normalize, apply gamma, then scale back to 0-255
    const normalized = (grayscale[i] - min) / range;
    enhanced[i] = Math.round(Math.pow(normalized, gamma) * 255);
  }
  
  // Optional: Apply local contrast enhancement for areas with low contrast
  const windowSize = 15;
  const localEnhanced = adaptiveThreshold(enhanced, width, height, windowSize, 5);
  
  // Blend original enhanced with adaptive threshold result
  for (let i = 0; i < enhanced.length; i++) {
    // Only enhance dark features to preserve potential line markers
    if (enhanced[i] < 128) {
      enhanced[i] = Math.min(enhanced[i], localEnhanced[i]);
    }
  }
  
  return enhanced;
}

// Improved adaptive threshold function
function adaptiveThreshold(grayscale, width, height, windowSize = 15, C = 5) {
  const result = new Uint8Array(grayscale.length);
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Compute local mean with integral image approach for efficiency
      let sum = 0;
      let count = 0;
      
      // Use a smaller window for efficiency
      for (let wy = Math.max(0, y - halfWindow); wy <= Math.min(height - 1, y + halfWindow); wy++) {
        for (let wx = Math.max(0, x - halfWindow); wx <= Math.min(width - 1, x + halfWindow); wx++) {
          sum += grayscale[wy * width + wx];
          count++;
        }
      }
      
      const mean = sum / count;
      const pixel = grayscale[y * width + x];
      
      // Apply threshold: if pixel is C units less than local mean, it's foreground
      result[y * width + x] = pixel < mean - C ? 0 : 255;
    }
  }
  
  return result;
}
