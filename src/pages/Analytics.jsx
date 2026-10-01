import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Award, BarChart3, Cpu, TrendingUp } from "lucide-react";
import "./Analytics.css";

const occupancyTrend = [
  ["06:00", 10], ["07:00", 23], ["08:00", 40], ["09:00", 63],
  ["10:00", 73], ["11:00", 78], ["12:00", 79], ["13:00", 54],
  ["14:00", 70], ["15:00", 70], ["16:00", 70], ["17:00", 62],
  ["18:00", 42], ["19:00", 30], ["20:00", 33], ["21:00", 14],
].map(([time, occupancy]) => ({ time, occupancy }));

const weeklyEnergy = [
  { day: "Mon", usage: 1050 }, { day: "Tue", usage: 1120 }, { day: "Wed", usage: 1050 },
  { day: "Thu", usage: 1000 }, { day: "Fri", usage: 970 }, { day: "Sat", usage: 820 }, { day: "Sun", usage: 1035 },
];

const utilization = [
  { name: "Classrooms", spaces: 186, value: 72, color: "#f59e0b" },
  { name: "Labs", spaces: 94, value: 81, color: "#ef4444" },
  { name: "Seminar Halls", spaces: 28, value: 54, color: "#22cbe3" },
  { name: "Libraries", spaces: 12, value: 68, color: "#f59e0b" },
  { name: "Workshops", spaces: 18, value: 47, color: "#22cbe3" },
  { name: "Offices", spaces: 148, value: 39, color: "#22cbe3" },
];

const performance = [
  { metric: "Occupancy", value: 72 }, { metric: "Energy", value: 81 },
  { metric: "Maintenance", value: 86 }, { metric: "Bookings", value: 67 },
  { metric: "Safety", value: 89 }, { metric: "Comfort", value: 76 },
];

const efficiencyScores = [
  { building: "CSE Building", score: 96 }, { building: "Mechanical Block", score: 88 },
  { building: "Library", score: 94 }, { building: "Admin Block", score: 95 },
  { building: "Hostel A", score: 54 }, { building: "Hostel B", score: 93 },
  { building: "Civil Block", score: 95 }, { building: "Central Workshop", score: 86 },
];

function AnalyticsMetric({ icon: Icon, title, value, detail, tone, trend }) {
  return <article className="analytics-metric"><span className={`analytics-metric-icon ${tone}`}><Icon size={19} strokeWidth={1.9}/></span><span className="analytics-metric-title">{title}</span><strong>{value}</strong><small>{detail}{trend && <span className="analytics-metric-trend"><TrendingUp size={13}/> {trend}</span>}</small></article>;
}

function ScoreRing({ score }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const needsAttention = score < 70;
  return <svg className={`efficiency-ring ${needsAttention ? "needs-attention" : ""}`} viewBox="0 0 82 82" role="img" aria-label={`${score} efficiency score`}>
    <circle className="efficiency-ring-track" cx="41" cy="41" r={radius}/>
    <circle className="efficiency-ring-value" cx="41" cy="41" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - score / 100)}/>
    <text x="41" y="46" textAnchor="middle">{score}</text>
  </svg>;
}

function Analytics() {
  return <div className="analytics-page">
    <header className="analytics-page-heading"><h1>Campus Intelligence</h1><p>Advanced analytics and campus performance insights</p></header>

    <section className="analytics-metrics" aria-label="Campus performance summary">
      <AnalyticsMetric icon={Award} title="AVG EFFICIENCY" value="83.4" detail="/ 100 score" trend="+2.1" tone="cyan"/>
      <AnalyticsMetric icon={BarChart3} title="UTILIZATION RATE" value="72%" detail="All resources" tone="blue"/>
      <AnalyticsMetric icon={TrendingUp} title="ENERGY EFFICIENCY" value="A+" detail="Grade this month" tone="green"/>
      <AnalyticsMetric icon={Cpu} title="SENSORS ACTIVE" value="1,221" detail="of 1,248 total" tone="amber"/>
    </section>

    <section className="analytics-chart-grid">
      <article className="analytics-panel analytics-trend-panel"><header className="analytics-panel-heading"><div><h2>Occupancy Analytics</h2><p>24-hour campus occupancy pattern</p></div></header>
        <div className="analytics-occupancy-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={occupancyTrend} margin={{ top: 8, right: 10, left: 4, bottom: 0 }}>
          <defs><linearGradient id="analyticsOccupancyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#20d2e9" stopOpacity={0.18}/><stop offset="100%" stopColor="#20d2e9" stopOpacity={0}/></linearGradient></defs>
          <CartesianGrid stroke="#2a3542" strokeDasharray="3 4" vertical/>
          <XAxis dataKey="time" axisLine={false} tickLine={false} interval={2} tick={{ fill:"#95a5b9",fontSize:12 }}/>
          <YAxis domain={[0,80]} ticks={[0,20,40,60,80]} axisLine={false} tickLine={false} width={47} tick={{ fill:"#95a5b9",fontSize:12 }} tickFormatter={(value)=>`${value}%`}/>
          <Tooltip cursor={{ stroke:"#94a3b8",strokeWidth:1 }} contentStyle={{ background:"#1b2430",border:"1px solid #2c3948",borderRadius:7,color:"#e2e8f0",fontSize:13 }} formatter={(value)=>[`${value}%`,"Occupancy"]}/>
          <ReferenceLine x="15:00" stroke="#94a3b8" strokeWidth={1}/>
          <Area type="monotone" dataKey="occupancy" stroke="#18d2eb" strokeWidth={2.5} fill="url(#analyticsOccupancyFill)" dot={false} activeDot={{r:5,fill:"#18d2eb",stroke:"#f8fafc",strokeWidth:2}}/>
        </AreaChart></ResponsiveContainer><div className="analytics-hover-label"><span>15:00</span><strong>occupancy : 70</strong></div></div>
      </article>

      <article className="analytics-panel analytics-energy-panel"><header className="analytics-panel-heading"><div><h2>Energy Analytics</h2><p>Weekly energy consumption trend</p></div></header>
        <div className="analytics-energy-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={weeklyEnergy} margin={{top:8,right:10,left:8,bottom:0}}>
          <CartesianGrid stroke="#2a3542" strokeDasharray="3 4" vertical={false}/>
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:"#95a5b9",fontSize:12}}/>
          <YAxis domain={[0,1200]} ticks={[0,300,600,900,1200]} axisLine={false} tickLine={false} width={48} tick={{fill:"#95a5b9",fontSize:12}}/>
          <Tooltip cursor={{fill:"rgba(148,163,184,.06)"}} contentStyle={{background:"#1b2430",border:"1px solid #2c3948",borderRadius:7,color:"#e2e8f0",fontSize:12}} formatter={(value)=>[`${value} kWh`,"Consumption"]}/>
          <Bar dataKey="usage" fill="#cc890c" radius={[4,4,0,0]} barSize={70}/>
        </BarChart></ResponsiveContainer></div>
      </article>
    </section>

    <section className="analytics-resource-grid">
      <article className="analytics-panel analytics-utilization-panel"><header className="analytics-panel-heading"><h2>Resource Utilization</h2></header><div className="utilization-list">
        {utilization.map((item)=><div className="utilization-item" key={item.name}><div className="utilization-meta"><div><strong>{item.name}</strong><span>{item.spaces} spaces</span></div><b style={{color:item.color}}>{item.value}%</b></div><div className="utilization-track"><span style={{width:`${item.value}%`,backgroundColor:item.color}}/></div></div>)}
      </div></article>
      <article className="analytics-panel analytics-performance-panel"><header className="analytics-panel-heading"><h2>Campus Performance</h2></header><div className="analytics-radar-chart"><ResponsiveContainer width="100%" height="100%"><RadarChart data={performance} outerRadius="66%">
        <PolarGrid stroke="#293543"/><PolarAngleAxis dataKey="metric" tick={{fill:"#95a5b9",fontSize:12}}/><Radar dataKey="value" stroke="#20d2e9" strokeWidth={2} fill="#20d2e9" fillOpacity={0.16}/>
      </RadarChart></ResponsiveContainer></div></article>
    </section>

    <section className="analytics-panel analytics-scores-panel"><header className="analytics-panel-heading"><div><h2>Building Efficiency Scores</h2><p>Composite score based on occupancy, energy, maintenance, and safety</p></div></header><div className="efficiency-score-grid">
      {efficiencyScores.map(({building,score})=><article className="efficiency-score-card" key={building}><span>{building}</span><ScoreRing score={score}/><strong className={score < 70 ? "attention" : "excellent"}>{score < 70 ? "Needs Attention" : "Excellent"}</strong></article>)}
    </div></section>
  </div>;
}

export default Analytics;
