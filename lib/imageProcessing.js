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
  
  // Define the topics in order based on the chart
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

  // Create a grayscale version of the image for processing
  const grayscale = createGrayscaleArray(data, width, height);
  
  // Apply edge detection for better line detection
  const edges = detectEdges(grayscale, width, height);
  
  // Create debug canvas
  const debugCanvas = document.createElement('canvas');
  const debugCtx = debugCanvas.getContext('2d');
  debugCanvas.width = width;
  debugCanvas.height = height;
  debugCtx.drawImage(imageElement, 0, 0);
  
  // Step 1: Auto-detect the chart grid area
  const gridArea = detectChartGrid(edges, width, height, debugCtx);
  
  if (!gridArea) {
    throw new Error("Could not detect chart grid. Please upload a clearer image.");
  }
  
  // Draw detected grid boundaries
  debugCtx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
  debugCtx.lineWidth = 3;
  debugCtx.strokeRect(gridArea.left, gridArea.top, gridArea.width, gridArea.height);
  debugCtx.fillStyle = 'red';
  debugCtx.fillText('Detected Chart Area', gridArea.left + 10, gridArea.top - 10);
  
  // Step 2: Detect the 50% and 70% reference lines
  const referenceLines = detectReferenceLines(edges, grayscale, width, height, gridArea);
  
  // Extract the 50% and 70% lines
  const line50Percent = referenceLines.find(line => line.percentage === 50);
  const line70Percent = referenceLines.find(line => line.percentage === 70);
  
  // Extrapolate 0% and 100% positions based on the 50% and 70% lines
  let yZeroPercent, yHundredPercent;
  
  if (line50Percent && line70Percent) {
    // Calculate pixels per percent
    const pixelsPerPercent = (line50Percent.y - line70Percent.y) / 20; // 20 = difference between 70% and 50%
    
    // Extrapolate 0% and 100% positions
    yZeroPercent = Math.round(line50Percent.y + pixelsPerPercent * 50); // 50% + 50 more percent to reach 0%
    yHundredPercent = Math.round(line70Percent.y - pixelsPerPercent * 30); // 70% + 30 more percent to reach 100%
  } else {
    // Fallback if reference lines aren't detected
    yZeroPercent = gridArea.top + gridArea.height;
    yHundredPercent = gridArea.top;
    
    // Try to detect other horizontal lines as fallback
    const horizontalLines = detectHorizontalGridlines(edges, width, height, gridArea);
    if (horizontalLines.length >= 2) {
      horizontalLines.sort((a, b) => a.y - b.y);
      yHundredPercent = horizontalLines[0].y;
      yZeroPercent = horizontalLines[horizontalLines.length - 1].y;
    }
  }
  
  // Draw horizontal reference lines
  debugCtx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
  debugCtx.lineWidth = 2;
  
  // 100% line (extrapolated)
  debugCtx.beginPath();
  debugCtx.moveTo(gridArea.left, yHundredPercent);
  debugCtx.lineTo(gridArea.left + gridArea.width, yHundredPercent);
  debugCtx.stroke();
  debugCtx.fillStyle = 'green';
  debugCtx.fillText('100% (extrapolated)', gridArea.left - 120, yHundredPercent);
  
  // 0% line (extrapolated)
  debugCtx.beginPath();
  debugCtx.moveTo(gridArea.left, yZeroPercent);
  debugCtx.lineTo(gridArea.left + gridArea.width, yZeroPercent);
  debugCtx.stroke();
  debugCtx.fillText('0% (extrapolated)', gridArea.left - 100, yZeroPercent);
  
  // Draw actual reference lines (50% and 70%)
  referenceLines.forEach(line => {
    debugCtx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
    debugCtx.beginPath();
    debugCtx.moveTo(gridArea.left, line.y);
    debugCtx.lineTo(gridArea.left + gridArea.width, line.y);
    debugCtx.stroke();
    debugCtx.fillStyle = 'blue';
    debugCtx.fillText(`${line.percentage}% (detected)`, gridArea.left - 100, line.y);
  });
  
  // Step 3: Detect topic positions more precisely
  const xPositions = detectTopicPositions(edges, grayscale, width, height, gridArea, topics.length);
  
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
  
  // For each topic, find the score line and the confidence range
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    const x = xPositions[i] || gridArea.left + (i + 0.5) * (gridArea.width / topics.length);
    
    // Mark the x position
    debugCtx.fillStyle = 'blue';
    debugCtx.fillRect(x, gridArea.top, 2, gridArea.height);
    debugCtx.fillText(topic.substring(0, 10), x, gridArea.top - 5);
    
    // Define a vertical ROI for this column
    const roiYStart = Math.max(yHundredPercent - 20, 0);
    const roiYEnd = Math.min(yZeroPercent + 20, height);
    const roiWidth = Math.max(30, Math.round(gridArea.width * 0.02)); // Width of the region to analyze
    const roiXStart = Math.max(x - roiWidth/2, 0);
    const roiXEnd = Math.min(x + roiWidth/2, width);
    
    // Find the dark horizontal line (score line) in this region
    let scoreLineY = null;
    let minIntensity = 255;
    
    for (let y = roiYStart; y <= roiYEnd; y++) {
      // Calculate average intensity of horizontal line at this y position
      let totalIntensity = 0;
      let pixelCount = 0;
      
      for (let dx = roiXStart; dx < roiXEnd; dx++) {
        const idx = y * width + dx;
        if (idx >= 0 && idx < grayscale.length) {
          const grayValue = grayscale[idx];
          totalIntensity += grayValue;
          pixelCount++;
        }
      }
      
      if (pixelCount > 0) {
        const avgIntensity = totalIntensity / pixelCount;
        
        // Find the darkest line (which should be the score marker)
        if (avgIntensity < minIntensity && avgIntensity < 150) { // Threshold to avoid detecting light blue confidence bands
          minIntensity = avgIntensity;
          scoreLineY = y;
        }
      }
    }
    
    // Also detect the light blue confidence range
    let rangeTopY = null;
    let rangeBottomY = null;
    
    // Look for light blue pixels (confidence range)
    for (let y = roiYStart; y <= roiYEnd; y++) {
      let blueCount = 0;
      
      for (let dx = roiXStart; dx < roiXEnd; dx++) {
        const idx = (y * width + dx) * 4;
        // Check for light blue color (high blue, low red and green)
        if (data[idx] < 180 && data[idx+1] < 180 && data[idx+2] > 200) {
          blueCount++;
        }
      }
      
      // If we have enough blue pixels, consider it part of the range
      if (blueCount > roiWidth * 0.5) {
        if (rangeTopY === null) {
          rangeTopY = y;
        }
        rangeBottomY = y;
      }
    }
    
    // If we found a suitable score line
    if (scoreLineY !== null) {
      // Calculate the percentage for this topic
      const percentage = yToPercentage(scoreLineY);
      scores[topic] = {
        score: Math.round(percentage * 10) / 10 // Round to 1 decimal place
      };
      
      // Add range information if detected
      if (rangeTopY !== null && rangeBottomY !== null) {
        scores[topic].rangeTop = Math.round(yToPercentage(rangeTopY) * 10) / 10;
        scores[topic].rangeBottom = Math.round(yToPercentage(rangeBottomY) * 10) / 10;
      }
      
      // Mark the detected point on the debug image
      debugCtx.fillStyle = 'red';
      debugCtx.beginPath();
      debugCtx.arc(x, scoreLineY, 5, 0, 2 * Math.PI);
      debugCtx.fill();
      debugCtx.fillStyle = 'black';
      debugCtx.fillText(`${percentage.toFixed(1)}%`, x + 10, scoreLineY);
      
      // Mark the range if detected
      if (rangeTopY !== null && rangeBottomY !== null) {
        debugCtx.fillStyle = 'rgba(173, 216, 230, 0.5)'; // Light blue
        debugCtx.fillRect(x - 10, rangeTopY, 20, rangeBottomY - rangeTopY);
      }
      
      debugPoints.push({ x, y: scoreLineY, score: percentage });
    } else {
      console.log(`Could not detect score line for ${topic}`);
      scores[topic] = { score: null };
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

// Detect edges using Sobel operator
function detectEdges(grayscale, width, height) {
  const edges = new Uint8Array(width * height);
  
  // Sobel kernels
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let pixelX = 0;
      let pixelY = 0;
      
      // Apply convolution
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const idx = (y + i) * width + (x + j);
          const kernelIdx = (i + 1) * 3 + (j + 1);
          
          pixelX += grayscale[idx] * sobelX[kernelIdx];
          pixelY += grayscale[idx] * sobelY[kernelIdx];
        }
      }
      
      // Calculate gradient magnitude
      const magnitude = Math.min(255, Math.sqrt(pixelX * pixelX + pixelY * pixelY));
      edges[y * width + x] = magnitude;
    }
  }
  
  return edges;
}

// Detect chart grid area in the image
function detectChartGrid(edges, width, height, debugCtx) {
  // Use horizontal and vertical projections to detect grid area
  const horizProj = new Array(height).fill(0);
  const vertProj = new Array(width).fill(0);
  
  // Compute projections
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const edgeValue = edges[y * width + x];
      if (edgeValue > 30) { // Threshold for edge detection
        horizProj[y] += edgeValue;
        vertProj[x] += edgeValue;
      }
    }
  }
  
  // Smooth projections
  const smoothHoriz = smoothArray(horizProj, 20);
  const smoothVert = smoothArray(vertProj, 20);
  
  // Find peaks (grid lines) in horizontal projection
  const horizPeaks = findPeaks(smoothHoriz, 20);
  
  // Find peaks in vertical projection
  const vertPeaks = findPeaks(smoothVert, 20);
  
  // If we can't find enough peaks, use a fallback approach
  if (horizPeaks.length < 2 || vertPeaks.length < 2) {
    // Fallback: divide the image into thirds and assume the middle third is the chart
    return {
      top: Math.floor(height * 0.25),
      left: Math.floor(width * 0.1),
      width: Math.floor(width * 0.8),
      height: Math.floor(height * 0.5)
    };
  }
  
  // Sort peaks
  horizPeaks.sort((a, b) => a - b);
  vertPeaks.sort((a, b) => a - b);
  
  // Use the first and last significant peaks to define the grid boundaries
  const topBound = horizPeaks[0];
  const bottomBound = horizPeaks[horizPeaks.length - 1];
  const leftBound = vertPeaks[0];
  const rightBound = vertPeaks[vertPeaks.length - 1];
  
  // Ensure the bottom bound isn't too far down (avoid including the topic text area)
  const maxBottomBound = height * 0.7;
  const adjustedBottomBound = Math.min(bottomBound, maxBottomBound);
  
  return {
    top: topBound,
    left: leftBound,
    width: rightBound - leftBound,
    height: adjustedBottomBound - topBound
  };
}

// Smooth an array using moving average
function smoothArray(arr, windowSize) {
  const result = new Array(arr.length).fill(0);
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = 0; i < arr.length; i++) {
    let sum = 0;
    let count = 0;
    
    for (let j = Math.max(0, i - halfWindow); j <= Math.min(arr.length - 1, i + halfWindow); j++) {
      sum += arr[j];
      count++;
    }
    
    result[i] = sum / count;
  }
  
  return result;
}

// Find peaks in an array (local maxima)
function findPeaks(arr, minDistance) {
  const peaks = [];
  
  for (let i = 1; i < arr.length - 1; i++) {
    if (arr[i] > arr[i - 1] && arr[i] > arr[i + 1] && arr[i] > arr.reduce((a, b) => a + b, 0) / arr.length * 1.5) {
      // Check if peak is far enough from previously detected peaks
      const isFarEnough = peaks.every(peak => Math.abs(peak - i) >= minDistance);
      
      if (isFarEnough) {
        peaks.push(i);
      }
    }
  }
  
  return peaks;
}

// Specifically detect 50% and 70% reference lines
function detectReferenceLines(edges, grayscale, width, height, gridArea) {
  const lines = [];
  const edgeThreshold = 20;
  const minLineLength = gridArea.width * 0.5; // Line must span at least half the grid width
  
  // First find all horizontal lines
  const horizontalLines = [];
  
  for (let y = gridArea.top; y <= gridArea.top + gridArea.height; y++) {
    let lineLength = 0;
    let lineSum = 0;
    
    for (let x = gridArea.left; x <= gridArea.left + gridArea.width; x++) {
      const edgeValue = edges[y * width + x];
      
      if (edgeValue > edgeThreshold) {
        lineLength++;
        lineSum += edgeValue;
      }
    }
    
    // If line is long enough and has sufficient edge strength
    if (lineLength >= minLineLength && lineSum / lineLength > edgeThreshold * 1.5) {
      horizontalLines.push({ y, strength: lineSum });
    }
  }
  
  // Group close lines together (lines that are within 5 pixels of each other)
  const groupedLines = [];
  let currentGroup = [];
  
  for (let i = 0; i < horizontalLines.length; i++) {
    if (i === 0 || horizontalLines[i].y - horizontalLines[i - 1].y > 5) {
      if (currentGroup.length > 0) {
        // Calculate average y and strength for the group
        const avgY = currentGroup.reduce((sum, l) => sum + l.y, 0) / currentGroup.length;
        const avgStrength = currentGroup.reduce((sum, l) => sum + l.strength, 0) / currentGroup.length;
        groupedLines.push({ y: Math.round(avgY), strength: avgStrength });
      }
      currentGroup = [horizontalLines[i]];
    } else {
      currentGroup.push(horizontalLines[i]);
    }
  }
  
  // Add the last group if it exists
  if (currentGroup.length > 0) {
    const avgY = currentGroup.reduce((sum, l) => sum + l.y, 0) / currentGroup.length;
    const avgStrength = currentGroup.reduce((sum, l) => sum + l.strength, 0) / currentGroup.length;
    groupedLines.push({ y: Math.round(avgY), strength: avgStrength });
  }
  
  // Sort lines by y-position (top to bottom)
  groupedLines.sort((a, b) => a.y - b.y);
  
  // Check if we have text labels for the reference lines
  // For this image specifically, look for "50%" and "70%" text near the left edge
  
  // For the chart image provided, we know there are reference lines at 50% and 70%
  // Let's use their relative positions to identify them
  
  // Find lines in the middle portion of the chart (should be around where 50% and 70% are)
  const chartHeight = gridArea.height;
  const expectedLines = groupedLines.filter(line => {
    const relPos = (line.y - gridArea.top) / chartHeight;
    // 70% line should be in the upper third, 50% line in the middle
    return relPos > 0.2 && relPos < 0.8;
  });
  
  if (expectedLines.length >= 2) {
    // Sort by position (top to bottom)
    expectedLines.sort((a, b) => a.y - b.y);
    
    // Assign 70% to the top line and 50% to the bottom line
    // Assuming the chart is oriented with higher percentages at the top
    lines.push({
      y: expectedLines[0].y,
      strength: expectedLines[0].strength,
      percentage: 70
    });
    
    lines.push({
      y: expectedLines[1].y,
      strength: expectedLines[1].strength,
      percentage: 50
    });
  } else if (groupedLines.length >= 2) {
    // Fallback: divide the grid area into thirds
    const upperThird = gridArea.top + chartHeight * 0.33;
    const middleThird = gridArea.top + chartHeight * 0.67;
    
    // Find lines closest to the expected positions
    let line70 = null;
    let line50 = null;
    let minDist70 = Infinity;
    let minDist50 = Infinity;
    
    for (const line of groupedLines) {
      const dist70 = Math.abs(line.y - upperThird);
      const dist50 = Math.abs(line.y - middleThird);
      
      if (dist70 < minDist70) {
        minDist70 = dist70;
        line70 = line;
      }
      
      if (dist50 < minDist50) {
        minDist50 = dist50;
        line50 = line;
      }
    }
    
    if (line70) lines.push({ ...line70, percentage: 70 });
    if (line50) lines.push({ ...line50, percentage: 50 });
  }
  
  return lines;
}

// Detect x-positions for each topic
function detectTopicPositions(edges, grayscale, width, height, gridArea, numTopics) {
  // In this format, topics are evenly spaced
  const positions = [];
  const segmentWidth = gridArea.width / numTopics;
  
  for (let i = 0; i < numTopics; i++) {
    const centerX = gridArea.left + (i + 0.5) * segmentWidth;
    positions.push(centerX);
  }
  
  return positions;
}

// Add a new function for manual calibration support
export const calibrateExamScore = async (imageElement, calibrationSettings) => {
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
  
  // Scale calibration settings based on image dimensions
  const baseWidth = calibrationSettings.baseWidth || 5100;
  const baseHeight = calibrationSettings.baseHeight || 3300;
  const scaleX = width / baseWidth;
  const scaleY = height / baseHeight;
  
  // Apply scaling to y-coordinates
  const yZeroPercent = Math.round(calibrationSettings.yZeroPercent * scaleY);
  const yHundredPercent = Math.round(calibrationSettings.yHundredPercent * scaleY);
  
  // Scale x-positions for topics
  const xPositions = calibrationSettings.xPositions.map(x => Math.round(x * scaleX));
  
  // Create debug canvas
  const debugCanvas = document.createElement('canvas');
  const debugCtx = debugCanvas.getContext('2d');
  debugCanvas.width = width;
  debugCanvas.height = height;
  debugCtx.drawImage(imageElement, 0, 0);
  
  // Draw calibration points
  debugCtx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
  debugCtx.lineWidth = 2;
  
  // 100% line
  debugCtx.beginPath();
  debugCtx.moveTo(0, yHundredPercent);
  debugCtx.lineTo(width, yHundredPercent);
  debugCtx.stroke();
  debugCtx.fillStyle = 'red';
  debugCtx.fillText('100% (calibrated)', 10, yHundredPercent - 5);
  
  // 0% line
  debugCtx.beginPath();
  debugCtx.moveTo(0, yZeroPercent);
  debugCtx.lineTo(width, yZeroPercent);
  debugCtx.stroke();
  debugCtx.fillText('0% (calibrated)', 10, yZeroPercent - 5);
  
  // Topic positions
  for (let i = 0; i < xPositions.length; i++) {
    const x = xPositions[i];
    debugCtx.beginPath();
    debugCtx.moveTo(x, 0);
    debugCtx.lineTo(x, height);
    debugCtx.stroke();
    debugCtx.fillText(`Topic ${i+1}`, x - 20, 20);
  }
  
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
  
  // Extract scores based on calibrated positions
  // ... (similar to the analysis code, but using calibrated positions)
  
  // Save the debug image to display in the UI
  const debugImageUrl = debugCanvas.toDataURL('image/png');
  
  return { scores: {}, debugImageUrl }; // Return placeholder for now
};
