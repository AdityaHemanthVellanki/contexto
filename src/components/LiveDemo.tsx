'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { FiFile, FiCheck, FiCpu } from 'react-icons/fi';

const LiveDemo = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const pdfRef = useRef<HTMLDivElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Demo processing steps
  const processingSteps = [
    "Initializing document processor...",
    "Loading PDF document...",
    "Extracting text content...",
    "Splitting into 43 chunks...",
    "Encoding chunks with embedding model...",
    "Vectorizing content...",
    "Indexing vectors to vector store...",
    "Optimizing index for retrieval...",
    "MCP server endpoint ready!",
    "Test query: 'What are the main features?'",
    "Retrieved 3 relevant chunks",
    "Processing complete! ✓"
  ];

  // Handle the drag and drop simulation
  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
  };

  const handleDragMove = (e: React.MouseEvent) => {
    if (isDragging && pdfRef.current) {
      const rect = dropZoneRef.current?.getBoundingClientRect();
      if (rect) {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Check if dragged near the drop zone
        if (
          e.clientX > rect.left - 20 &&
          e.clientX < rect.right + 20 &&
          e.clientY > rect.top - 20 &&
          e.clientY < rect.bottom + 20
        ) {
          // Snap to center
          controls.start({
            x: centerX - 25, // Half of PDF icon width
            y: centerY - 25 // Half of PDF icon height
          });
          
          if (!isProcessing) {
            setIsProcessing(true);
            processDemo();
          }
          return;
        }
        
        controls.start({
          x: e.clientX - 25,
          y: e.clientY - 25
        });
      }
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    if (!isProcessing) {
      controls.start({ x: 0, y: 0 });
    }
  };

  // Simulate processing with log output
  const processDemo = async () => {
    for (let i = 0; i < processingSteps.length; i++) {
      setCurrentStep(i);
      setLogs(prev => [...prev, processingSteps[i]]);
      await new Promise(r => setTimeout(r, i === 0 ? 500 : 1000));
      
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
      }
    }
    
    // Reset after demo completion with delay
    setTimeout(() => {
      setIsProcessing(false);
      setLogs([]);
      setCurrentStep(0);
      controls.start({ x: 0, y: 0 });
    }, 4000);
  };

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <section className="py-20 bg-muted/30">
      <div className="container">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl font-bold mb-4"
          >
            See It In Action
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-muted-foreground text-lg max-w-2xl mx-auto"
          >
            Drag and drop the PDF file onto the pipeline to see how quickly Contexto processes your documents
          </motion.p>
        </div>
        
        <div className="max-w-4xl mx-auto">
          <div 
            className="bg-card rounded-xl border border-border shadow-lg overflow-hidden"
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
          >
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Interactive pipeline demo area */}
              <div className="p-6 border-b md:border-r md:border-b-0 border-border flex items-center justify-center relative min-h-[300px]">
                <div className="flex items-center justify-between w-full max-w-xs">
                  {/* Start node */}
                  <div className="flex flex-col items-center">
                    <div className="mb-2 text-sm text-muted-foreground">Source</div>
                    <motion.div
                      ref={pdfRef}
                      initial={{ x: 0, y: 0 }}
                      animate={controls}
                      drag={!isProcessing}
                      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                      dragElastic={0.1}
                      onMouseDown={handleDragStart}
                      className="w-12 h-14 bg-blue-500 text-white rounded flex items-center justify-center cursor-grab active:cursor-grabbing"
                    >
                      <FiFile className="w-6 h-6" />
                    </motion.div>
                    <div className="mt-2 text-xs">drag me</div>
                  </div>
                  
                  {/* Arrow */}
                  <div className="border-t-2 border-dashed border-muted-foreground w-24"></div>
                  
                  {/* Drop zone */}
                  <div className="flex flex-col items-center">
                    <div className="mb-2 text-sm text-muted-foreground">Pipeline</div>
                    <motion.div
                      ref={dropZoneRef}
                      className={`w-14 h-14 rounded-lg flex items-center justify-center ${
                        isProcessing ? "bg-green-500" : "bg-primary"
                      }`}
                      animate={{
                        scale: isProcessing ? [1, 1.05, 1] : 1,
                      }}
                      transition={{
                        duration: 0.5,
                        repeat: isProcessing ? Infinity : 0,
                        repeatType: "reverse",
                      }}
                    >
                      {isProcessing ? (
                        <FiCheck className="w-6 h-6 text-white" />
                      ) : (
                        <FiCpu className="w-6 h-6 text-white" />
                      )}
                    </motion.div>
                    <div className="mt-2 text-xs">drop here</div>
                  </div>
                </div>
                
                {isProcessing && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full"
                  >
                    Processing...
                  </motion.div>
                )}
              </div>
              
              {/* Console log output */}
              <div className="p-4 h-80">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Console Output</div>
                  {isProcessing && (
                    <div className="text-xs text-muted-foreground">
                      {currentStep + 1}/{processingSteps.length}
                    </div>
                  )}
                </div>
                <div 
                  ref={logRef}
                  className="bg-muted font-mono text-xs h-full p-3 rounded overflow-y-auto"
                >
                  <div className="text-green-500 mb-2">$ contexto process sample.pdf</div>
                  {logs.map((log, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`mb-1 ${
                        log.includes("✓") ? "text-green-500" :
                        log.includes("error") ? "text-red-500" :
                        ""
                      }`}
                    >
                      {log}
                    </motion.div>
                  ))}
                  {isProcessing && (
                    <motion.span
                      animate={{ opacity: [0, 1] }}
                      transition={{ repeat: Infinity, duration: 0.8 }}
                      className="inline-block"
                    >
                      _
                    </motion.span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-6 text-center text-muted-foreground text-sm"
          >
            Try it yourself: drag the PDF icon and drop it on the pipeline node
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default LiveDemo;
