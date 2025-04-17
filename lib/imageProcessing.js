export const analyzeExamScore = async (imageElement) => {
  // Create a canvas to draw the image
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Set canvas dimensions to match the image
  canvas.width = imageElement.width;
  canvas.height = imageElement.height;
  
  // Draw the image on the canvas
  ctx.drawImage(imageElement, 0, 0);
  
  // Get the image data for processing
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  // Define the topics in order (left to right as they appear in the chart)
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

  // CALIBRATION: Define the x-coordinates for each topic's score line
  // These are approximate horizontal positions for each topic column in the image
  // Note: These will need to be adjusted based on actual image dimensions
  const baseWidth = 3000; // Base width used for calibration
  const scaleFactorX = width / baseWidth;
  
  const xPositions = [
    434, 674, 1050, 1280, 1570, 1870, 2100, 2410, 2667, 2950
  ].map(x => Math.round(x * scaleFactorX));
  
  // CALIBRATION: Define Y positions for 0% and 100% gridlines
  // These values are from the Python code, adjusted for image scaling
  const baseHeight = 1200; // Base height used for calibration
  const scaleFactorY = height / baseHeight;
  
  // HARDCODED VALUES for 0% and 100% points (adjusted for scaling)
  const yZeroPercent = Math.round(1111 * scaleFactorY); // 0% gridline y-coordinate
  const yHundredPercent = Math.round(780 * scaleFactorY); // 100% gridline y-coordinate
  
  // Create a grayscale version of the image for processing
  const grayscale = createGrayscaleArray(data, width, height);
  
  // Function to calculate percentage based on y-coordinate
  const yToPercentage = (y) => {
    if (y <= yHundredPercent) {
      return 100.0;
    } else if (y >= yZeroPercent) {
      return 0.0;
    } else {
      return 100 - ((y - yHundredPercent) / (yZeroPercent - yHundredPercent) * 100);
    }
  };
  
  // Extract scores
  const scores = {};
  const debugPoints = [];
  
  // Draw reference calibration lines
  const debugCanvas = document.createElement('canvas');
  const debugCtx = debugCanvas.getContext('2d');
  debugCanvas.width = width;
  debugCanvas.height = height;
  debugCtx.drawImage(imageElement, 0, 0);
  
  // Draw horizontal reference lines
  debugCtx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
  debugCtx.lineWidth = 2;
  
  // 100% line
  debugCtx.beginPath();
  debugCtx.moveTo(0, yHundredPercent);
  debugCtx.lineTo(width, yHundredPercent);
  debugCtx.stroke();
  debugCtx.fillStyle = 'green';
  debugCtx.fillText('100%', 20, yHundredPercent);
  
  // 0% line
  debugCtx.beginPath();
  debugCtx.moveTo(0, yZeroPercent);
  debugCtx.lineTo(width, yZeroPercent);
  debugCtx.stroke();
  debugCtx.fillText('0%', 20, yZeroPercent);
  
  // For each topic, find the score line
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    const x = xPositions[i];
    
    // Mark the x position
    debugCtx.fillStyle = 'blue';
    debugCtx.fillRect(x, 0, 2, height);
    debugCtx.fillText(topic.substring(0, 10), x, 20);
    
    // Define a vertical ROI for this column
    const roiYStart = Math.max(yHundredPercent - 30, 0);
    const roiYEnd = Math.min(yZeroPercent + 30, height);
    const roiWidth = 30; // Width of the region to analyze around the x position
    const roiXStart = Math.max(x - roiWidth/2, 0);
    const roiXEnd = Math.min(x + roiWidth/2, width);
    
    // Find the darkest horizontal line in this region
    let bestLineY = null;
    let minIntensity = 255;
    
    for (let y = roiYStart; y <= roiYEnd; y++) {
      // Calculate average intensity of horizontal line at this y position
      let totalIntensity = 0;
      let pixelCount = 0;
      
      for (let dx = roiXStart; dx < roiXEnd; dx++) {
        const grayValue = grayscale[y * width + dx];
        totalIntensity += grayValue;
        pixelCount++;
      }
      
      const avgIntensity = totalIntensity / pixelCount;
      
      // Find the darkest line (which should be the score marker)
      if (avgIntensity < minIntensity) {
        minIntensity = avgIntensity;
        bestLineY = y;
      }
    }
    
    // If we found a suitable line
    if (bestLineY !== null) {
      // Calculate the percentage for this topic
      const percentage = yToPercentage(bestLineY);
      scores[topic] = Math.round(percentage * 10) / 10; // Round to 1 decimal place
      
      // Mark the detected point on the debug image
      debugCtx.fillStyle = 'red';
      debugCtx.beginPath();
      debugCtx.arc(x, bestLineY, 5, 0, 2 * Math.PI);
      debugCtx.fill();
      debugCtx.fillStyle = 'black';
      debugCtx.fillText(`${percentage.toFixed(1)}%`, x + 10, bestLineY);
      
      debugPoints.push({ x, y: bestLineY, score: percentage });
    } else {
      console.log(`Could not detect score line for ${topic}`);
      scores[topic] = null;
    }
  }
  
  // Save the debug image to display in the UI
  const debugImageUrl = debugCanvas.toDataURL('image/png');
  
  return { scores, debugImageUrl };
};

// Helper function to create a grayscale array from RGBA data
function createGrayscaleArray(data, width, height) {
  const grayscale = new Uint8Array(width * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Convert RGB to grayscale using common formula
      grayscale[y * width + x] = Math.round(
        0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
      );
    }
  }
  
  return grayscale;
}

// Additional function to enhance contrast if needed
function enhanceContrast(grayscale, width, height) {
  // Find min and max values
  let min = 255;
  let max = 0;
  
  for (let i = 0; i < grayscale.length; i++) {
    if (grayscale[i] < min) min = grayscale[i];
    if (grayscale[i] > max) max = grayscale[i];
  }
  
  // Normalize to full range
  const range = max - min;
  if (range === 0) return grayscale; // Avoid division by zero
  
  const enhanced = new Uint8Array(grayscale.length);
  for (let i = 0; i < grayscale.length; i++) {
    enhanced[i] = Math.round(((grayscale[i] - min) / range) * 255);
  }
  
  return enhanced;
}

// Adaptive threshold function to help detect lines
function adaptiveThreshold(grayscale, width, height, windowSize = 15, C = 5) {
  const result = new Uint8Array(grayscale.length);
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Compute local mean
      let sum = 0;
      let count = 0;
      
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
