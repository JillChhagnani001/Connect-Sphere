"use client"

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

const data = [
  { name: 'Week 1', likes: 4000, comments: 2400, shares: 1200 },
  { name: 'Week 2', likes: 3000, comments: 1398, shares: 980 },
  { name: 'Week 3', likes: 2000, comments: 9800, shares: 2290 },
  { name: 'Week 4', likes: 2780, comments: 3908, shares: 2000 },
  { name: 'Week 5', likes: 1890, comments: 4800, shares: 1500 },
];

export function EngagementChart() {
  return (
    <div className="w-full h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
          />
          <Legend wrapperStyle={{fontSize: "14px"}} />
          <Bar dataKey="likes" fill="hsl(var(--primary))" name="Likes" radius={[4, 4, 0, 0]} />
          <Bar dataKey="comments" fill="hsl(var(--accent))" name="Comments" radius={[4, 4, 0, 0]} />
          <Bar dataKey="shares" fill="hsl(var(--secondary-foreground))" name="Shares" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
