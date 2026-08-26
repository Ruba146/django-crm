"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { AiInactiveCustomer } from "@/types";
import { Users } from "lucide-react";

interface InactiveCustomersProps {
  inactiveCustomers: AiInactiveCustomer[];
}

export function InactiveCustomers({ inactiveCustomers }: InactiveCustomersProps) {
  if (inactiveCustomers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4 text-info" aria-hidden="true" />
            Inactive Customers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">All customers are active.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4 text-info" aria-hidden="true" />
          Inactive Customers
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-3 text-left font-medium text-muted-foreground">Customer</th>
                <th className="pb-3 text-left font-medium text-muted-foreground">City</th>
                <th className="pb-3 text-left font-medium text-muted-foreground">Last Activity</th>
                <th className="pb-3 text-right font-medium text-muted-foreground">Days Inactive</th>
                <th className="pb-3 text-right font-medium text-muted-foreground">Deals</th>
                <th className="pb-3 text-right font-medium text-muted-foreground">Owner</th>
              </tr>
            </thead>
            <tbody>
              {inactiveCustomers.map((customer) => (
                <tr key={customer.id} className="border-b border-border last:border-0">
                  <td className="py-3 font-medium">{customer.name || "Unknown"}</td>
                  <td className="py-3">{customer.city || "—"}</td>
                  <td className="py-3">
                    {customer.lastActivityAt
                      ? new Date(customer.lastActivityAt).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="py-3 text-right">{customer.daysSinceActivity}</td>
                  <td className="py-3 text-right">{customer.dealCount}</td>
                  <td className="py-3 text-right">{customer.ownerName || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
