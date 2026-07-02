import { useRef, useState, useEffect, type CSSProperties, type ReactNode } from "react";

interface PagedPreviewProps {
  id: string;
  children: ReactNode;
  style?: CSSProperties;
  pageHeight?: number;
}

const A4_HEIGHT = 1123;

export function PagedPreview({ id, children, style, pageHeight = A4_HEIGHT }: PagedPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const h = el.scrollHeight;
      setTotalPages(Math.max(1, Math.ceil(h / pageHeight)));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageHeight]);

  const pageBreaks: ReactNode[] = [];
  for (let i = 1; i < totalPages; i++) {
    pageBreaks.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: -4,
          right: -4,
          top: i * pageHeight - 10,
          height: 20,
          background: "#e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        <div style={{
          fontSize: 10,
          color: "#64748b",
          fontWeight: 700,
          background: "#e2e8f0",
          padding: "2px 12px",
          borderRadius: 6,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}>
          Página {i} ↓ Página {i + 1}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginBottom: 14,
      }}>
        <div style={{
          background: totalPages > 1 ? "#fef3c7" : "#ecfdf5",
          border: `1px solid ${totalPages > 1 ? "#f59e0b" : "#10b981"}`,
          borderRadius: 10,
          padding: "6px 16px",
          fontSize: 13,
          fontWeight: 700,
          color: totalPages > 1 ? "#92400e" : "#065f46",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}>
          <span>{totalPages > 1 ? "📄" : "📄"}</span>
          {totalPages === 1
            ? "1 página"
            : `${totalPages} páginas`
          }
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <div
          id={id}
          ref={containerRef}
          style={{
            ...style,
            minHeight: pageHeight,
          }}
        >
          {children}
        </div>
        {pageBreaks}
      </div>
    </div>
  );
}
