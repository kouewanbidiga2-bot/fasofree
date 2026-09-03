import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CrosshairMode, AreaSeries, LineSeries, HistogramSeries } from 'lightweight-charts';

const BrandChart = ({
  data = [],
  type = 'area',
  title = '',
  height = 300,
  colors = { line: '#C1652E', top: 'rgba(193,101,46,0.28)', bottom: 'rgba(193,101,46,0.02)' },
  formatValue = (v) => `${v?.toLocaleString()} FCFA`,
}) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }
    if (tooltipRef.current && tooltipRef.current.parentNode) {
      tooltipRef.current.parentNode.removeChild(tooltipRef.current);
      tooltipRef.current = null;
    }

    const container = chartContainerRef.current;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#74695F',
        fontFamily: "'Manrope', sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(193,101,46,0.06)' },
        horzLines: { color: 'rgba(193,101,46,0.06)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(193,101,46,0.3)', width: 1, style: 2 },
        horzLine: { color: 'rgba(193,101,46,0.3)', width: 1, style: 2 },
      },
      rightPriceScale: { borderColor: 'rgba(193,101,46,0.1)' },
      timeScale: { borderColor: 'rgba(193,101,46,0.1)', timeVisible: false },
      width: container.clientWidth,
      height,
    });

    chartRef.current = chart;

    const toolTip = document.createElement('div');
    toolTip.style.cssText = `
      position: absolute; z-index: 100; pointer-events: none;
      background: #29231e; color: #fff; padding: 8px 12px;
      border-radius: 8px; font-size: 11px; font-family: Manrope, sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: none;
    `;
    container.appendChild(toolTip);
    tooltipRef.current = toolTip;

    let series;
    if (type === 'area') {
      series = chart.addSeries(AreaSeries, {
        lineColor: colors.line,
        topColor: colors.top,
        bottomColor: colors.bottom,
        lineWidth: 2,
        priceFormat: { type: 'custom', formatter: (v) => formatValue(v) },
      });
    } else if (type === 'line') {
      series = chart.addSeries(LineSeries, {
        color: colors.line,
        lineWidth: 2,
        priceFormat: { type: 'custom', formatter: (v) => formatValue(v) },
      });
    } else {
      series = chart.addSeries(HistogramSeries, {
        color: colors.line,
        priceFormat: { type: 'custom', formatter: (v) => formatValue(v) },
      });
    }

    series.setData(data);

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        toolTip.style.display = 'none';
        return;
      }
      const d = param.seriesData.get(series);
      const value = d ? formatValue(d.value ?? d) : '-';
      toolTip.innerHTML = `
        <div style="font-weight:600;margin-bottom:4px;color:#C1652E">${param.time}</div>
        <div>${value}</div>
      `;
      toolTip.style.display = 'block';
      toolTip.style.left = `${Math.min(param.point.x + 16, container.clientWidth - 150)}px`;
      toolTip.style.top = `${Math.max(param.point.y - 40, 8)}px`;
    });

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (container) chart.applyOptions({ width: container.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      if (tooltipRef.current && tooltipRef.current.parentNode) {
        tooltipRef.current.parentNode.removeChild(tooltipRef.current);
        tooltipRef.current = null;
      }
    };
  }, [data, type, height, colors, formatValue]);

  return (
    <div className="bg-background-card rounded-xl border border-border-light overflow-hidden">
      {title && (
        <div className="px-5 pt-4 pb-2">
          <h3 className="text-sm font-bold text-text-primary">{title}</h3>
        </div>
      )}
      <div ref={chartContainerRef} className="w-full" />
      {data.length === 0 && (
        <div className="flex items-center justify-center py-12 text-text-tertiary text-sm">
          Aucune donnée pour cette période
        </div>
      )}
    </div>
  );
};

export default BrandChart;
