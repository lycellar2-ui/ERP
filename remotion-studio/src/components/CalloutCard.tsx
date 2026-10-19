import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface CalloutCardProps {
  stepNumber: number | string;
  title: string;
  description: string;
  badge?: string;
  badgeText?: string;
  keyTakeaway?: string;
  align?: 'left' | 'right';
  verticalAlign?: 'top' | 'bottom';
  position?: { top?: number; bottom?: number; left?: number; right?: number };
  width?: number;
  startFrame?: number;
  endFrame?: number;
}

export const CalloutCard: React.FC<CalloutCardProps> = ({
  stepNumber,
  title,
  description,
  badge,
  badgeText,
  keyTakeaway,
  align = 'left',
  verticalAlign = 'bottom',
  position,
  width = 400,
  startFrame = 0,
  endFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 18, stiffness: 120 },
  });

  let exitOpacity = 1;
  if (endFrame !== undefined) {
    exitOpacity = interpolate(frame, [endFrame - 10, endFrame], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  }

  const finalOpacity = Math.min(enter, exitOpacity);
  if (finalOpacity <= 0.01) return null;

  const posStyle: React.CSSProperties = position
    ? position
    : {
        ...(verticalAlign === 'bottom' ? { bottom: 28 } : { top: 28 }),
        ...(align === 'left' ? { left: 28 } : { right: 28 }),
      };

  const stepLabel =
    typeof stepNumber === 'number' ? `BƯỚC 0${stepNumber} / 04` : stepNumber;
  const activeBadge = badgeText ?? badge ?? 'HƯỚNG DẪN THAO TÁC';

  return (
    <div
      style={{
        position: 'absolute',
        ...posStyle,
        width,
        backgroundColor: 'rgba(11, 19, 32, 0.96)',
        border: '1px solid rgba(56, 189, 248, 0.38)',
        borderLeft: '4px solid #0EA5E9',
        borderRadius: 12,
        padding: '18px 22px',
        boxShadow: '0 24px 48px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.06)',
        zIndex: 80,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        opacity: finalOpacity,
        transform: `translateY(${(1 - enter) * 18}px)`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#38BDF8',
            backgroundColor: 'rgba(14, 165, 233, 0.16)',
            border: '1px solid rgba(56, 189, 248, 0.28)',
            padding: '3px 9px',
            borderRadius: 5,
          }}
        >
          {activeBadge}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#94A3B8',
            fontFamily: 'monospace',
          }}
        >
          {stepLabel}
        </span>
      </div>

      <h3
        style={{
          margin: '0 0 8px 0',
          fontSize: 16,
          fontWeight: 700,
          color: '#F8FAFC',
          lineHeight: '22px',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: '19px',
          color: '#CBD5E1',
        }}
      >
        {description}
      </p>

      {keyTakeaway && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11.5,
            color: '#34D399',
            fontWeight: 600,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: '#10B981',
              flexShrink: 0,
            }}
          />
          <span>{keyTakeaway}</span>
        </div>
      )}
    </div>
  );
};
