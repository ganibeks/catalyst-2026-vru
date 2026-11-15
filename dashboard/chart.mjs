const edge = { top: 14, right: 14, bottom: 30, left: 40 };

export function drawFlowChart(canvas, hourly, capacity, selectedHour, format, maximum) {
  const { width, height } = canvas.getBoundingClientRect();
  if (width <= edge.left + edge.right || height <= edge.top + edge.bottom) return;
  const density = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(width * density);
  canvas.height = Math.round(height * density);

  const ctx = canvas.getContext("2d");
  ctx.scale(density, density);
  const plotWidth = width - edge.left - edge.right;
  const plotHeight = height - edge.top - edge.bottom;
  const interval = maximum > 150 ? 50 : 25;
  const ceiling = Math.ceil(maximum / interval) * interval;
  const x = hour => edge.left + plotWidth * hour / 24;
  const y = flow => edge.top + plotHeight * (1 - flow / ceiling);
  const barWidth = plotWidth / 24;
  const barGap = Math.min(3, barWidth * 0.17);

  ctx.font = "11px 'IBM Plex Mono', Consolas, monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let tick = 0; tick <= ceiling; tick += interval) {
    ctx.strokeStyle = "#395463";
    ctx.beginPath();
    ctx.moveTo(x(0), y(tick));
    ctx.lineTo(x(24), y(tick));
    ctx.stroke();
    ctx.fillStyle = "#bfcfd6";
    ctx.fillText(format(tick), x(0) - 7, y(tick));
  }

  ctx.fillStyle = "#88b0bd38";
  ctx.fillRect(x(selectedHour), edge.top, barWidth, plotHeight);

  for (const row of hourly) {
    const left = x(row.hour) + barGap / 2;
    ctx.fillStyle = row.hour === selectedHour ? "#caefed" : "#8accce";
    ctx.fillRect(left, y(row.collected), barWidth - barGap, y(0) - y(row.collected));
    ctx.fillStyle = "#e3a27c";
    ctx.fillRect(left, y(row.generated), barWidth - barGap, y(row.collected) - y(row.generated));
  }

  ctx.strokeStyle = "#f1ede1";
  ctx.lineWidth = 1.35;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(x(0), y(capacity));
  ctx.lineTo(x(24), y(capacity));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#bfcfd6";
  ctx.textBaseline = "top";
  const spacing = width < 400 ? 6 : 4;
  for (let tick = 0; tick <= 24; tick += spacing) {
    ctx.textAlign = tick === 24 ? "right" : tick === 0 ? "left" : "center";
    ctx.fillText(String(tick).padStart(2, "0") + ":00", x(tick), y(0) + 9);
  }
}

export function chartHour(canvas, clientX) {
  const { left, width } = canvas.getBoundingClientRect();
  const plotWidth = width - edge.left - edge.right;
  const hour = Math.floor((clientX - left - edge.left) / plotWidth * 24);
  return Math.min(23, Math.max(0, hour));
}
