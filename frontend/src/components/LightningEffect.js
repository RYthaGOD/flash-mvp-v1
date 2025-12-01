import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LightningEffect = ({ active, position = { x: 0, y: 0 } }) => {
  const [bolts, setBolts] = useState([]);

  useEffect(() => {
    if (active) {
      // Generate random lightning bolts
      const newBolts = Array.from({ length: 3 }, (_, i) => ({
        id: `bolt-${i}`,
        x: position.x + (Math.random() - 0.5) * 200,
        y: position.y + (Math.random() - 0.5) * 200,
        delay: i * 0.1,
        duration: 0.3 + Math.random() * 0.4,
      }));
      setBolts(newBolts);

      // Clear bolts after animation
      const timer = setTimeout(() => setBolts([]), 1000);
      return () => clearTimeout(timer);
    }
  }, [active, position]);

  return (
    <AnimatePresence>
      {bolts.map((bolt) => (
        <motion.div
          key={bolt.id}
          className="lightning-bolt"
          initial={{
            opacity: 0,
            scale: 0,
            x: position.x,
            y: position.y
          }}
          animate={{
            opacity: [0, 1, 0.8, 0],
            scale: [0, 1.2, 0.8, 0],
            x: bolt.x,
            y: bolt.y,
            rotate: [0, 15, -10, 0]
          }}
          exit={{ opacity: 0, scale: 0 }}
          transition={{
            duration: bolt.duration,
            delay: bolt.delay,
            ease: "easeInOut"
          }}
          style={{
            position: 'fixed',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          <svg width="60" height="100" viewBox="0 0 60 100" fill="none">
            {/* Lightning bolt path */}
            <motion.path
              d="M30 10 L25 35 L35 35 L20 65 L30 65 L15 90"
              stroke="#fbbf24"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: [0, 1, 1, 0],
                opacity: [0, 1, 0.8, 0]
              }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            />
            {/* Glow effect */}
            <motion.path
              d="M30 10 L25 35 L35 35 L20 65 L30 65 L15 90"
              stroke="#fbbf24"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.3"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: [0, 1, 1, 0] }}
              transition={{ duration: 0.3, delay: 0.05, ease: "easeInOut" }}
            />
          </svg>
        </motion.div>
      ))}
    </AnimatePresence>
  );
};

export default LightningEffect;
