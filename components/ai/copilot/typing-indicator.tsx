"use client";

import { cn } from "@/utils/cn";

const dots = [
  "animate-bounce [animation-delay:0ms]",
  "animate-bounce [animation-delay:150ms]",
  "animate-bounce [animation-delay:300ms]",
];

export function TypingIndicator({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1 px-4 py-3", className)}>
      <span
        className={cn(
          "inline-block size-1.5 rounded-full bg-muted-foreground/70",
          dots[0]
        )}
      />
      <span
        className={cn(
          "inline-block size-1.5 rounded-full bg-muted-foreground/70",
          dots[1]
        )}
      />
      <span
        className={cn(
          "inline-block size-1.5 rounded-full bg-muted-foreground/70",
          dots[2]
        )}
      />
    </div>
  );
}
