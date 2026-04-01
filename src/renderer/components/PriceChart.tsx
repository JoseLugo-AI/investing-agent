import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, CandlestickData, Time } from 'lightweight-charts';
import type { Bar } from '../types';

interface Props {
  symbol: string | null;
  bars: Bar[];
}

function toChartData(bars: Bar[]): CandlestickData<Time>[] {
  return bars.map((b) => ({
    time: (new Date(b.t).getTime() / 1000) as Time,
    open: b.o,
    high: b.h,
    low: b.l,
    close: b.c,
  }));
}

export function PriceChart({ symbol, bars }: Props): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || !symbol) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 300,
      layout: {
        background: { color: '#1a1d27' },
        textColor: '#8b8fa3',
      },
      grid: {
        vertLines: { color: '#2a2d3a' },
        horzLines: { color: '#2a2d3a' },
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    series.setData(toChartData(bars));
    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [symbol, bars]);

  if (!symbol) {
    return <div className="chart-placeholder">Select a position to view chart</div>;
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">{symbol}</h3>
      <div ref={containerRef} className="chart-canvas" />
    </div>
  );
}
