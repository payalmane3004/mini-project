import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Brain, TrendingUp, Wrench, Zap } from "lucide-react";
import "./Predictions.css";

const occupancyForecast = [
  { time: "Now", actual: 64, predicted: null },
  { time: "+30m", actual: 67, predicted: 67 },
  { time: "+1h", actual: null, predicted: 70 },
  { time: "+1.5h", actual: null, predicted: 73 },
  { time: "+2h", actual: null, predicted: 78 },
  { time: "+2.5h", actual: null, predicted: 80 },
  { time: "+3h", actual: null, predicted: 77 },
  { time: "+3.5h", actual: null, predicted: 71 },
  { time: "+4h", actual: null, predicted: 64 },
];

const energyForecast = [
  { time: "14:00", actual: 0, predicted: null },
  { time: "15:00", actual: null, predicted: 1320 },
  { time: "16:00", actual: null, predicted: 1390 },
  { time: "17:00", actual: null, predicted: 1360 },
  { time: "18:00", actual: null, predicted: 1200 },
];

const maintenanceForecast = [
  { equipment: "HVAC Unit #24 — Mechanical Block", recommendation: "Inspection within 3 days", probability: 72, risk: "High" },
  { equipment: "Elevator — Admin Block", recommendation: "Schedule maintenance within 2 weeks", probability: 45, risk: "Medium" },
  { equipment: "Chiller Unit #2 — CSE Building", recommendation: "Monitor closely, check filters", probability: 28, risk: "Low" },
  { equipment: "Generator — Hostel A", recommendation: "Fuel and servicing within 5 days", probability: 61, risk: "Medium" },
];

function ForecastStat({ value, label, tone }) {
  return <div className={`forecast-stat ${tone}`}><strong>{value}</strong><span>{label}</span></div>;
}

function Predictions() {
  return <div className="predictions-page">
    <header className="predictions-heading"><span className="predictions-heading-icon"><Brain size={22}/></span><div><h1>Predictive Intelligence</h1><p>AI/ML-powered campus forecasting and anomaly detection</p></div></header>

    <div className="predictions-engine-banner"><Activity size={17}/><strong>AI Engine Active</strong><span>·</span><p>Models updated 4 minutes ago · Training on 14 days of campus data</p><code>v3.2.1</code></div>

    <section className="forecast-grid">
      <article className="forecast-panel occupancy-forecast-panel"><header className="forecast-panel-heading"><div><h2><TrendingUp size={17}/> Occupancy Forecast</h2><p>Predicted campus occupancy over next 4 hours</p></div></header>
        <div className="forecast-content">
          <div className="forecast-stats"><ForecastStat value="78%" label="Expected occupancy" tone="cyan"/><ForecastStat value="16:30" label="Predicted peak" tone="cyan"/><ForecastStat value="91%" label="Model confidence" tone="cyan"/></div>
          <div className="forecast-chart occupancy-forecast-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={occupancyForecast} margin={{top:8,right:5,left:3,bottom:0}}>
            <defs><linearGradient id="actualOccupancyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#20d2e9" stopOpacity={0.2}/><stop offset="100%" stopColor="#20d2e9" stopOpacity={0.015}/></linearGradient><linearGradient id="predictedOccupancyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8998aa" stopOpacity={0.16}/><stop offset="100%" stopColor="#8998aa" stopOpacity={0.02}/></linearGradient></defs>
            <CartesianGrid stroke="#2a3542" strokeDasharray="3 4" vertical/>
            <XAxis dataKey="time" ticks={["Now", "+30m", "+1h", "+2h", "+3h", "+4h"]} axisLine={false} tickLine={false} tick={{fill:"#95a5b9",fontSize:12}}/>
            <YAxis domain={[0,80]} ticks={[0,20,40,60,80]} axisLine={false} tickLine={false} width={48} tick={{fill:"#95a5b9",fontSize:12}} tickFormatter={(value)=>`${value}%`}/>
            <Tooltip contentStyle={{background:"#1b2430",border:"1px solid #2c3948",borderRadius:7,color:"#e2e8f0",fontSize:12}} formatter={(value,name)=>[`${value}%`,name === "actual" ? "Current" : "Forecast"]}/>
            <ReferenceLine x="+30m" stroke="#657487" strokeDasharray="3 4"/>
            <Area type="monotone" dataKey="actual" connectNulls stroke="#18d2eb" strokeWidth={2.5} fill="url(#actualOccupancyFill)" dot={false}/>
            <Area type="monotone" dataKey="predicted" connectNulls stroke="#95a5b9" strokeWidth={2} strokeDasharray="5 4" fill="url(#predictedOccupancyFill)" dot={false}/>
          </AreaChart></ResponsiveContainer></div>
        </div>
      </article>

      <article className="forecast-panel energy-forecast-panel"><header className="forecast-panel-heading"><div><h2><Zap size={17}/> Energy Forecast</h2><p>Expected energy consumption next 4 hours</p></div></header>
        <div className="forecast-content">
          <div className="forecast-stats"><ForecastStat value="1,420 kWh" label="Peak forecast" tone="amber"/><ForecastStat value="+8.4%" label="Predicted increase" tone="amber"/><ForecastStat value="86%" label="Model confidence" tone="amber"/></div>
          <div className="forecast-chart energy-forecast-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={energyForecast} margin={{top:8,right:5,left:3,bottom:0}}>
            <defs><linearGradient id="predictedEnergyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d48d0c" stopOpacity={0.22}/><stop offset="100%" stopColor="#d48d0c" stopOpacity={0.02}/></linearGradient></defs>
            <CartesianGrid stroke="#2a3542" strokeDasharray="3 4" vertical/>
            <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill:"#95a5b9",fontSize:12}}/>
            <YAxis domain={[0,1600]} ticks={[0,400,800,1200,1600]} axisLine={false} tickLine={false} width={52} tick={{fill:"#95a5b9",fontSize:12}}/>
            <Tooltip contentStyle={{background:"#1b2430",border:"1px solid #2c3948",borderRadius:7,color:"#e2e8f0",fontSize:12}} formatter={(value)=>[`${value} kWh`,"Forecast"]}/>
            <ReferenceLine x="15:00" stroke="#657487" strokeDasharray="3 4"/>
            <Area type="monotone" dataKey="predicted" connectNulls stroke="#d48d0c" strokeWidth={2} strokeDasharray="5 4" fill="url(#predictedEnergyFill)" dot={false}/>
          </AreaChart></ResponsiveContainer></div>
        </div>
      </article>
    </section>

    <section className="forecast-panel predictive-maintenance-panel"><header className="forecast-panel-heading"><div><h2><Wrench size={17}/> Predictive Maintenance</h2><p>AI-predicted equipment failure probabilities</p></div></header>
      <div className="maintenance-forecast-list">{maintenanceForecast.map((item) => <article className="maintenance-forecast-item" key={item.equipment}>
        <div className="maintenance-forecast-top"><div><strong>{item.equipment}</strong><p>{item.recommendation}</p></div><span className={`maintenance-risk ${item.risk.toLowerCase()}`}>{item.risk.toLowerCase()}</span></div>
        <div className="maintenance-probability"><span>Failure probability</span><div className="maintenance-probability-track"><span className={item.risk.toLowerCase()} style={{width:`${item.probability}%`}}/></div><b className={item.risk.toLowerCase()}>{item.probability}%</b></div>
      </article>)}</div>
    </section>
  </div>;
}

export default Predictions;
