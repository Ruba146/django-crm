import { NextResponse } from "next/server";
import { generateGlobalActionRecommendations } from "@/services/ai-action-recommendation.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const recommendations = generateGlobalActionRecommendations();
    return NextResponse.json(recommendations);
  } catch (error) {
    console.error("Global action recommendations API error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
