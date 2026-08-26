"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { OwnerPerformance } from "@/types";

interface TopPerformersProps {
  owners: OwnerPerformance[];
}

export function TopPerformers({ owners }: TopPerformersProps) {
  const sorted = [...owners].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Sales Owners</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-3 text-left font-medium text-muted-foreground">Owner</th>
                <th className="pb-3 text-right font-medium text-muted-foreground">Deals</th>
                <th className="pb-3 text-right font-medium text-muted-foreground">Revenue</th>
                <th className="pb-3 text-right font-medium text-muted-foreground">Won Deals</th>
                <th className="pb-3 text-right font-medium text-muted-foreground">Activities</th>
                <th className="pb-3 text-right font-medium text-muted-foreground">Tasks</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((owner) => (
                <tr key={owner.ownerId} className="border-b border-border last:border-0">
                  <td className="py-3 font-medium">{owner.ownerName || "Unknown"}</td>
                  <td className="py-3 text-right">{owner.deals}</td>
                  <td className="py-3 text-right">{(owner.revenue / 100).toFixed(2)}</td>
                  <td className="py-3 text-right">{owner.wonDeals}</td>
                  <td className="py-3 text-right">{owner.activities}</td>
                  <td className="py-3 text-right">{owner.tasks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
