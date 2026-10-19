import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

interface HighlightBoxProps {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  labelPosition?: 'top' | 'bottom' | 'left' | 'right';
  color?: string;
  opacity?: number;
  padding?: number;
  borderRadius?: number;
  startFrame?: number;
  endFrame?: number;
}

export const HighlightBox: React.FC<HighlightBoxProps> = ({
  x,
  y,
  width,
  height,
  label,
  labelPosition = 'top',
  color = '#0891B2',
  opacity,
  padding = 6,
  borderRadius = 10,
  startFrame,
  endFrame,
}) => {
  const frame = useCurrentFrame();

  let computedOpacity = opacity ?? 1;
  if (startFrame !== undefined && endFrame !== undefined) {
    const fadeIn = interpolate(frame, [startFrame, startFrame + 8], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const fadeOut = interpolate(frame, [endFrame - 8, endFrame], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    computedOpacity = Math.min(fadeIn, fadeOut);
  }

  if (computedOpacity <= 0.01) return null;

  const pulse = Math.sin((frame / 18) * Math.PI * 2) * 0.5 + 0.5;
  const ringSpread = interpolate(pulse, [0, 1], [3, 9]);
  const ringAlpha = interpolate(pulse, [0, 1], [0.42, 0.14]);

  const getLabelPosStyle = (): React.CSSProperties => {
    switch (labelPosition) {
      case 'bottom':
        return { bottom: -30, left: -2 };
      case 'left':
        return { top: '50%', right: width + padding * 2 + 10, transform: 'translateY(-50%)' };
      case 'right':
        return { top: '50%', left: width + padding * 2 + 10, transform: 'translateY(-50%)' };
      case 'top':
      default:
        return { top: -30, left: -2 };
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: x - padding,
        top: y - padding,
        width: width + padding * 2,
        height: height + padding * 2,
        borderRadius,
        border: `2.5px solid ${color}`,
        boxShadow: `0 0 0 ${ringSpread}px rgba(14, 165, 233, ${ringAlpha}), 0 8px 24px rgba(14, 165, 233, 0.22)`,
        pointerEvents: 'none',
        zIndex: 50,
        opacity: computedOpacity,
      }}
    >
      {label && (
        <div
          style={{
            position: 'absolute',
            ...getLabelPosStyle(),
            backgroundColor: color,
            color: '#FFFFFF',
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: '0.02em',
            padding: '4px 10px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};
