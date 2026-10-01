import { useMemo, useState } from "react";
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
import { AlertTriangle, ArrowDownRight, DollarSign, Lightbulb, TrendingDown, Zap } from "lucide-react";

const todayValues = [40, 27, 24, 48, 56, 42, 63, 91, 55, 102, 98, 101, 155, 91, 82, 126, 112, 141, 82, 157, 34, 59, 46, 65];
const buildingEnergy = [
  { building: "CSE", usage: 284, color: "#22cbe3" },
  { building: "MECH", usage: 342, color: "#f59e0b" },
  { building: "LIB", usage: 152, color: "#22cbe3" },
  { building: "ADMIN", usage: 192, color: "#22cbe3" },
  { building: "HOST-A", usage: 512, color: "#ef4444" },
  { building: "HOST-B", usage: 488, color: "#22cbe3" },
  { building: "CIVIL", usage: 216, color: "#22cbe3" },
  { building: "WRKSHP", usage: 174, color: "#f59e0b" },
];
const ranges = ["Today", "7 Days", "30 Days", "6 Months"];

function makeSeries(range) {
  const labels = range === "Today"
    ? Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`)
    : range === "7 Days"
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : range === "30 Days"
        ? ["1", "4", "7", "10", "13", "16", "19", "22", "25", "28", "30"]
        : ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  const values = range === "Today"
    ? todayValues
    : range === "7 Days"
      ? [91, 112, 104, 128, 156, 84, 72]
      : range === "30 Days"
        ? [102, 118, 110, 136, 124, 158, 142, 131, 146, 121, 139]
        : [112, 104, 97, 89, 82, 76];
  return labels.map((time, index) => ({ time, usage: values[index] }));
}

function EnergyMetric({ icon: Icon, title, value, detail, tone, trend }) {
  return (
    <article className="energy-metric">
      <div className={`energy-metric-icon ${tone}`}><Icon size={19} strokeWidth={1.8} /></div>
      <div className="energy-metric-title">{title}</div>
      <strong className="energy-metric-value">{value}</strong>
      <div className="energy-metric-detail">{detail}{trend && <span className="energy-trend"><ArrowDownRight size={15} /> {trend}</span>}</div>
    </article>
  );
}

function Energy() {
  const [range, setRange] = useState("Today");
  const series = useMemo(() => makeSeries(range), [range]);

  return (
    <div className="energy-page">
      <header className="energy-page-heading">
        <h1>Energy Intelligence</h1>
        <p>Real-time energy monitoring and optimization insights</p>
      </header>

      <section className="energy-metrics" aria-label="Energy summary">
        <EnergyMetric icon={Zap} title="CURRENT CONSUMPTION" value="284 kW" detail="Instantaneous" trend="-3%" tone="cyan" />
        <EnergyMetric icon={Zap} title="TODAY'S CONSUMPTION" value="1,284 kWh" detail="as of now" trend="-6.2%" tone="cyan" />
        <EnergyMetric icon={TrendingDown} title="MONTHLY CONSUMPTION" value="38,420 kWh" detail="Aug 2026" tone="green" />
        <EnergyMetric icon={DollarSign} title="ENERGY COST" value="₹1,92,100" detail="Estimated monthly" tone="amber" />
      </section>

      <section className="energy-panel energy-consumption-panel">
        <header className="energy-panel-heading energy-consumption-heading">
          <div><h2>Energy Consumption</h2><p>Campus-wide energy usage over time</p></div>
          <div className="energy-range-tabs" role="tablist" aria-label="Energy chart range">
            {ranges.map((item) => <button role="tab" aria-selected={range === item} className={range === item ? "active" : ""} key={item} onClick={() => setRange(item)}>{item}</button>)}
          </div>
        </header>
        <div className="energy-consumption-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 9, right: 10, left: 5, bottom: 0 }}>
              <CartesianGrid stroke="#2a3542" strokeDasharray="3 4" vertical />
              <XAxis dataKey="time" axisLine={false} tickLine={false} interval={range === "Today" ? 3 : 0} tick={{ fill: "#95a5b9", fontSize: 12 }} />
              <YAxis domain={[0, 160]} ticks={[0, 40, 80, 120, 160]} axisLine={false} tickLine={false} tick={{ fill: "#95a5b9", fontSize: 12 }} tickFormatter={(value) => `${value} kWh`} width={92} />
              <Tooltip cursor={{ stroke: "#94a3b8", strokeWidth: 1 }} contentStyle={{ background: "#1b2430", border: "1px solid #2c3948", borderRadius: 7, color: "#e2e8f0", fontSize: 13 }} formatter={(value) => [`${value} kWh`, "Energy usage"]} />
              {range === "Today" && <ReferenceLine x="11:00" stroke="#94a3b8" strokeWidth={1} />}
              <Area type="monotone" dataKey="usage" stroke="#ffa000" strokeWidth={2.5} fill="transparent" dot={false} activeDot={{ r: 4, fill: "#ffa000", stroke: "#f8fafc", strokeWidth: 1.5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="energy-detail-grid">
        <article className="energy-panel energy-building-panel">
          <header className="energy-panel-heading"><h2>Energy by Building</h2></header>
          <div className="energy-building-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buildingEnergy} margin={{ top: 17, right: 10, left: 5, bottom: 10 }}>
                <CartesianGrid stroke="#2a3542" strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="building" axisLine={false} tickLine={false} tick={{ fill: "#95a5b9", fontSize: 12 }} />
                <YAxis domain={[0, 600]} ticks={[0, 150, 300, 450, 600]} axisLine={false} tickLine={false} tick={{ fill: "#95a5b9", fontSize: 12 }} tickFormatter={(value) => `${value} kWh`} width={78} />
                <Tooltip cursor={{ fill: "rgba(148,163,184,.06)" }} contentStyle={{ background: "#1b2430", border: "1px solid #2c3948", borderRadius: 7, color: "#e2e8f0", fontSize: 12 }} formatter={(value) => [`${value} kWh`, "Usage"]} />
                <Bar dataKey="usage" name="Usage" radius={[4, 4, 0, 0]} barSize={86}>{buildingEnergy.map((entry) => <Cell key={entry.building} fill={entry.color} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <div className="energy-insights-column">
          <article className="energy-panel energy-anomalies-panel">
            <header className="energy-panel-heading"><h2>Energy Anomalies</h2></header>
            <div className="energy-insight-list">
              <div className="energy-insight anomaly"><div className="energy-insight-title"><AlertTriangle size={15} /> Mechanical Block</div><p>Usage 23% above normal pattern.</p><small>Detected at 14:32</small></div>
              <div className="energy-insight anomaly"><div className="energy-insight-title"><AlertTriangle size={15} /> Hostel A</div><p>Usage 15% above normal pattern.</p><small>Detected at 13:18</small></div>
            </div>
          </article>
          <article className="energy-panel energy-savings-panel">
            <header className="energy-panel-heading"><h2>Saving Opportunities</h2></header>
            <div className="energy-insight-list">
              <div className="energy-insight saving"><div className="energy-insight-title"><Lightbulb size={15} /> CSE Block <span>-12%</span></div><p>Reduce HVAC in low-occupancy rooms</p></div>
              <div className="energy-insight saving"><div className="energy-insight-title"><Lightbulb size={15} /> Library <span>-8%</span></div><p>Optimize lighting schedule</p></div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

export default Energy;
