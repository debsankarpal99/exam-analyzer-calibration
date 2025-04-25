import { useState, useEffect } from 'react';

const AnimatedAnalyzingMotion = () => {
  const [animState, setAnimState] = useState(0);
  const [glowIntensity, setGlowIntensity] = useState(0);
  
  // Control the main animation state
  useEffect(() => {
    const animInterval = setInterval(() => {
      setAnimState(prev => (prev + 1) % 12);
    }, 250);
    
    return () => clearInterval(animInterval);
  }, []);
  
  // Control the glow pulse effect
  useEffect(() => {
    const glowInterval = setInterval(() => {
      setGlowIntensity(prev => {
        if (prev >= 10) return 0;
        return prev + 1;
      });
    }, 100);
    
    return () => clearInterval(glowInterval);
  }, []);
  
  // Calculate the dot pattern based on animation state
  const getDotPattern = () => {
    const base = animState % 4;
    return '.'.repeat(base + 1);
  };
  
  // Calculate the horizontal movement
  const getHorizontalOffset = () => {
    const cycle = Math.floor(animState / 4);
    return cycle * 2;
  };
  
  return (
    <div className="flex items-center justify-center py-6">
      <div 
        className="bg-gradient-to-r from-blue-50 to-indigo-50 px-12 py-6 rounded-xl transition-all duration-300"
        style={{
          boxShadow: `0 4px 20px ${glowIntensity / 10}rem rgba(59, 130, 246, 0.3)`
        }}
      >
        <div className="relative flex items-center">
          {/* Spinning indicator */}
          <div className="absolute -left-8 top-1/2 transform -translate-y-1/2">
            <div 
              className="h-6 w-6 border-t-2 border-r-2 border-blue-600 rounded-full transition-transform"
              style={{ 
                transform: `rotate(${animState * 30}deg)`,
                opacity: 0.8
              }}
            ></div>
          </div>
        
          {/* Main text with gradient */}
          <div 
            className="text-3xl font-medium bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600"
            style={{
              transform: `translateX(${getHorizontalOffset()}px)`,
              transition: 'transform 0.15s ease-in-out'
            }}
          >
            Analyzing
          </div>
          
          {/* Animated dots */}
          <div className="ml-1 w-24 overflow-hidden">
            <div className="text-3xl text-blue-600 font-medium">
              {getDotPattern()}
            </div>
          </div>
        </div>
        
        {/* Progress bar with smoother animation */}
        <div className="mt-4 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 ease-out"
            style={{ 
              width: `${(animState % 4) * 20 + 20}%`
            }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedAnalyzingAnimation;
