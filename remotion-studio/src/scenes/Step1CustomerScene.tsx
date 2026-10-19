import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { MouseCursor } from '../components/MouseCursor';
import { CalloutCard } from '../components/CalloutCard';

export const Step1CustomerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Mouse trajectory
  // Moves from (900, 700) to customer search input at (420, 240)
  const cursorX = interpolate(frame, [10, 60], [900, 420], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cursorY = interpolate(frame, [10, 60], [700, 240], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Click at frame 65-75
  const isClicked = frame >= 65 && frame <= 78;

  // Dropdown appearance at frame 75
  const showDropdown = frame >= 75 && frame <= 140;

  // Move cursor down to select item in dropdown
  const cursorSelectY = interpolate(frame, [90, 120], [240, 310], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const isSelectClicked = frame >= 125 && frame <= 138;

  // Selected customer confirmed after frame 140
  const isConfirmed = frame >= 140;

  // Camera zoom effect on customer section
  const zoomScale = interpolate(frame, [0, 40, 200, 230], [1, 1.05, 1.05, 1], {
    extrapolateRight: 'clamp',
  });
  const panX = interpolate(frame, [0, 40, 200, 230], [0, -30, -30, 0], {
    extrapolateRight: 'clamp',
  });
  const panY = interpolate(frame, [0, 40, 200, 230], [0, -20, -20, 0], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#0F172A',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <CalloutCard
        stepNumber={1}
        title="Chọn Khách Hàng & Kiểm Tra Tín Dụng"
        description="Hệ thống tự động đồng bộ kênh phân phối (HORECA), kiểm tra số dư công nợ và hạn mức nợ khả dụng trước khi tiếp tục."
      />

      <div
        style={{
          width: '100%',
          height: '100%',
          transform: `scale(${zoomScale}) translate(${panX}px, ${panY}px)`,
          transformOrigin: '35% 30%',
          transition: 'transform 0.1s ease-out',
          padding: '24px 32px',
          boxSizing: 'border-box',
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: 16,
            marginBottom: 24,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#F8FAFC' }}>
              Tạo Đơn Bán Hàng Mới (SO)
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748B' }}>
              Mã dự thảo: SO-2026-DRAFT · Loại: Bán Buôn Phân Phối
            </p>
          </div>
          <div
            style={{
              backgroundColor: 'rgba(8, 145, 178, 0.12)',
              border: '1px solid rgba(8, 145, 178, 0.3)',
              borderRadius: 8,
              padding: '6px 14px',
              color: '#0891B2',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            KÊNH HORECA
          </div>
        </div>

        {/* Form Container */}
        <div style={{ maxWidth: 840 }}>
          {/* Customer Selection Row */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: '#CBD5E1',
                marginBottom: 8,
              }}
            >
              Khách Hàng / Điểm Bán <span style={{ color: '#EF4444' }}>*</span>
            </label>

            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: '100%',
                  height: 44,
                  backgroundColor: '#1E293B',
                  border: isClicked || showDropdown ? '1px solid #0891B2' : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 16px',
                  boxShadow: isClicked ? '0 0 0 3px rgba(8, 145, 178, 0.25)' : 'none',
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ fontSize: 14, color: isConfirmed ? '#F8FAFC' : '#94A3B8', fontWeight: isConfirmed ? 600 : 400 }}>
                  {isConfirmed
                    ? 'Khách sạn Daewoo Hà Nội — 360 Kim Mã, Ba Đình (KH-HORECA-0012)'
                    : frame >= 65
                    ? 'Daewoo'
                    : 'Nhập tên khách hàng, mã KH hoặc số điện thoại...'}
                </span>
              </div>

              {/* Dropdown Options */}
              {showDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: 48,
                    left: 0,
                    right: 0,
                    backgroundColor: '#1E293B',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 8,
                    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.5)',
                    zIndex: 100,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '12px 16px',
                      backgroundColor: isSelectClicked ? 'rgba(8, 145, 178, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#F8FAFC' }}>
                      Khách sạn Daewoo Hà Nội (KH-HORECA-0012)
                    </div>
                    <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                      MST: 0100108920 · 360 Kim Mã, Ba Đình, Hà Nội
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '12px 16px',
                      color: '#64748B',
                      fontSize: 13,
                    }}
                  >
                    Khách sạn InterContinental Hanoi Landmark72
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Customer AR Balance & Credit Box (Shown after confirmation) */}
          {isConfirmed && (
            <div
              style={{
                backgroundColor: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: 10,
                padding: '14px 18px',
                marginBottom: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                opacity: interpolate(frame, [140, 155], [0, 1]),
                transform: `translateY(${interpolate(frame, [140, 155], [8, 0])}px)`,
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 2 }}>
                  Tình trạng hạn mức tín dụng khách hàng
                </div>
                <div style={{ fontSize: 14, color: '#E2E8F0', fontWeight: 600 }}>
                  Hạn mức: <span style={{ color: '#F8FAFC' }}>200,000,000 đ</span> · Dư nợ: <span style={{ color: '#F59E0B' }}>45,000,000 đ</span> · Khả dụng: <span style={{ color: '#10B981' }}>155,000,000 đ</span>
                </div>
              </div>
              <div
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#10B981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '4px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                HẠN MỨC HỢP LỆ
              </div>
            </div>
          )}

          {/* Legal Entity & Channel Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#94A3B8', marginBottom: 6 }}>
                Pháp Nhân Xuất Hóa Đơn
              </label>
              <div
                style={{
                  backgroundColor: '#1E293B',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: '#CBD5E1',
                  fontSize: 13,
                }}
              >
                Công ty TNHH Ly\'s Cellars Việt Nam
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#94A3B8', marginBottom: 6 }}>
                Chính Sách Bảng Giá Mặc Định
              </label>
              <div
                style={{
                  backgroundColor: '#1E293B',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: '#0891B2',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Bảng Giá Kênh HORECA 2026 (-10%)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mouse Cursor */}
      <MouseCursor
        x={cursorX}
        y={frame >= 90 && frame < 140 ? cursorSelectY : cursorY}
        isClicked={isClicked || isSelectClicked}
      />
    </div>
  );
};
