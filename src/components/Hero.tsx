'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

// Animation variants for staggered animations
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.3
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

// Button click ripple effect component
const RippleButton = ({ children }: { children: React.ReactNode }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const createRipple = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    const button = buttonRef.current;
    
    if (button) {
      const circle = document.createElement('span');
      const diameter = Math.max(button.clientWidth, button.clientHeight);
      const radius = diameter / 2;
      
      const rect = button.getBoundingClientRect();
      circle.style.width = circle.style.height = `${diameter}px`;
      circle.style.left = `${event.clientX - rect.left - radius}px`;
      circle.style.top = `${event.clientY - rect.top - radius}px`;
      circle.classList.add('ripple');
      
      // Remove existing ripples
      const existingRipple = button.querySelector('.ripple');
      if (existingRipple) {
        existingRipple.remove();
      }
      
      button.appendChild(circle);
    }
  };
  
  return (
    <button 
      ref={buttonRef}
      className="btn btn-primary overflow-hidden relative"
      onClick={createRipple}
    >
      {children}
    </button>
  );
};

// Pipeline node animation component
const AnimatedPipeline = () => {
  return (
    <div className="relative w-full md:w-3/4 lg:w-2/3 mx-auto h-[280px]">
      {/* Nodes */}
      <motion.div 
        className="absolute flex items-center justify-center w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        {[0, 1, 2, 3, 4].map((index) => (
          <motion.div 
            key={index}
            className={`w-16 h-16 mx-3 rounded-lg flex items-center justify-center
                       ${index === 0 ? 'bg-blue-500/90' : 
                        index === 1 ? 'bg-purple-500/90' : 
                        index === 2 ? 'bg-pink-500/90' :
                        index === 3 ? 'bg-amber-500/90' : 'bg-green-500/90'}`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.4, delay: 0.5 + index * 0.2 }}
          >
            <span className="text-white text-xs font-medium">
              {index === 0 ? 'INGEST' : 
               index === 1 ? 'CHUNK' : 
               index === 2 ? 'EMBED' :
               index === 3 ? 'INDEX' : 'SERVE'}
            </span>
          </motion.div>
        ))}
      </motion.div>
      
      {/* Connecting lines */}
      <svg className="absolute top-0 left-0 w-full h-full" style={{ zIndex: -1 }}>
        <motion.line
          x1="20%" y1="50%" x2="35%" y2="50%"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray="10"
          className="text-blue-400 dark:text-blue-600"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.6 }}
          transition={{ duration: 0.5, delay: 1.2 }}
        />
        <motion.line
          x1="35%" y1="50%" x2="50%" y2="50%"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray="10"
          className="text-purple-400 dark:text-purple-600"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.6 }}
          transition={{ duration: 0.5, delay: 1.4 }}
        />
        <motion.line
          x1="50%" y1="50%" x2="65%" y2="50%"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray="10"
          className="text-pink-400 dark:text-pink-600"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.6 }}
          transition={{ duration: 0.5, delay: 1.6 }}
        />
        <motion.line
          x1="65%" y1="50%" x2="80%" y2="50%"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray="10"
          className="text-amber-400 dark:text-amber-600"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.6 }}
          transition={{ duration: 0.5, delay: 1.8 }}
        />
      </svg>

      {/* Data flow animation */}
      <motion.div
        className="absolute top-1/2 left-[20%] h-3 w-3 rounded-full bg-blue-300"
        initial={{ x: 0, opacity: 0 }}
        animate={{ 
          x: ['0%', '60%', '130%', '200%', '260%'], 
          opacity: [0, 1, 1, 1, 0] 
        }}
        transition={{ 
          duration: 3,
          times: [0, 0.25, 0.5, 0.75, 1],
          repeat: Infinity, 
          repeatDelay: 0.5 
        }}
      />
      
      {/* Flow particles */}
      {[0.2, 0.7, 1.3, 1.9].map((delay, index) => (
        <motion.div
          key={`particle-${index}`}
          className="absolute top-1/2 left-[20%] h-2 w-2 rounded-full bg-white"
          initial={{ x: 0, opacity: 0 }}
          animate={{ 
            x: ['0%', '60%', '130%', '200%', '260%'], 
            opacity: [0, 1, 1, 1, 0] 
          }}
          transition={{ 
            duration: 3, 
            times: [0, 0.25, 0.5, 0.75, 1],
            delay,
            repeat: Infinity, 
            repeatDelay: 2 
          }}
        />
      ))}
    </div>
  );
};

// Main Hero component
const Hero = () => {
  // Add CSS for ripple effect
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .ripple {
        position: absolute;
        border-radius: 50%;
        transform: scale(0);
        animation: ripple 0.6s linear;
        background-color: rgba(255, 255, 255, 0.4);
      }
      
      @keyframes ripple {
        to {
          transform: scale(2);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <section className="pt-32 pb-20 overflow-hidden">
      <div className="container">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="text-center max-w-4xl mx-auto"
        >
          <motion.h1 
            variants={itemVariants}
            className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight"
          >
            Build & Deploy AI Context Pipelines
            <span className="text-primary block md:inline">—No Code Required</span>
          </motion.h1>
          
          <motion.p 
            variants={itemVariants}
            className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto"
          >
            Drag, drop, and go live with your own Model Context Protocol server in minutes.
          </motion.p>
          
          <motion.div variants={itemVariants}>
            <RippleButton>Get Started</RippleButton>
          </motion.div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-12"
        >
          <AnimatedPipeline />
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
