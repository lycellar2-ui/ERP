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

export const RealStep3ProductScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Exact DOM coordinates:
  // addLineBtn: { x: 1475, y: 449, width: 105, height: 26, cx: 1527, cy: 462 }
  // prodInput: { x: 674, y: 545, width: 299, height: 30, cx: 824, cy: 560 }
  // qtyInput: { x: 1077, y: 545, width: 56, height: 28, cx: 1105, cy: 559 }

  const zoomIn = spring({
    frame: frame - 10,
    fps,
    config: { damping: 24, stiffness: 80 },
  });
  const zoomOut = spring({
    frame: frame - 310,
    fps,
    config: { damping: 24, stiffness: 85 },
  });

  const scale = interpolate(zoomIn - zoomOut, [0, 1], [1, 1.25], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const focalX = interpolate(zoomIn, [0, 1], [800, 1130], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const focalY = interpolate(zoomIn, [0, 1], [450, 565], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 5 sequential real states for Step 3:
  // 0..38: step2c-customer-selected.png (before clicking + Thêm dòng)
  // 38..85: step3a-line-added.png (empty row added)
  // 85..155: step3b-product-dropdown.png (dropdown showing SKU stock & name)
  // 155..225: step3c-product-filled.png (first wine filled with HORECA price & SL: 6)
  // 225..345: step4-order-complete.png (second wine Alta Mora Etna Rosso x 12 added)

  const lineAddedOpacity = interpolate(frame, [36, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const dropdownOpacity = interpolate(frame, [82, 92], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const filled1Opacity = interpolate(frame, [150, 162], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const filled2Opacity = interpolate(frame, [225, 238], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <CameraViewport scale={scale} focalX={focalX} focalY={focalY}>
        <Img
          src={staticFile('step2c-customer-selected.png')}
          style={{ width: 1600, height: 900, display: 'block' }}
        />

        {lineAddedOpacity > 0 && (
          <Img
            src={staticFile('step3a-line-added.png')}
            style={{
              position: 'absolute',
              inset: 0,
              width: 1600,
              height: 900,
              opacity: lineAddedOpacity,
            }}
          />
        )}

        {dropdownOpacity > 0 && (
          <Img
            src={staticFile('step3b-product-dropdown.png')}
            style={{
              position: 'absolute',
              inset: 0,
              width: 1600,
              height: 900,
              opacity: dropdownOpacity,
            }}
          />
        )}

        {filled1Opacity > 0 && (
          <Img
            src={staticFile('step3c-product-filled.png')}
            style={{
              position: 'absolute',
              inset: 0,
              width: 1600,
              height: 900,
              opacity: filled1Opacity,
            }}
          />
        )}

        {filled2Opacity > 0 && (
          <Img
            src={staticFile('step4-order-complete.png')}
            style={{
              position: 'absolute',
              inset: 0,
              width: 1600,
              height: 900,
              opacity: filled2Opacity,
            }}
          />
        )}

        {/* Highlight 1: + Thêm dòng button */}
        <HighlightBox
          x={1475}
          y={449}
          width={105}
          height={26}
          startFrame={8}
          endFrame={40}
          label="Click + Thêm dòng"
          labelPosition="left"
          borderRadius={6}
        />

        {/* Highlight 2: Product dropdown with live Available Stock */}
        <HighlightBox
          x={674}
          y={334}
          width={360}
          height={242}
          startFrame={88}
          endFrame={152}
          label="Tra cứu SKU & Tồn kho Khả dụng (Tồn: 24 chai)"
          labelPosition="top"
          borderRadius={8}
        />

        {/* Highlight 3: Auto-filled Price List by Channel & Line Total */}
        <HighlightBox
          x={662}
          y={530}
          width={916}
          height={185}
          startFrame={165}
          endFrame={315}
          label="Tự động áp Giá Kênh HORECA & Tính Thành tiền"
          labelPosition="top"
          color="#10B981"
          borderRadius={8}
        />

        <MouseCursor
          keyframes={[
            { frame: 0, x: 1350, y: 462 },
            { frame: 26, x: 1527, y: 462 },
            { frame: 35, x: 1527, y: 462, click: true },
            { frame: 68, x: 824, y: 560 },
            { frame: 80, x: 824, y: 560, click: true },
            { frame: 125, x: 824, y: 472 },
            { frame: 148, x: 824, y: 472, click: true },
            { frame: 185, x: 1105, y: 559 },
            { frame: 215, x: 1527, y: 462, click: true },
            { frame: 280, x: 1410, y: 650 },
          ]}
          cameraScale={scale}
        />
      </CameraViewport>

      {/* Callout Card placed cleanly on the left dimmed backdrop */}
      <CalloutCard
        stepNumber="BƯỚC 03 / 04"
        title="Thêm Sản phẩm & Áp Bảng giá Tự động"
        description="Nhấn '+ Thêm dòng' và chọn rượu vang theo mã SKU. Hệ thống hiển thị tồn kho khả dụng ngay trong danh sách và tự động điền Đơn giá chuẩn theo kênh HORECA."
        badgeText="2 SKU • 18 Chai • Giá Kênh HORECA"
        keyTakeaway="Nhập Số lượng & Chiết khấu (%) — Thành tiền tự động tính"
        startFrame={10}
        endFrame={335}
        position={{ bottom: 28, left: 28 }}
        width={410}
      />
    </AbsoluteFill>
  );
};
