import React from 'react';

interface BrowserFrameProps {
  children: React.ReactNode;
  url?: string;
  title?: string;
}

export const BrowserFrame: React.FC<BrowserFrameProps> = ({
  children,
  url = 'erp.lyscellars.vn/dashboard/sales',
  title = "LY's Cellars — Hệ Thống ERP Quản Lý Nhập Khẩu & Phân Phối Rượu Vang",
}) => {
  return (
    <div
      style={{
        width: 1600,
        height: 940,
        backgroundColor: '#0F172A',
        borderRadius: 16,
        boxShadow:
          '0 32px 70px -12px rgba(0, 0, 0, 0.78), 0 0 0 1px rgba(255, 255, 255, 0.12), 0 0 50px rgba(8, 145, 178, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Top macOS Studio Header (40px) */}
      <div
        style={{
          height: 40,
          backgroundColor: '#0F172A',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        {/* Window controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 260 }}>
          <div style={{ width: 11, height: 11, borderRadius: '50%', backgroundColor: '#EF4444' }} />
          <div style={{ width: 11, height: 11, borderRadius: '50%', backgroundColor: '#F59E0B' }} />
          <div style={{ width: 11, height: 11, borderRadius: '50%', backgroundColor: '#10B981' }} />
          <span style={{ marginLeft: 10, fontSize: 11, color: '#64748B', fontWeight: 600, letterSpacing: '0.03em' }}>
            WINE ERP v2.6
          </span>
        </div>

        {/* Clean Address Bar (No raw emojis) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#1E293B',
            border: '1px solid rgba(255, 255, 255, 0.09)',
            borderRadius: 6,
            padding: '4px 16px',
            fontSize: 12,
            color: '#CBD5E1',
            width: 420,
            justifyContent: 'center',
            gap: 8,
            fontWeight: 500,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>{url}</span>
        </div>

        {/* Right Title */}
        <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500, width: 260, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </div>
      </div>

      {/* Exact 1600x900 Screen Area */}
      <div style={{ width: 1600, height: 900, position: 'relative', overflow: 'hidden', backgroundColor: '#F8FAFC' }}>
        {children}
      </div>
    </div>
  );
};
