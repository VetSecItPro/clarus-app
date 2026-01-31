export function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Primary blue orb - top left */}
      <div
        className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full bg-[#1d9bf0]/20 blur-[120px]"
        style={{ animation: "orb1 20s ease-in-out infinite" }}
      />

      {/* Teal orb - bottom right */}
      <div
        className="absolute bottom-[10%] right-[10%] w-[450px] h-[450px] rounded-full bg-teal-500/15 blur-[100px]"
        style={{ animation: "orb2 25s ease-in-out infinite" }}
      />

      {/* Sky blue orb - center right */}
      <div
        className="absolute top-[40%] right-[25%] w-[350px] h-[350px] rounded-full bg-sky-500/10 blur-[80px]"
        style={{ animation: "orb3 18s ease-in-out infinite" }}
      />

      {/* Subtle cyan orb - bottom left */}
      <div
        className="absolute bottom-[20%] left-[5%] w-[300px] h-[300px] rounded-full bg-cyan-500/10 blur-[90px]"
        style={{ animation: "orb4 22s ease-in-out infinite" }}
      />

      <style>{`
        @keyframes orb1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(100px, -50px) scale(1.1); }
          50% { transform: translate(50px, 30px) scale(0.95); }
          75% { transform: translate(75px, -10px) scale(1.05); }
        }
        @keyframes orb2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(-80px, 60px) scale(0.9); }
          50% { transform: translate(-40px, -20px) scale(1.05); }
          75% { transform: translate(-60px, 20px) scale(0.95); }
        }
        @keyframes orb3 {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(60px, -40px); }
          50% { transform: translate(-30px, 20px); }
          75% { transform: translate(15px, -10px); }
        }
        @keyframes orb4 {
          0%, 100% { transform: translate(0, 0); opacity: 0.5; }
          33% { transform: translate(40px, -30px); opacity: 0.7; }
          66% { transform: translate(-20px, 40px); opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
