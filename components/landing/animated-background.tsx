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

    </div>
  )
}
