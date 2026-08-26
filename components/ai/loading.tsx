import { Card, CardContent } from "@/components/ui";

export function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-8 w-16 animate-pulse rounded bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <div className="p-5 pb-0">
          <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        </div>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
