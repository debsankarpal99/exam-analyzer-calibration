import { useState, useEffect } from 'react';

const AnimatedAnalyzingText = () => {
  const [dotCount, setDotCount] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev + 1) % 4);
    }, 600);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="flex items-center justify-center py-6">
      <div className="bg-blue-50 px-8 py-4 rounded-lg shadow-md">
        <div className="flex items-center">
          <div className="text-2xl font-medium text-blue-700">
            Analyzing
          </div>
          <div className="w-16 text-blue-700 text-2xl overflow-hidden">
            <div 
              className="transition-transform duration-300 ease-in-out" 
              style={{ 
                transform: `translateX(${dotCount * -10}px)`,
                whiteSpace: 'nowrap'
              }}
            >
              {['.', '..', '...', '....'][dotCount]}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimatedAnalyzingText;
