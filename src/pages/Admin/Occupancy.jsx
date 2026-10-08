import { Fragment } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DoorOpen, TrendingUp, TriangleAlert, Users } from "lucide-react";

const hourlyOccupancy = [
  11, 9, 8, 7, 10, 10, 8, 26, 36, 58, 70, 76, 76, 58, 70, 74, 71, 53, 51, 31,
  35, 12, 11, 15,
].map((occupancy, hour) => ({ time: `${String(hour).padStart(2, "0")}:00`, occupancy }));

const buildingOccupancy = [
  { building: "MECH", current: 72, typical: 58 },
  { building: "ADMIN", current: 82, typical: 44 },
  { building: "HOST-B", current: 76, typical: 51 },
  { building: "WRKSHP", current: 52, typical: 34 },
];

const heatmap = [
  { building: "CSE", values: [12, 45, 72, 88, 91, 82, 78, 71, 65, 40] },
  { building: "Mechanical", values: [8, 22, 48, 61, 70, 65, 58, 52, 44, 25] },
  { building: "Library", values: [30, 55, 78, 82, 75, 88, 85, 79, 68, 55] },
  { building: "Admin", values: [15, 32, 41, 45, 38, 42, 39, 35, 30, 18] },
  { building: "Hostel A", values: [60, 72, 65, 58, 55, 62, 70, 78, 82, 88] },
];
const heatmapHours = ["8AM", "9AM", "10AM", "11AM", "12PM", "1PM", "2PM", "3PM", "4PM", "5PM"];

function heatLevel(value) {
  if (value >= 80) return "high";
  if (value >= 50) return "medium";
  return "low";
}

function MetricCard({ icon: Icon, label, value, note, tone, live = false }) {
  return (
    <article className="occupancy-metric">
      <div className={`occupancy-metric-icon ${tone}`}><Icon size={19} strokeWidth={1.8} /></div>
      <div className="occupancy-metric-label">{label}</div>
      <strong className="occupancy-metric-value">{value}</strong>
      <div className="occupancy-metric-note">{note}{live && <span className="occupancy-live"><TrendingUp size={13} /> Live</span>}</div>
    </article>
  );
}

function Occupancy() {
  return (
    <div className="occupancy-page">
      <header className="occupancy-page-heading">
        <h1>Occupancy Monitoring</h1>
        <p>Real-time campus occupancy data and analytics</p>
      </header>

      <section className="occupancy-metrics" aria-label="Occupancy summary">
        <MetricCard icon={Users} label="CURRENT OCCUPANCY" value="65.9%" note="Campus-wide" tone="cyan" live />
        <MetricCard icon={TrendingUp} label="PEAK OCCUPANCY" value="91.4%" note="At 11:30 AM" tone="amber" />
        <MetricCard icon={DoorOpen} label="AVAILABLE ROOMS" value="174" note="of 486 total" tone="green" />
        <MetricCard icon={TriangleAlert} label="OVERCROWDED" value="8" note="Above 90% capacity" tone="red" />
      </section>

      <section className="occupancy-panel occupancy-trend-panel">
        <header className="occupancy-panel-heading">
          <div><h2>Campus Occupancy — Last 24 Hours</h2><p>Combined occupancy across all campus buildings</p></div>
        </header>
        <div className="occupancy-trend-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourlyOccupancy} margin={{ top: 8, right: 10, left: 7, bottom: 0 }}>
              <defs><linearGradient id="campusOccupancyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={0.2} /><stop offset="100%" stopColor="#22d3ee" stopOpacity={0.015} /></linearGradient></defs>
              <CartesianGrid stroke="#2a3542" strokeDasharray="3 4" vertical />
              <XAxis dataKey="time" axisLine={false} tickLine={false} interval={2} tick={{ fill: "#95a5b9", fontSize: 12 }} />
              <YAxis domain={[0, 80]} ticks={[0, 20, 40, 60, 80]} axisLine={false} tickLine={false} tick={{ fill: "#95a5b9", fontSize: 12 }} tickFormatter={(value) => `${value}%`} width={48} />
              <Tooltip cursor={{ stroke: "#94a3b8", strokeWidth: 1 }} contentStyle={{ background: "#1b2430", border: "1px solid #2c3948", borderRadius: 7, color: "#e2e8f0", fontSize: 13 }} formatter={(value) => [`${value}%`, "Occupancy"]} />
              <ReferenceLine x="11:00" stroke="#94a3b8" strokeWidth={1} />
              <Area type="monotone" dataKey="occupancy" stroke="#18d2eb" strokeWidth={2.5} fill="url(#campusOccupancyFill)" dot={false} activeDot={{ r: 5, fill: "#18d2eb", stroke: "#f8fafc", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="occupancy-chart-callout"><span>11:00</span><strong>occupancy : 76</strong></div>
        </div>
      </section>

      <section className="occupancy-detail-grid">
        <article className="occupancy-panel occupancy-building-panel">
          <header className="occupancy-panel-heading"><h2>Occupancy by Building</h2></header>
          <div className="occupancy-building-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buildingOccupancy} layout="vertical" margin={{ top: 4, right: 10, left: 12, bottom: 8 }} barCategoryGap="20%">
                <CartesianGrid stroke="#2a3542" strokeDasharray="3 4" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} axisLine={false} tickLine={false} tick={{ fill: "#95a5b9", fontSize: 11 }} tickFormatter={(value) => `${value}%`} />
                <YAxis type="category" dataKey="building" axisLine={false} tickLine={false} tick={{ fill: "#95a5b9", fontSize: 11 }} width={74} />
                <Tooltip cursor={{ fill: "rgba(148,163,184,.06)" }} contentStyle={{ background: "#1b2430", border: "1px solid #2c3948", borderRadius: 7, color: "#e2e8f0", fontSize: 12 }} formatter={(value) => [`${value}%`]} />
                <Bar dataKey="current" name="Current occupancy" radius={[0, 4, 4, 0]} barSize={16}>{buildingOccupancy.map((entry) => <Cell key={entry.building} fill={entry.current >= 80 ? "#ef4444" : entry.current >= 70 ? "#f59e0b" : "#20cce5"} />)}</Bar>
                <Bar dataKey="typical" name="Daily average" fill="#22cbe3" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="occupancy-panel occupancy-heatmap-panel">
          <header className="occupancy-panel-heading"><div><h2>Occupancy Heatmap</h2><p>Occupancy % by building and hour</p></div></header>
          <div className="occupancy-heatmap-scroll">
            <div className="occupancy-heatmap">
              <div className="heatmap-corner" />
              {heatmapHours.map((hour) => <span className="heatmap-hour" key={hour}>{hour}</span>)}
              {heatmap.map((row) => <Fragment key={row.building}><span className="heatmap-building">{row.building}</span>
                {row.values.map((value, index) => <span className={`heatmap-cell ${heatLevel(value)}`} key={`${row.building}-${index}`}>{value}</span>)}
              </Fragment>)}
            </div>
          </div>
          <footer className="heatmap-legend"><span><i className="low"/>Low</span><span><i className="medium"/>Medium</span><span><i className="high"/>High</span></footer>
        </article>
      </section>
    </div>
  );
}

export default Occupancy;
