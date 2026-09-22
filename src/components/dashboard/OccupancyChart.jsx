import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const occupancyData = [
  { time: "6 AM", occupancy: 18 },
  { time: "8 AM", occupancy: 36 },
  { time: "10 AM", occupancy: 58 },
  { time: "12 PM", occupancy: 72 },
  { time: "2 PM", occupancy: 68 },
  { time: "4 PM", occupancy: 61 },
  { time: "6 PM", occupancy: 43 },
  { time: "8 PM", occupancy: 24 },
];

function OccupancyChart() {
  return (
    <div className="occupancy-card">
      <div className="chart-header">
        <div>
          <h2>Occupancy — Today</h2>
          <p>Campus-wide occupancy throughout the day</p>
        </div>

        <div className="chart-value">
          <strong>64.2%</strong>
          <span>Current</span>
        </div>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={occupancyData}
            margin={{
              top: 10,
              right: 10,
              left: -20,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient
                id="occupancyGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#22d3ee"
                  stopOpacity={0.25}
                />

                <stop
                  offset="100%"
                  stopColor="#22d3ee"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              stroke="#27313d"
              strokeDasharray="3 3"
              vertical={false}
            />

            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              tick={{
                fill: "#64748b",
                fontSize: 10,
              }}
            />

            <YAxis
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tick={{
                fill: "#64748b",
                fontSize: 10,
              }}
              tickFormatter={(value) => `${value}%`}
            />

            <Tooltip
              contentStyle={{
                background: "#111720",
                border: "1px solid #27313d",
                borderRadius: "6px",
                color: "#f8fafc",
                fontSize: "11px",
              }}
              formatter={(value) => [`${value}%`, "Occupancy"]}
            />

            <Area
              type="monotone"
              dataKey="occupancy"
              stroke="#22d3ee"
              strokeWidth={2}
              fill="url(#occupancyGradient)"
              dot={false}
              activeDot={{
                r: 4,
                fill: "#22d3ee",
                stroke: "#0b0f14",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-footer">
        <span>
          <i className="chart-dot"></i>
          Live occupancy
        </span>

        <span>Peak: 72% at 12 PM</span>
      </div>
    </div>
  );
}

export default OccupancyChart;