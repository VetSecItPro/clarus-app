"use client";

import { Player } from "@remotion/player";
import type { ComponentType } from "react";

interface VideoPlayerProps<T extends Record<string, unknown>> {
  component: ComponentType<T>;
  inputProps: T;
  durationInFrames: number;
  fps?: number;
  compositionWidth?: number;
  compositionHeight?: number;
  autoPlay?: boolean;
  loop?: boolean;
  controls?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Generic Remotion Player wrapper. Use this in any page/component
 * to embed a Remotion composition as an inline video.
 *
 * Must be a client component since Remotion Player needs browser APIs.
 */
export function VideoPlayer<T extends Record<string, unknown>>({
  component,
  inputProps,
  durationInFrames,
  fps = 30,
  compositionWidth = 1920,
  compositionHeight = 1080,
  autoPlay = true,
  loop = true,
  controls = false,
  className,
  style,
}: VideoPlayerProps<T>) {
  return (
    <Player
      component={component}
      inputProps={inputProps}
      durationInFrames={durationInFrames}
      fps={fps}
      compositionWidth={compositionWidth}
      compositionHeight={compositionHeight}
      autoPlay={autoPlay}
      loop={loop}
      controls={controls}
      className={className}
      style={{ width: "100%", ...style }}
    />
  );
}
