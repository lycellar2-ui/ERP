import React, { createContext, useContext } from 'react';

const CameraScaleContext = createContext<number>(1);

export const useCameraScale = () => useContext(CameraScaleContext);

interface CameraViewportProps {
  scale: number;
  focalX: number;
  focalY: number;
  children: React.ReactNode;
}

export const CameraViewport: React.FC<CameraViewportProps> = ({
  scale,
  focalX,
  focalY,
  children,
}) => {
  const W = 1600;
  const H = 900;
  const safeScale = Math.max(1, scale);

  const rawTx = W / 2 - focalX * safeScale;
  const rawTy = H / 2 - focalY * safeScale;

  // Strictly clamp translation so the 1600x900 canvas always covers 100% of the viewport (zero black bars)
  const tx = Math.max(W * (1 - safeScale), Math.min(0, rawTx));
  const ty = Math.max(H * (1 - safeScale), Math.min(0, rawTy));

  return (
    <CameraScaleContext.Provider value={safeScale}>
      <div
        style={{
          width: W,
          height: H,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#F8FAFC',
        }}
      >
        <div
          style={{
            width: W,
            height: H,
            position: 'absolute',
            top: 0,
            left: 0,
            transformOrigin: '0 0',
            transform: `translate3d(${tx}px, ${ty}px, 0) scale(${safeScale})`,
            willChange: 'transform',
          }}
        >
          {children}
        </div>
      </div>
    </CameraScaleContext.Provider>
  );
};
