import React, { useState } from 'react';

const CalibrationSettings = ({ onCalibrationChange, defaultSettings }) => {
  const [settings, setSettings] = useState(defaultSettings || {
    yZeroPercent: 911,
    yHundredPercent: 580,
    xPositions: [500, 770, 1050, 1280, 1570, 1870, 2100, 2410, 2667, 2950]
  });
  
  const [isOpen, setIsOpen] = useState(false);
  
  const handleChange = (field, value) => {
    let newValue = value;
    
    // Parse numerical values
    if (field !== 'xPositions') {
      newValue = parseInt(value, 10);
    } else {
      // Parse array of positions
      try {
        newValue = value.split(',').map(x => parseInt(x.trim(), 10));
      } catch (e) {
        console.error('Error parsing x positions:', e);
        return;
      }
    }
    
    const newSettings = { ...settings, [field]: newValue };
    setSettings(newSettings);
    onCalibrationChange(newSettings);
  };
  
  return (
    <div className="mt-4 mb-4">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="text-blue-600 underline"
      >
        {isOpen ? "Hide Advanced Calibration" : "Show Advanced Calibration"}
      </button>
      
      {isOpen && (
        <div className="mt-4 p-4 border rounded bg-gray-50">
          <h3 className="font-bold mb-2">Calibration Settings</h3>
          
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Y Position for 0%
                <input 
                  type="number" 
                  value={settings.yZeroPercent}
                  onChange={(e) => handleChange('yZeroPercent', e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm"
                />
              </label>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Y Position for 100%
                <input 
                  type="number" 
                  value={settings.yHundredPercent}
                  onChange={(e) => handleChange('yHundredPercent', e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm"
                />
              </label>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                X Positions (comma-separated)
                <input 
                  type="text" 
                  value={settings.xPositions.join(', ')}
                  onChange={(e) => handleChange('xPositions', e.target.value)}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm"
                />
              </label>
            </div>
          </div>
          
          <p className="text-xs text-gray-500 mt-2">
            These settings control the calibration points for score detection. Adjust if scores are not being detected correctly.
          </p>
        </div>
      )}
    </div>
  );
};

export default CalibrationSettings;
