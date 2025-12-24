"use client"

import { motion } from "framer-motion"

export function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Primary blue orb - top left */}
      <motion.div
        animate={{
          x: [0, 100, 50, 0],
          y: [0, -50, 30, 0],
          scale: [1, 1.1, 0.95, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full bg-[#1d9bf0]/20 blur-[120px]"
      />

      {/* Teal orb - bottom right */}
      <motion.div
        animate={{
          x: [0, -80, -40, 0],
          y: [0, 60, -20, 0],
          scale: [1, 0.9, 1.05, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute bottom-[10%] right-[10%] w-[450px] h-[450px] rounded-full bg-teal-500/15 blur-[100px]"
      />

      {/* Sky blue orb - center right */}
      <motion.div
        animate={{
          x: [0, 60, -30, 0],
          y: [0, -40, 20, 0],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-[40%] right-[25%] w-[350px] h-[350px] rounded-full bg-sky-500/10 blur-[80px]"
      />

      {/* Subtle cyan orb - bottom left */}
      <motion.div
        animate={{
          x: [0, 40, -20, 0],
          y: [0, -30, 40, 0],
          opacity: [0.5, 0.7, 0.5],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute bottom-[20%] left-[5%] w-[300px] h-[300px] rounded-full bg-cyan-500/10 blur-[90px]"
      />
    </div>
  )
}
