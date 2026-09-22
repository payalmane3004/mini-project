import StatCard from "./StatCard";

function StatsGrid() {
  return (
    <div className="stats-grid">

      <StatCard
        type="buildings"
        title="Buildings"
        value="24"
        subtitle="22 operational"
        trend="+2 this year"
        trendType="positive"
      />

      <StatCard
        type="rooms"
        title="Rooms"
        value="486"
        subtitle="312 currently occupied"
      />

      <StatCard
        type="occupancy"
        title="Occupancy"
        value="64.2%"
        subtitle="Campus-wide"
        trend="+4.8%"
        trendType="positive"
      />

      <StatCard
        type="energy"
        title="Energy Usage"
        value="1,284"
        subtitle="kWh today"
        trend="-6.2%"
        trendType="positive"
      />

      <StatCard
        type="alerts"
        title="Active Alerts"
        value="7"
        subtitle="2 critical"
        trend="2 critical"
        trendType="negative"
      />

      <StatCard
        type="maintenance"
        title="Maintenance"
        value="12"
        subtitle="3 urgent"
        trend="3 urgent"
        trendType="warning"
      />

    </div>
  );
}

export default StatsGrid;