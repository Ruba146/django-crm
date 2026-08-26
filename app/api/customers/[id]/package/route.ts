import { NextResponse } from "next/server";
import { getCustomerPackage } from "@/services/customer-package.service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const pkg = getCustomerPackage(id);
  if (!pkg) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  return NextResponse.json(pkg);
}
