"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { RecentDeal, TopCustomer } from "@/types";

interface RecentBusinessProps {
  recentDeals: RecentDeal[];
  topCustomers: TopCustomer[];
}

export function RecentBusiness({ recentDeals, topCustomers }: RecentBusinessProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Recent Deals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 text-left font-medium text-muted-foreground">Deal</th>
                  <th className="pb-3 text-left font-medium text-muted-foreground">Company</th>
                  <th className="pb-3 text-left font-medium text-muted-foreground">Stage</th>
                  <th className="pb-3 text-right font-medium text-muted-foreground">Value</th>
                  <th className="pb-3 text-left font-medium text-muted-foreground">Owner</th>
                </tr>
              </thead>
              <tbody>
                {recentDeals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      No deals found.
                    </td>
                  </tr>
                ) : (
                  recentDeals.map((deal) => (
                    <tr key={deal.id} className="border-b border-border last:border-0">
                      <td className="py-3 font-medium">{deal.name || "Untitled"}</td>
                      <td className="py-3">{deal.customer_name || "—"}</td>
                      <td className="py-3">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: deal.stage_color ? `${deal.stage_color}20` : undefined,
                            color: deal.stage_color || undefined,
                          }}
                        >
                          {deal.stage_label || "Unknown"}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {deal.expected_value_minor != null
                          ? `${(deal.expected_value_minor / 100).toFixed(2)} ${deal.currency_code || "SAR"}`
                          : "—"}
                      </td>
                      <td className="py-3">{deal.owner_name || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Newest Customers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 text-left font-medium text-muted-foreground">Customer</th>
                  <th className="pb-3 text-right font-medium text-muted-foreground">Deals</th>
                  <th className="pb-3 text-right font-medium text-muted-foreground">Revenue</th>
                  <th className="pb-3 text-right font-medium text-muted-foreground">Activities</th>
                  <th className="pb-3 text-right font-medium text-muted-foreground">Tasks</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  topCustomers.map((customer) => (
                    <tr key={customer.id} className="border-b border-border last:border-0">
                      <td className="py-3 font-medium">{customer.name || "Unknown"}</td>
                      <td className="py-3 text-right">{customer.dealCount}</td>
                      <td className="py-3 text-right">{(customer.totalRevenue / 100).toFixed(2)}</td>
                      <td className="py-3 text-right">{customer.activitiesCount}</td>
                      <td className="py-3 text-right">{customer.tasksCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
