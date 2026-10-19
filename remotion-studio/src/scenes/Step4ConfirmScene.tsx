import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { MouseCursor } from '../components/MouseCursor';
import { CalloutCard } from '../components/CalloutCard';

export const Step4ConfirmScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Mouse trajectory to submit button at (780, 520)
  const cursorX = interpolate(frame, [10, 60], [450, 780], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cursorY = interpolate(frame, [10, 60], [300, 520], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const isClicked = frame >= 60 && frame <= 72;
  const isSaved = frame >= 75;

  const toastProgress = spring({
    frame: frame - 75,
    fps,
    config: { damping: 14, stiffness: 90 },
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
        stepNumber={4}
        title="Kiểm Tra Giá Trị & Xác Nhận Đơn Bán"
        description="Kiểm tra tiền thuế VAT 10%, tiền chiết khấu và tổng thanh toán. Khi bấm Tạo Đơn, hệ thống tự động sinh mã SO và ghi nhận giữ chỗ tồn kho (Hold Stock)."
      />

      {/* Success Toast Notification */}
      {isSaved && (
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: '50%',
            transform: `translateX(-50%) translateY(${interpolate(toastProgress, [0, 1], [-50, 0])}px)`,
            backgroundColor: '#064E3B',
            border: '1px solid #059669',
            borderRadius: 10,
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(16, 185, 129, 0.3)',
            zIndex: 100,
            opacity: toastProgress,
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              backgroundColor: '#10B981',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            ✓
          </div>
          <div>
            <div style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 600 }}>
              Tạo đơn bán hàng thành công! Mã đơn: SO-2026-10-0089
            </div>
            <div style={{ color: '#A7F3D0', fontSize: 12, marginTop: 2 }}>
              Đã gửi thông báo đến Thủ kho và Kế toán công nợ.
            </div>
          </div>
        </div>
      )}

      {/* Main Order Summary Card */}
      <div style={{ padding: '24px 32px', boxSizing: 'border-box', maxWidth: 860 }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: '#F8FAFC' }}>
          Tổng Kết Giá Trị Đơn Hàng & Duyệt Đơn
        </h3>

        <div
          style={{
            backgroundColor: '#1E293B',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: 24,
          }}
        >
          {/* Summary rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#94A3B8' }}>
              <span>Tổng tiền hàng (18 chai rượu vang):</span>
              <span style={{ color: '#F8FAFC', fontWeight: 600 }}>240,840,000 đ</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#94A3B8' }}>
              <span>Chiết khấu thương mại (-5%):</span>
              <span style={{ color: '#10B981', fontWeight: 600 }}>-12,042,000 đ</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#94A3B8' }}>
              <span>Tiền hàng sau chiết khấu:</span>
              <span style={{ color: '#F8FAFC', fontWeight: 600 }}>228,798,000 đ</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#94A3B8' }}>
              <span>Thuế GTGT (VAT 10%):</span>
              <span style={{ color: '#F8FAFC', fontWeight: 600 }}>+22,879,800 đ</span>
            </div>

            <div
              style={{
                height: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                margin: '8px 0',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#F8FAFC' }}>TỔNG CỘNG THANH TOÁN:</span>
                <span style={{ display: 'block', fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  (Đã bao gồm thuế GTGT & chiết khấu hợp đồng)
                </span>
              </div>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#0891B2', letterSpacing: '-0.02em' }}>
                251,677,800 đ
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
              marginTop: 28,
              paddingTop: 20,
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: '#94A3B8',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Hủy / Đóng
            </div>

            <div
              style={{
                padding: '10px 28px',
                borderRadius: 8,
                backgroundColor: isSaved ? '#10B981' : '#0891B2',
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: isClicked
                  ? '0 0 0 4px rgba(8, 145, 178, 0.5)'
                  : '0 4px 14px rgba(8, 145, 178, 0.35)',
                transform: `scale(${isClicked ? 0.96 : 1})`,
                transition: 'all 0.1s ease',
              }}
            >
              <span>{isSaved ? '✓ Đã Lưu Đơn Hàng' : 'Tạo Đơn Bán Hàng'}</span>
            </div>
          </div>
        </div>
      </div>

      <MouseCursor x={cursorX} y={cursorY} isClicked={isClicked} />
    </div>
  );
};
