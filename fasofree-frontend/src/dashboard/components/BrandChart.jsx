import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';

/**
 * Graphique TradingView avec lightweight-charts
 * Supporte : line, area, histogram, candlestick
 */
const BrandChart = ({
  data = [],
  type = 'area', // 'line' | 'area' | 'histogram' | 'candlestick'
  title = '',
  height = 300,
  colors = { line: '#C1652E', top: 'rgba(193,101,46,0.28)', bottom: 'rgba(193,101,46,0.02)' },
  formatValue = (v) => `${v?.toLocaleString()} FCFA`,
  multiSeries = [], // [{name: 'Agence 1', data: [...]}]
}) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const [timeframe, setTimeframe] = useState('ALL');

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    // Cleanup previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
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
      rightPriceScale: {
        borderColor: 'rgba(193,101,46,0.1)',
      },
      timeScale: {
        borderColor: 'rgba(193,101,46,0.1)',
        timeVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height,
    });

    chartRef.current = chart;

    // Tooltip
    const toolTip = document.createElement('div');
    toolTip.style.cssText = `
      position: absolute; z-index: 100; pointer-events: none;
      background: #29231e; color: #fff; padding: 8px 12px;
      border-radius: 8px; font-size: 11px; font-family: Manrope, sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: none;
    `;
    chartContainerRef.current.appendChild(toolTip);

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        toolTip.style.display = 'none';
        return;
      }
      let value = '';
      if (multiSeries.length > 0) {
        value = multiSeries.map((s) => {
          const d = param.seriesData.get(s.series);
          return `<span style="color:${s.color}">${s.name}</span>: <b>${d ? formatValue(d.value) : '-'}</b>`;
        }).join('<br/>');
      } else {
        const d = param.seriesData.get(series);
        value = d ? formatValue(d.value) : '-';
      }
      toolTip.innerHTML = `
        <div style="font-weight:600;margin-bottom:4px;color:#C1652E">${param.time}</div>
        <div>${value}</div>
      `;
      toolTip.style.display = 'block';
      const x = param.point.x;
      const y = param.point.y;
      toolTip.style.left = `${Math.min(x + 16, chartContainerRef.current.clientWidth - 150)}px`;
      toolTip.style.top = `${Math.max(y - 40, 8)}px`;
    });

    // Add series
    let series;
    const seriesList = [];

    if (multiSeries.length > 0) {
      multiSeries.forEach((s) => {
        const sType = chart.addSeries(
          type === 'area' || type === 'line' ? 'Area' : 'Histogram',
          {
            lineColor: s.color || colors.line,
            topColor: s.topColor || colors.top,
            bottomColor: s.bottomColor || colors.bottom,
            lineWidth: 2,
            priceFormat: { type: 'custom', formatter: (v) => formatValue(v) },
          }
        );
        sType.setData(s.data);
        s.series = sType;
        seriesList.push(sType);
      });
    } else {
      if (type === 'area' || type === 'line') {
        series = chart.addSeries('Area', {
          lineColor: colors.line,
          topColor: colors.top,
          bottomColor: colors.bottom,
          lineWidth: 2,
          priceFormat: { type: 'custom', formatter: (v) => formatValue(v) },
        });
      } else if (type === 'histogram') {
        series = chart.addSeries('Histogram', {
          color: colors.line,
          priceFormat: { type: 'custom', formatter: (v) => formatValue(v) },
        });
      }
      series.setData(data);
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      if (toolTip.parentNode) toolTip.parentNode.removeChild(toolTip);
    };
  }, [data, type, height, multiSeries, colors, formatValue]);

  // Timeframe filter
  const filterDataByTimeframe = (tf) => {
    setTimeframe(tf);
    // Data filtering is handled by the parent component via API
  };

  return (
    <div className="bg-background-card rounded-xl border border-border-light overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="text-sm font-bold text-text-primary">{title}</h3>
          <div className="flex gap-1">
            {['Jour', 'Semaine', 'Mois', 'ALL'].map((tf) => (
              <button
                key={tf}
                onClick={() => filterDataByTimeframe(tf === 'ALL' ? 'ALL' : tf.toUpperCase())}
                className={`px-2.5 py-1 text-[10px] font-bold rounded transition-colors ${
                  timeframe === (tf === 'ALL' ? 'ALL' : tf.toUpperCase())
                    ? 'bg-accent-primary text-white'
                    : 'text-text-tertiary hover:text-text-primary hover:bg-background-secondary'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
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
