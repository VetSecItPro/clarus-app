interface BlueCheckLogoProps {
  size?: "sm" | "md" | "lg" | "xl" | number
  className?: string
}

const sizeMap = {
  sm: "w-6 h-6",
  md: "w-10 h-10",
  lg: "w-24 h-24",
  xl: "w-32 h-32",
}

export function BlueCheckLogo({ size = "md", className = "" }: BlueCheckLogoProps) {
  // Handle numeric size
  const sizeClass = typeof size === "number" ? "" : sizeMap[size]

  const style = typeof size === "number" ? { width: size, height: size } : undefined

  return (
    <svg
      viewBox="0 0 100 100"
      className={`${sizeClass} ${className}`}
      style={style}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Blue circle background */}
      <circle cx="50" cy="50" r="45" fill="#1d9bf0" />
      {/* White checkmark */}
      <path
        d="M30 52L45 67L70 37"
        stroke="white"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export default BlueCheckLogo
