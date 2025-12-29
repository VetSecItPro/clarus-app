"use client"

import Image from "next/image"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface OptimizedImageProps {
  src: string | null
  alt: string
  fill?: boolean
  width?: number
  height?: number
  className?: string
  priority?: boolean
  fallback?: React.ReactNode
}

// Simple shimmer placeholder as base64
const shimmerBase64 = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMxYTFhMWEiLz48L3N2Zz4="

export function OptimizedImage({
  src,
  alt,
  fill = true,
  width,
  height,
  className,
  priority = false,
  fallback,
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  if (!src || hasError) {
    return fallback ? <>{fallback}</> : null
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      width={!fill ? width : undefined}
      height={!fill ? height : undefined}
      className={cn(
        className,
        "transition-opacity duration-300",
        isLoading ? "opacity-0" : "opacity-100"
      )}
      onLoad={() => setIsLoading(false)}
      onError={() => setHasError(true)}
      placeholder="blur"
      blurDataURL={shimmerBase64}
      priority={priority}
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      loading={priority ? undefined : "lazy"}
    />
  )
}
