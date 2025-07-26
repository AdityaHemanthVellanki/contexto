'use client';

import { useRef, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import { FiBox, FiSettings, FiCloud, FiArrowRight } from 'react-icons/fi';

const Features = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const features = [
    {
      icon: <FiBox className="w-8 h-8" />,
      title: "Visual Pipeline Builder",
      description: "Drag-and-drop nodes to ingest, chunk, embed, index, retrieve. Build your context pipeline visually without writing code."
    },
    {
      icon: <FiSettings className="w-8 h-8" />,
      title: "AI-Assisted Config",
      description: "Click any block and ask AI to fine-tune chunk sizes, models, indexes. Let AI optimize your pipeline parameters."
    },
    {
      icon: <FiCloud className="w-8 h-8" />,
      title: "1-Click Deploy",
      description: "Export code or deploy to Heroku with one click. Go from concept to production in minutes, not days."
    }
  ];

  return (
    <section id="features" className="py-20 bg-muted/30">
      <div className="container">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl font-bold mb-4"
          >
            Power Features, Zero Complexity
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-muted-foreground text-lg max-w-2xl mx-auto"
          >
            Everything you need to build, test, and deploy MCP servers for your AI context needs
          </motion.p>
        </div>
        
        <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
              className="card card-hover group"
            >
              <div className="p-3 mb-5 inline-flex rounded-lg bg-primary/10 text-primary dark:bg-primary/20">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground mb-4">{feature.description}</p>
              <div className="flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Learn more <FiArrowRight className="ml-1" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
