'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { FiMove, FiSliders, FiCheckCircle, FiSend } from 'react-icons/fi';

const HowItWorks = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const steps = [
    {
      icon: <FiMove className="w-8 h-8" />,
      title: "Drag",
      description: "Drag components onto the canvas to build your data pipeline visually"
    },
    {
      icon: <FiSliders className="w-8 h-8" />,
      title: "Configure",
      description: "Fine-tune settings with AI assistance or manually adjust parameters"
    },
    {
      icon: <FiCheckCircle className="w-8 h-8" />,
      title: "Test",
      description: "Test your pipeline with sample data to ensure optimal performance"
    },
    {
      icon: <FiSend className="w-8 h-8" />,
      title: "Deploy",
      description: "Deploy to production with a single click to your preferred platform"
    }
  ];

  return (
    <section id="how-it-works" className="py-20">
      <div className="container">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl font-bold mb-4"
          >
            How It Works
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-muted-foreground text-lg max-w-2xl mx-auto"
          >
            Build your Model Context Protocol server in four simple steps
          </motion.p>
        </div>

        <div ref={ref} className="relative">
          {/* Process flow animation */}
          <div className="absolute top-24 left-0 right-0 h-1 bg-muted">
            <motion.div 
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={isInView ? { width: '100%' } : {}}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.5 + index * 0.2 }}
                className="flex flex-col items-center text-center"
              >
                <div className="relative mb-8">
                  <div className="w-16 h-16 rounded-full bg-background border-2 border-primary flex items-center justify-center shadow-lg">
                    <div className="text-primary">{step.icon}</div>
                  </div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={isInView ? { scale: 1 } : {}}
                    transition={{ duration: 0.3, delay: 0.7 + index * 0.2 }}
                    className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm"
                  >
                    {index + 1}
                  </motion.div>
                </div>
                <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </motion.div>
            ))}
          </div>

          {/* Animated arrows between steps (visible on larger screens) */}
          <div className="hidden lg:block">
            {[0, 1, 2].map((index) => (
              <motion.div
                key={`arrow-${index}`}
                className="absolute top-24 transform -translate-y-1/2"
                style={{ left: `${24 + index * 33}%` }}
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.5, delay: 1 + index * 0.2 }}
              >
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path 
                    d="M5 12h14M14 6l6 6-6 6" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className="text-primary"
                  />
                </svg>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
