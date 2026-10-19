import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { MouseCursor } from '../components/MouseCursor';
import { CalloutCard } from '../components/CalloutCard';

export const Step3DeliveryScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Mouse trajectory: checks delivery date & select warehouse
  const cursorX = interpolate(frame, [10, 60, 110, 160], [300, 380, 520, 680], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cursorY = interpolate(frame, [10, 60, 110, 160], [500, 220, 220, 360], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const isClicked = (frame >= 60 && frame <= 70) || (frame >= 160 && frame <= 170);

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
        stepNumber={3}
        title="Kho Xuất & Điều Kiện Vận Chuyển"
        description="Chọn đúng kho bảo quản tiêu chuẩn (16°C) và ghi nhận thời gian nhận hàng của bộ phận F&B để đảm bảo chất lượng rượu vang cao cấp."
      />

      <div style={{ padding: '24px 32px', boxSizing: 'border-box', maxWidth: 860 }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: '#F8FAFC' }}>
          Thông Tin Giao Hàng & Kho Xuất Hàng
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Warehouse */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>
              Kho Xuất Hàng <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div
              style={{
                backgroundColor: '#1E293B',
                border: isClicked && frame < 90 ? '1px solid #0891B2' : '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 8,
                padding: '10px 14px',
                color: '#F8FAFC',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Kho Tổng Hà Nội (Kho Lạnh 16°C - KHO-HN-01)
            </div>
          </div>

          {/* Delivery Date */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>
              Thời Gian Giao Dự Kiến <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div
              style={{
                backgroundColor: '#1E293B',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 8,
                padding: '10px 14px',
                color: '#F8FAFC',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              18/10/2026 · Ca sáng (09:00 - 11:30)
            </div>
          </div>

          {/* Delivery Address */}
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>
              Địa Chỉ Giao Hàng (Tự động lấy theo chi nhánh khách hàng)
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
              360 Kim Mã, Phường Giảng Võ, Quận Ba Đình, Hà Nội (Bộ phận F&B tiếp nhận tại sảnh B2)
            </div>
          </div>

          {/* Receiver Contact */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>
              Người Tiếp Nhận & SĐT
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
              Anh Nguyễn Văn Minh (F&B Manager) · 0912.345.678
            </div>
          </div>

          {/* Payment Terms */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>
              Điều Khoản Thanh Toán
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
              Công Nợ Net 30 Ngày (Hợp Đồng Số: HĐ-2026/DW-LC)
            </div>
          </div>
        </div>
      </div>

      <MouseCursor x={cursorX} y={cursorY} isClicked={isClicked} />
    </div>
  );
};
