import { useState, useEffect } from 'react';

const AnimatedAnalyzingText = () => {
  const [phase, setPhase] = useState(0);
  const [particles, setParticles] = useState([]);

  // Main animation controller
  useEffect(() => {
    const interval = setInterval(() => {
      setPhase(prev => (prev + 1) % 16);
    }, 300);
    return () => clearInterval(interval);
  }, []);

  // Particle generator
  useEffect(() => {
    if (phase % 4 === 0) {
      // Generate a new particle
      const newParticle = {
        id: Date.now(),
        x: Math.random() * 100,
        y: Math.random() * 40 + 30,
        size: Math.random() * 4 + 2,
        opacity: 0.7,
        speed: Math.random() * 0.5 + 0.2
      };
      setParticles(prev => [...prev, newParticle]);
    }
    
    // Move particles
    setParticles(prev => prev
      .map(p => ({
        ...p,
        x: p.x + p.speed,
        opacity: p.x > 50 ? p.opacity - 0.03 : p.opacity
      }))
      .filter(p => p.opacity > 0 && p.x < 120)
    );
  }, [phase]);

  // Calculate dots display
  const dots = '.'.repeat((phase % 4) + 1);

  return (
    <div className="flex items-center justify-center py-8">
      <div className="relative w-64 h-24">
        {/* Background particles */}
        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute rounded-full bg-blue-500"
            style={{
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              opacity: particle.opacity,
              transition: 'all 0.3s linear'
            }}
          />
        ))}
        
        {/* Main content container */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white bg-opacity-90 px-8 py-4 rounded-xl shadow-lg backdrop-blur-sm">
            <div className="flex items-center">
              <span
                className="text-2xl font-medium text-blue-700"
                style={{
                  transform: `translateY(${Math.sin(phase/2) * 2}px)`,
                  transition: 'transform 0.3s ease-out'
                }}
              >
                Analyzing
              </span>
              <span className="ml-1 text-2xl font-medium text-blue-700 w-12 inline-block">
                {dots}
              </span>
            </div>
            
            {/* Blue line that moves horizontally */}
            <div className="relative h-1 w-full bg-gray-100 rounded-full mt-2 overflow-hidden">
              <div
                className="absolute h-full bg-blue-600 transition-all duration-300"
                style={{
                  width: '30%',
                  left: `${(phase % 8) * 10}%`,
                  opacity: 0.8
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimatedAnalyzingText;
