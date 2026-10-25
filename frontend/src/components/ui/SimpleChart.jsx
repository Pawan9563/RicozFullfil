import React from "react";

const PALETTE = ["#167d6a", "#df8f3b", "#4779a8", "#bb584c", "#8b6d9b", "#8b9b45"];

export const SimpleChart = ({ title, data = [], labelKey, valueKey, type = "bar", formatter = (value) => value }) => {
  const rows = data.filter((item) => Number.isFinite(Number(item[valueKey])));
  const max = Math.max(1, ...rows.map((item) => Number(item[valueKey])));
  const points = rows.map((item, index) => ({
    x: rows.length < 2 ? 50 : 8 + (index / (rows.length - 1)) * 84,
    y: 86 - (Number(item[valueKey]) / max) * 70,
    value: Number(item[valueKey]),
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <section className="card chart-panel" aria-label={title}>
      <h2 className="section-title">{title}</h2>
      {!rows.length ? <p className="empty-state">No data available</p> : (
        type === "line" ? (
          <div className="line-chart-wrap">
            <svg className="line-chart" viewBox="0 0 100 100" role="img" aria-label={`${title} trend chart`}>
              {[20, 42, 64, 86].map((y) => <line key={y} x1="6" x2="94" y1={y} y2={y} className="chart-gridline" />)}
              <polyline points={line} className="chart-line" />
              {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="1.8" className="chart-point" />)}
            </svg>
            <div className="chart-labels">{rows.map((item, index) => <span key={index}>{item[labelKey]}</span>)}</div>
          </div>
        ) : (
          <div className="bar-chart">
            {rows.map((item, index) => {
              const value = Number(item[valueKey]);
              return (
                <div className="bar-row" key={item[labelKey] || index}>
                  <span className="bar-label">{item[labelKey]}</span>
                  <span className="bar-track"><span className="bar-fill" style={{ width: `${Math.max(value > 0 ? 3 : 0, (value / max) * 100)}%`, background: PALETTE[index % PALETTE.length] }} /></span>
                  <strong className="bar-value">{formatter(value)}</strong>
                </div>
              );
            })}
          </div>
        )
      )}
    </section>
  );
};

export default SimpleChart;
