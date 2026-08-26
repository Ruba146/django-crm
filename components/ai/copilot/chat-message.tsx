"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/utils/cn";
import { formatDateTime } from "@/utils/format";
import type { ChatMessage } from "@/types/ai-chat";
import { Avatar } from "@/components/ui/avatar";

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1.5 [&_p]:leading-relaxed [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_strong]:text-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs">
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p className="text-sm leading-relaxed text-foreground/90">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-4 text-sm text-foreground/90">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-4 text-sm text-foreground/90">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="text-sm">{children}</li>,
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-foreground">{children}</h3>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              {children}
            </code>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-primary-600 underline underline-offset-2 hover:text-primary-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function ChatMessage({
  message,
}: {
  message: ChatMessage;
}) {
  const isUser = message.role === "user";

  const avatarFallback = isUser ? "U" : "AI";

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <Avatar
        size="sm"
        fallback={avatarFallback}
        noAutoColor
        className={cn(
          "shrink-0",
          isUser
            ? "bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300"
            : "bg-success/10 text-success"
        )}
      />

      <div
        className={cn(
          "flex max-w-[85%] flex-col gap-1",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm",
            isUser
              ? "bg-primary-600 text-white rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed">
              {message.content}
            </p>
          ) : (
            <MarkdownContent content={message.content} />
          )}
        </div>

        <span className="text-[10px] text-muted-foreground px-1">
          {formatDateTime(new Date(message.timestamp), "en")}
        </span>
      </div>
    </div>
  );
}
