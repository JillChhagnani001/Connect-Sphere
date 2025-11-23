"use client"

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface EngagementChartProps {
  data: Array<{
    name: string;
    likes: number;
    comments: number;
    shares: number;
  }>;
}

export function EngagementChart({ data }: EngagementChartProps) {
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
