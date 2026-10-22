import type { CSSProperties, FC } from 'react';

export interface ElectricLogoProps {
  src?: string;
  color?: string;
  glowColor?: string;
  scale?: number;
  intensity?: number;
  glow?: number;
  thickness?: number;
  strands?: number;
  bend?: number;
  crackle?: number;
  arcs?: number;
  flicker?: number;
  fill?: number;
  speed?: number;
  interactive?: boolean;
  cursorIntensity?: number;
  cursorRadius?: number;
  /** Tope de fotogramas por segundo (0 = sin límite). */
  maxFps?: number;
  /** Máximo de píxeles del canvas por píxel de pantalla. */
  maxDpr?: number;
  /** Máximo de píxeles totales del canvas. */
  pixelBudget?: number;
  theme?: 'dark' | 'light';
  onRender?: (canvas: HTMLCanvasElement) => void;
  className?: string;
  style?: CSSProperties;
}

declare const ElectricLogo: FC<ElectricLogoProps>;
export default ElectricLogo;
