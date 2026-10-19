import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { useCameraScale } from './CameraViewport';

export interface CursorKeyframe {
  frame: number;
  x: number;
  y: number;
  click?: boolean;
}

interface MouseCursorProps {
  x?: number;
  y?: number;
  isClicked?: boolean;
  label?: string;
  keyframes?: CursorKeyframe[];
  cameraScale?: number;
}

export const MouseCursor: React.FC<MouseCursorProps> = ({
  x,
  y,
  isClicked = false,
  label,
  keyframes,
  cameraScale: propScale,
}) => {
  const frame = useCurrentFrame();
  const contextScale = useCameraScale();
  const cameraScale = propScale ?? contextScale;

  let curX = x ?? 800;
  let curY = y ?? 450;
  let clicked = isClicked;

  if (keyframes && keyframes.length > 0) {
    if (frame <= keyframes[0].frame) {
      curX = keyframes[0].x;
      curY = keyframes[0].y;
    } else if (frame >= keyframes[keyframes.length - 1].frame) {
      curX = keyframes[keyframes.length - 1].x;
      curY = keyframes[keyframes.length - 1].y;
    } else {
      for (let i = 0; i < keyframes.length - 1; i++) {
        const k1 = keyframes[i];
        const k2 = keyframes[i + 1];
        if (frame >= k1.frame && frame <= k2.frame) {
          const span = Math.max(1, k2.frame - k1.frame);
          const progress = interpolate(frame, [k1.frame, k2.frame], [0, 1], {
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          curX = k1.x + (k2.x - k1.x) * progress;
          curY = k1.y + (k2.y - k1.y) * span * (progress / span);
          break;
        }
      }
    }

    for (const kf of keyframes) {
      if (kf.click && frame >= kf.frame - 2 && frame <= kf.frame + 10) {
        clicked = true;
        break;
      }
    }
  }

  const invScale = 1 / Math.max(1, cameraScale);
  const pressScale = clicked ? 0.86 : 1;

  return (
    <div
      style={{
        position: 'absolute',
        left: curX,
        top: curY,
        pointerEvents: 'none',
        zIndex: 9999,
        transformOrigin: '0 0',
        transform: `scale(${invScale * pressScale})`,
      }}
    >
      {/* Expanding Click Ripple */}
      {clicked && (
        <>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 48,
              height: 48,
              borderRadius: '50%',
              backgroundColor: 'rgba(14, 165, 233, 0.28)',
              border: '2.5px solid #0EA5E9',
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 20px rgba(14, 165, 233, 0.65)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 22,
              height: 22,
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              transform: 'translate(-50%, -50%)',
            }}
          />
        </>
      )}

      {/* High-precision macOS/SaaS Pointer SVG */}
      <svg
        width="30"
        height="36"
        viewBox="0 0 24 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          filter: 'drop-shadow(0 6px 14px rgba(15, 23, 42, 0.55))',
          transform: 'translate(-2px, -2px)',
        }}
      >
        <path
          d="M2 2L9.5 25L13.8 16.2L22.5 14.5L2 2Z"
          fill="#0F172A"
          stroke="#FFFFFF"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      </svg>

      {label && (
        <div
          style={{
            position: 'absolute',
            left: 26,
            top: 22,
            backgroundColor: '#0F172A',
            color: '#F8FAFC',
            border: '1px solid rgba(14, 165, 233, 0.5)',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.35)',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};
