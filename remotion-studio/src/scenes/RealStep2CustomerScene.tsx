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

export const RealStep2CustomerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Exact DOM coordinates:
  // custInput: { x: 691, y: 194, width: 344, height: 36, cx: 863, cy: 212 }
  // custOption: { x: 691, y: 238, width: 344, height: 74, cx: 820, cy: 268 }
  // creditCard: { x: 662, y: 248, width: 914, height: 110 }

  const zoomIn = spring({
    frame: frame - 10,
    fps,
    config: { damping: 24, stiffness: 80 },
  });
  const zoomOut = spring({
    frame: frame - 265,
    fps,
    config: { damping: 24, stiffness: 85 },
  });

  const scale = interpolate(zoomIn - zoomOut, [0, 1], [1, 1.24], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Shift focus slightly down once customer is selected to showcase the Credit Limit & Address box
  const focusShift = spring({
    frame: frame - 120,
    fps,
    config: { damping: 24, stiffness: 80 },
  });

  const focalX = interpolate(zoomIn, [0, 1], [800, 1120], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const focalY = interpolate(focusShift, [0, 1], [235, 290], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Crossfades between the 3 captured states:
  // 0..42: step2a-drawer-empty.png
  // 42..118: step2b-customer-search.png (search "Fabrik" + dropdown)
  // 118..300: step2c-customer-selected.png (Fabrik Restaurant selected + credit limit card)
  const searchOpacity = interpolate(frame, [40, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const selectedOpacity = interpolate(frame, [115, 126], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <CameraViewport scale={scale} focalX={focalX} focalY={focalY}>
        <Img
          src={staticFile('step2a-drawer-empty.png')}
          style={{ width: 1600, height: 900, display: 'block' }}
        />

        {searchOpacity > 0 && (
          <Img
            src={staticFile('step2b-customer-search.png')}
            style={{
              position: 'absolute',
              inset: 0,
              width: 1600,
              height: 900,
              opacity: searchOpacity,
            }}
          />
        )}

        {selectedOpacity > 0 && (
          <Img
            src={staticFile('step2c-customer-selected.png')}
            style={{
              position: 'absolute',
              inset: 0,
              width: 1600,
              height: 900,
              opacity: selectedOpacity,
            }}
          />
        )}

        {/* Highlight 1: Search input field */}
        <HighlightBox
          x={691}
          y={194}
          width={344}
          height={36}
          startFrame={10}
          endFrame={46}
          label="Tìm tên hoặc mã Khách hàng"
          labelPosition="top"
          borderRadius={6}
        />

        {/* Highlight 2: Dropdown result */}
        <HighlightBox
          x={691}
          y={238}
          width={344}
          height={68}
          startFrame={50}
          endFrame={115}
          label="Chọn KH: [HR10071-01] Fabrik Restaurant"
          labelPosition="right"
          borderRadius={6}
        />

        {/* Highlight 3: Auto-loaded AR Credit Limit & Channel Info */}
        <HighlightBox
          x={662}
          y={246}
          width={916}
          height={114}
          startFrame={130}
          endFrame={275}
          label="Tự động kiểm tra Hạn mức Tín dụng & Công nợ AR"
          labelPosition="bottom"
          color="#10B981"
          borderRadius={8}
        />

        <MouseCursor
          keyframes={[
            { frame: 0, x: 1150, y: 260 },
            { frame: 32, x: 863, y: 212 },
            { frame: 38, x: 863, y: 212, click: true },
            { frame: 85, x: 820, y: 268 },
            { frame: 112, x: 820, y: 268, click: true },
            { frame: 165, x: 1120, y: 330 },
            { frame: 260, x: 1527, y: 462 },
          ]}
          cameraScale={scale}
        />
      </CameraViewport>

      {/* Callout Card placed on the left dimmed backdrop (x: 28..438), zero overlap with Drawer (x: 640..1600) */}
      <CalloutCard
        stepNumber="BƯỚC 02 / 04"
        title="Chọn Khách hàng & Kiểm soát Công nợ"
        description="Gõ tên hoặc mã khách hàng vào ô tìm kiếm. Ngay khi chọn, hệ thống tự động tải Địa chỉ giao hàng mặc định, Kênh giá (HORECA) và Điều khoản thanh toán (NET30)."
        badgeText="Kiểm tra Hạn mức Tín dụng Tức thời"
        keyTakeaway="Cảnh báo ngay nếu khách hàng vượt hạn mức nợ cho phép"
        startFrame={10}
        endFrame={290}
        position={{ bottom: 28, left: 28 }}
        width={410}
      />
    </AbsoluteFill>
  );
};
