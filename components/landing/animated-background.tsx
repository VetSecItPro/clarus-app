export function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Primary blue orb - top left */}
      <div className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full bg-brand/20 blur-[120px] animate-[orb1_20s_ease-in-out_infinite] motion-reduce:animate-none" />

      {/* Teal orb - bottom right */}
      <div className="absolute bottom-[10%] right-[10%] w-[450px] h-[450px] rounded-full bg-teal-500/15 blur-[100px] animate-[orb2_25s_ease-in-out_infinite] motion-reduce:animate-none" />

      {/* Sky blue orb - center right */}
      <div className="absolute top-[40%] right-[25%] w-[350px] h-[350px] rounded-full bg-sky-500/10 blur-[80px] animate-[orb3_18s_ease-in-out_infinite] motion-reduce:animate-none" />

      {/* Subtle cyan orb - bottom left */}
      <div className="absolute bottom-[20%] left-[5%] w-[300px] h-[300px] rounded-full bg-cyan-500/10 blur-[90px] animate-[orb4_22s_ease-in-out_infinite] motion-reduce:animate-none" />

    </div>
  )
}
