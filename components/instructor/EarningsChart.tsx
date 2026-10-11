"use client";

import { useEffect, useRef } from "react";
import { CURRENCY_DISPLAY_SYMBOL } from "@/lib/format";

/**
 * The Chart.js bar+line combo earnings.php renders. Chart.js 4.4.0 is loaded from
 * cdn.jsdelivr.net, a host already allowlisted in the CSP script-src, and the tooltip strings
 * keep their leading space exactly as the PHP emitted them.
 */
export default function EarningsChart({
  revenue,
  sales,
  year,
}: {
  revenue: number[];
  sales: number[];
  year: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    const render = () => {
      if (cancelled) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Chart = (window as any).Chart;
      if (!Chart) return;
      new Chart(canvas, {
        type: "bar",
        data: {
          labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
          datasets: [
            {
              label: "Revenue ($)",
              data: revenue,
              backgroundColor: "rgba(92, 110, 248, 0.80)",
              borderRadius: 6,
              borderSkipped: false,
              yAxisID: "yRev",
            },
            {
              label: "Sales",
              data: sales,
              type: "line",
              borderColor: "#f59e0b",
              backgroundColor: "rgba(245, 158, 11, 0.12)",
              tension: 0.4,
              pointBackgroundColor: "#f59e0b",
              pointRadius: 4,
              yAxisID: "ySales",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { position: "top", labels: { font: { size: 12 } } },
            tooltip: {
              callbacks: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                label: (ctx: any) => {
                  if (ctx.datasetIndex === 0) return ` ${CURRENCY_DISPLAY_SYMBOL}${ctx.parsed.y.toFixed(2)}`;
                  return ` ${ctx.parsed.y} sales`;
                },
              },
            },
          },
          scales: {
            yRev: {
              position: "left",
              beginAtZero: true,
              grid: { color: "rgba(0,0,0,0.06)" },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ticks: { callback: (v: any) => `${CURRENCY_DISPLAY_SYMBOL}${v}` },
            },
            ySales: { position: "right", beginAtZero: true, grid: { drawOnChartArea: false }, ticks: { stepSize: 1 } },
            x: { grid: { display: false } },
          },
        },
      });
    };

    if ((window as unknown as { Chart?: unknown }).Chart) {
      render();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
    return () => { cancelled = true; };
  }, [revenue, sales, year]);

  return (
    <div className="earn-chart-wrap">
      <canvas id="earnChart" aria-label="Monthly revenue bar chart" ref={canvasRef} />
    </div>
  );
}