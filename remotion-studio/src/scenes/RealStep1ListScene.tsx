import React from 'react';
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { CameraViewport } from '../components/CameraViewport';
import { MouseCursor } from '../components/MouseCursor';
import { CalloutCard } from '../components/CalloutCard';
import { HighlightBox } from '../components/HighlightBox';

export const RealStep1ListScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Exact coordinates from DOM capture:
  // createBtn: { x: 1440, y: 58, width: 144, height: 36, cx: 1512, cy: 76 }
  const btnClicked = frame >= 66;

  // Smoothly zoom in toward the top-right "+ Tạo Đơn Hàng" button, then pull back when drawer opens
  const zoomIn = spring({
    frame: frame - 14,
    fps,
    config: { damping: 24, stiffness: 80 },
  });
  const zoomOut = spring({
    frame: frame - 74,
    fps,
    config: { damping: 24, stiffness: 85 },
  });

  const scale = interpolate(zoomIn - zoomOut * 0.85, [0, 1], [1, 1.32], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const focalX = interpolate(zoomIn, [0, 1], [800, 1380], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const focalY = interpolate(zoomIn, [0, 1], [450, 140], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Crossfade to drawer opened state right after click
  const drawerProgress = interpolate(frame, [68, 82], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <CameraViewport scale={scale} focalX={focalX} focalY={focalY}>
        <Img
          src={staticFile('step1-sales-list.png')}
          style={{
            width: 1600,
            height: 900,
            display: 'block',
          }}
        />
        {drawerProgress > 0 && (
          <Img
            src={staticFile('step2a-drawer-empty.png')}
            style={{
              position: 'absolute',
              inset: 0,
              width: 1600,
              height: 900,
              opacity: drawerProgress,
            }}
          />
        )}

        <HighlightBox
          x={1440}
          y={58}
          width={144}
          height={36}
          startFrame={18}
          endFrame={68}
          label="Click + Tạo Đơn Hàng"
          labelPosition="left"
          borderRadius={8}
        />

        <MouseCursor
          keyframes={[
            { frame: 0, x: 960, y: 460 },
            { frame: 48, x: 1512, y: 76 },
            { frame: 66, x: 1512, y: 76, click: true },
            { frame: 110, x: 1120, y: 240 },
          ]}
          cameraScale={scale}
        />
      </CameraViewport>

      {/* Callout Card placed cleanly at bottom-left, never obstructing the header or table rows */}
      <CalloutCard
        stepNumber="BƯỚC 01 / 04"
        title="Mở phân hệ Đơn Bán Hàng (Sales Order)"
        description="Từ thanh điều hướng bên trái, truy cập mục Bán Hàng (SO) để theo dõi KPI doanh thu, trạng thái đơn và nhấn nút '+ Tạo Đơn Hàng' ở góc phải trên cùng."
        badgeText="Tự động cấp mã SO-YYMM-XXXX"
        keyTakeaway="Phím tắt thao tác nhanh tại góc trên bên phải màn hình"
        startFrame={8}
        endFrame={142}
        position={{ bottom: 28, left: 28 }}
        width={430}
      />
    </AbsoluteFill>
  );
};
