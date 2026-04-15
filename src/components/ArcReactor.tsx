import { motion } from 'motion/react';

export function ArcReactor({ isListening, isThinking }: { isListening: boolean; isThinking: boolean }) {
  return (
    <div className="relative flex items-center justify-center w-80 h-80">
      {/* Outer Glow */}
      <div className="absolute inset-0 bg-cyan-500/5 rounded-full blur-3xl" />

      {/* Main Rotating Rings */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-cyan-500/20"
          style={{
            width: `${100 - i * 15}%`,
            height: `${100 - i * 15}%`,
          }}
          animate={{
            rotate: i % 2 === 0 ? 360 : -360,
            opacity: isListening ? 0.6 : 0.2,
          }}
          transition={{
            rotate: { duration: 10 + i * 5, repeat: Infinity, ease: "linear" },
          }}
        />
      ))}

      {/* Dashed Progress Ring */}
      <motion.div
        className="absolute w-[85%] h-[85%] border-2 border-dashed border-cyan-400/40 rounded-full"
        animate={{ rotate: -360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />

      {/* Neural Network / Star Field Container */}
      <div className="absolute w-[60%] h-[60%] rounded-full overflow-hidden bg-black/40 border border-cyan-500/30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.2)_0%,transparent_70%)]" />
        
        {/* Animated Stars/Nodes */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_5px_rgba(34,211,238,0.8)]"
            initial={{ 
              x: Math.random() * 200 - 100, 
              y: Math.random() * 200 - 100,
              opacity: Math.random()
            }}
            animate={{
              x: [null, Math.random() * 200 - 100],
              y: [null, Math.random() * 200 - 100],
              opacity: [0.2, 0.8, 0.2],
              scale: [1, 1.5, 1]
            }}
            transition={{
              duration: 3 + Math.random() * 5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ))}

        {/* Connecting Lines (Simulated with SVG) */}
        <svg className="absolute inset-0 w-full h-full opacity-20">
          <motion.circle
            cx="50%"
            cy="50%"
            r="40%"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-cyan-500"
            strokeDasharray="4 4"
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          />
        </svg>
      </div>

      {/* Central Core */}
      <motion.div
        className="relative w-16 h-16 bg-cyan-100 rounded-full shadow-[0_0_50px_rgba(34,211,238,1)] flex items-center justify-center z-10"
        animate={{
          scale: isThinking ? [1, 1.2, 1] : isListening ? [1, 1.1, 1] : 1,
          boxShadow: isThinking 
            ? "0 0 60px rgba(34,211,238,1)" 
            : "0 0 30px rgba(34,211,238,0.8)"
        }}
        transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="w-12 h-12 border-2 border-cyan-500 rounded-full flex items-center justify-center">
          <div className="w-4 h-4 bg-cyan-500 rounded-full animate-pulse" />
        </div>
      </motion.div>

      {/* Orbiting Data Bits */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-full h-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 8 + i * 4, repeat: Infinity, ease: "linear" }}
        >
          <div 
            className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-cyan-300 rounded-full shadow-[0_0_10px_rgba(34,211,238,1)]"
            style={{ transform: `translateY(${10 + i * 15}px)` }}
          />
        </motion.div>
      ))}
    </div>
  );
}
