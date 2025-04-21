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
    "Corporate Issues",
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
  // Enhanced detection for full height chart
  const yZeroPercent = Math.round(831 * scaleFactorY);
  const yHundredPercent = Math.round(528 * scaleFactorY);
  
  // Also detect the 0% and 100% horizontal lines for better calibration
  const horizontalLines = detectHorizontalLines(data, width, height);
  
  // If we detected clear horizontal lines, use them to recalibrate
  if (horizontalLines.length >= 2) {
    // Sort lines by Y position (top to bottom)
    horizontalLines.sort((a, b) => a.y - b.y);
    
    // Find lines that likely represent the 100% and 0% marks
    // Often these are among the strongest detected lines
    // Look for lines in the upper and lower portions of the chart
    const upperThird = height / 3;
    const lowerThird = height * 2 / 3;
    
    // Find potential 100% line (in upper third)
    const potentialHundredLines = horizontalLines.filter(line => 
      line.y < upperThird && line.strength > 0.6);
    
    // Find potential 0% line (in lower third)
    const potentialZeroLines = horizontalLines.filter(line => 
      line.y > lowerThird && line.strength > 0.6);
    
    // Update calibration if we found good candidates
    if (potentialHundredLines.length > 0) {
      yHundredPercent = potentialHundredLines[0].y;
      console.log("Detected 100% line at y:", yHundredPercent);
    }
    
    if (potentialZeroLines.length > 0) {
      yZeroPercent = potentialZeroLines[0].y;
      console.log("Detected 0% line at y:", yZeroPercent);
    }
  }
  
  // Create enhanced grayscale for better detection
  let grayscale = createGrayscaleArray(data, width, height);
  // Enhance contrast to better identify the score lines
  grayscale = enhanceContrast(grayscale, width, height);
  
  // Function to calculate percentage from y-coordinate with improved handling for 100%
  const yToPercentage = (y) => {
    // Handle exactly at or above 100% line
    if (y <= yHundredPercent) {
      return 100.0;
    } 
    // Handle exactly at or below 0% line
    else if (y >= yZeroPercent) {
      return 0.0;
    } 
    // Handle in-between values
    else {
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
  
  // Also look for 70% and 50% lines which are common in CFA reports
  const y70Percent = Math.round(yHundredPercent + (yZeroPercent - yHundredPercent) * 0.3);
  const y50Percent = Math.round(yHundredPercent + (yZeroPercent - yHundredPercent) * 0.5);
  
  debugCtx.strokeStyle = 'rgba(100, 100, 255, 0.3)';
  debugCtx.beginPath();
  debugCtx.moveTo(0, y70Percent);
  debugCtx.lineTo(width, y70Percent);
  debugCtx.stroke();
  debugCtx.fillText('70%', 20, y70Percent);
  
  debugCtx.beginPath();
  debugCtx.moveTo(0, y50Percent);
  debugCtx.lineTo(width, y50Percent);
  debugCtx.stroke();
  debugCtx.fillText('50%', 20, y50Percent);
  
  // Improved analysis for each topic column
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    const x = xPositions[i];
    
    // Mark column position on debug image
    debugCtx.fillStyle = 'blue';
    debugCtx.fillRect(x, 0, 2, height);
    debugCtx.fillText(topic.substring(0, 10), x, 20);
    
    // Define a wider vertical region of interest
    // Extend the search range to include potentially higher values near 100%
    const roiYStart = Math.max(yHundredPercent - 80, 0); // Start higher to catch 100% scores
    const roiYEnd = Math.min(yZeroPercent + 50, height);
    // Increase ROI width for better detection
    const roiWidth = 40; // Wider region to capture the score bar
    const roiXStart = Math.max(x - roiWidth/2, 0);
    const roiXEnd = Math.min(x + roiWidth/2, width);
    
    // Multi-pass strategy to find the score line
    let bestLineY = null;
    let minIntensity = 255;
    let found100Percent = false;
    
    // Look specifically for 100% score markers first
    // These are often at or slightly above the 100% line
    const hundred100Search = Math.max(yHundredPercent - 30, 0);
    for (let y = hundred100Search; y <= yHundredPercent + 10; y++) {
      // Special detection for markers at 100% (often dots, stars, or line endpoints)
      let markerEvidence = 0;
      
      for (let dx = roiXStart; dx < roiXEnd; dx++) {
        const idx = (y * width + dx) * 4;
        // Look for darker pixels that might be markers
        const r = data[idx];
        const g = data[idx+1];
        const b = data[idx+2];
        const pixelDarkness = 255 - (r + g + b) / 3;
        
        // Give more weight to pixels close to the column center
        const distanceFromCenter = Math.abs(dx - x);
        const weight = 1 - (distanceFromCenter / (roiWidth/2)) * 0.8;
        
        // Accumulate evidence of a marker
        markerEvidence += pixelDarkness * weight / 255;
      }
      
      // If we found strong marker evidence at or near the 100% line
      if (markerEvidence > 5.0) {
        bestLineY = y;
        found100Percent = true;
        console.log(`Found evidence of 100% marker for ${topic} with strength ${markerEvidence}`);
        break;
      }
    }
    
    // If we didn't find a 100% marker, continue with normal detection
    if (!found100Percent) {
      // First pass: Look for the darkest horizontal line in the ROI
      for (let y = roiYStart; y <= roiYEnd; y++) {
        // Skip areas very close to gridlines (5px tolerance)
        if (Math.abs(y - yHundredPercent) < 5 || Math.abs(y - yZeroPercent) < 5 ||
            Math.abs(y - y70Percent) < 5 || Math.abs(y - y50Percent) < 5) {
          continue;
        }
        
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
    }
    
    // Calculate and store score if we found a suitable position
    if (bestLineY !== null) {
      const percentage = yToPercentage(bestLineY);
      scores[topic] = Math.round(percentage * 10) / 10; // Round to 1 decimal place
      
      // Mark detected point on debug image
      debugCtx.fillStyle = found100Percent ? 'purple' : 'red';
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

// New function to detect horizontal lines in the image
function detectHorizontalLines(imageData, width, height) {
  const data = imageData.data;
  const lines = [];
  
  // For each row, calculate its "line score"
  for (let y = 0; y < height; y++) {
    let lineScore = 0;
    let previousIntensity = -1;
    let transitions = 0;
    
    // Sample points along this row
    const samplePoints = 50;
    const step = Math.max(1, Math.floor(width / samplePoints));
    
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const intensity = (data[idx] + data[idx+1] + data[idx+2]) / 3;
      
      // Look for intensity transitions which might indicate a line
      if (previousIntensity >= 0) {
        const delta = Math.abs(intensity - previousIntensity);
        if (delta > 20) {
          transitions++;
        }
      }
      
      previousIntensity = intensity;
    }
    
    // Calculate a line score based on horizontal consistency
    const normalizedScore = transitions / (width / step);
    
    // Save strong horizontal line candidates
    if (normalizedScore > 0.1) {
      lines.push({
        y: y,
        strength: normalizedScore
      });
    }
  }
  
  // Sort lines by strength
  lines.sort((a, b) => b.strength - a.strength);
  
  // Return the strongest lines
  return lines.slice(0, 10);
}

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
