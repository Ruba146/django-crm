"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RecordSelector } from "@/components/shared/record-selector";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  User,
  ArrowLeftRight,
  ExternalLink,
  Filter,
} from "lucide-react";
import type { CrmEvent, EntityType, EventType } from "@/types/events";

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  ENTITY_CREATED: "Created",
  ENTITY_UPDATED: "Updated",
  ENTITY_DELETED: "Deleted",
  STAGE_CHANGED: "Stage Changed",
  OWNER_CHANGED: "Owner Changed",
  VALUE_CHANGED: "Value Changed",
  STATUS_CHANGED: "Status Changed",
  TASK_CREATED: "Task Created",
  TASK_COMPLETED: "Task Completed",
  TASK_REOPENED: "Task Reopened",
  ACTIVITY_CREATED: "Activity Created",
  NOTE_CREATED: "Note Created",
  DEAL_CREATED: "Deal Created",
  LEAD_CREATED: "Lead Created",
  CUSTOMER_CREATED: "Customer Created",
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString();
}

function formatChange(state: Record<string, unknown> | null): string {
  if (!state || Object.keys(state).length === 0) return "";
  return Object.entries(state)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
}

export function ReplayView() {
  const [entityType, setEntityType] = useState<EntityType | "">("");
  const [entityId, setEntityId] = useState("");
  const [events, setEvents] = useState<CrmEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [filterEventType, setFilterEventType] = useState<EventType | "">("");
  const [showFilters, setShowFilters] = useState(false);

  const filteredEvents = useMemo(() => {
    if (!filterEventType) return events;
    return events.filter((e) => e.event_type === filterEventType);
  }, [events, filterEventType]);

  const handleSelectRecord = useCallback(async (result: { entityType: string; entityId: string }) => {
    setLoading(true);
    setEntityType(result.entityType as EntityType);
    setEntityId(result.entityId);
    setEvents([]);
    setCurrentIndex(-1);
    setIsPlaying(false);

    try {
      const res = await fetch(`/api/events/${result.entityType}/${result.entityId}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events);
        setCurrentIndex(-1);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isPlaying || currentIndex < 0 || currentIndex >= filteredEvents.length - 1) {
      return;
    }
    const timer = setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
    }, 1500);
    return () => clearTimeout(timer);
  }, [isPlaying, currentIndex, filteredEvents.length]);

  const handlePlay = () => {
    if (currentIndex < 0 && filteredEvents.length > 0) {
      setCurrentIndex(0);
    }
    setIsPlaying((prev) => !prev);
  };

  const handlePrevious = () => {
    setIsPlaying(false);
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setIsPlaying(false);
    setCurrentIndex((prev) => Math.min(filteredEvents.length - 1, prev + 1));
  };

  const currentEvent = currentIndex >= 0 && currentIndex < filteredEvents.length ? filteredEvents[currentIndex] : null;

  const uniqueEventTypes = useMemo(() => {
    const types = new Set(events.map((e) => e.event_type));
    return Array.from(types) as EventType[];
  }, [events]);

  const handleClear = useCallback(() => {
    setEntityType("");
    setEntityId("");
    setEvents([]);
    setCurrentIndex(-1);
    setIsPlaying(false);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Event Replay</h1>
        <p className="text-muted-foreground">
          Explore the chronological history of any CRM record.
        </p>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Select Record
            </label>
            <RecordSelector onSelect={handleSelectRecord} />
          </div>
          {entityId && (
            <div className="flex items-end">
              <Button variant="outline" size="sm" onClick={handleClear}>
                <ArrowLeftRight className="mr-2 size-4" />
                Clear
              </Button>
            </div>
          )}
        </div>

        {events.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {events.length} event{events.length !== 1 ? "s" : ""} found
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-1.5"
            >
              <Filter className="size-3.5" />
              Filters
            </Button>
          </div>
        )}

        {showFilters && uniqueEventTypes.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button
              variant={filterEventType === "" ? "primary" : "outline"}
              size="sm"
              onClick={() => setFilterEventType("")}
            >
              All
            </Button>
            {uniqueEventTypes.map((type) => (
              <Button
                key={type}
                variant={filterEventType === type ? "primary" : "outline"}
                size="sm"
                onClick={() => setFilterEventType(type)}
              >
                {EVENT_TYPE_LABELS[type]}
              </Button>
            ))}
          </div>
        )}
      </Card>

      {currentEvent && (
        <Card className="p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                {formatDate(currentEvent.timestamp)}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="neutral">{EVENT_TYPE_LABELS[currentEvent.event_type]}</Badge>
                {currentEvent.actor_id && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="size-3" />
                    {currentEvent.actor_id}
                  </span>
                )}
              </div>
            </div>
            <a
              href={`/${entityType}/${entityId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="size-3.5" />
              View Record
            </a>
          </div>

          <div className="space-y-3">
            {currentEvent.previous_state && Object.keys(currentEvent.previous_state).length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Previous State</div>
                <div className="text-sm bg-muted/50 rounded-md p-3 font-mono">
                  {formatChange(currentEvent.previous_state)}
                </div>
              </div>
            )}

            {currentEvent.previous_state && currentEvent.new_state && (
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="size-4 text-muted-foreground" />
              </div>
            )}

            {currentEvent.new_state && Object.keys(currentEvent.new_state).length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">New State</div>
                <div className="text-sm bg-primary/5 rounded-md p-3 font-mono border border-primary/10">
                  {formatChange(currentEvent.new_state)}
                </div>
              </div>
            )}

            {currentEvent.metadata && Object.keys(currentEvent.metadata).length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Metadata</div>
                <div className="text-sm bg-muted/30 rounded-md p-3 font-mono text-muted-foreground">
                  {formatChange(currentEvent.metadata)}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {events.length > 0 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
            disabled={currentIndex <= 0}
          >
            <SkipBack className="size-4" />
          </Button>
          <Button
            variant="primary"
            size="icon"
            onClick={handlePlay}
            className="gap-1.5 min-w-[100px]"
          >
            {isPlaying ? (
              <>
                <Pause className="size-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="size-4" />
                {currentIndex < 0 ? "Play" : "Resume"}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            disabled={currentIndex >= filteredEvents.length - 1}
          >
            <SkipForward className="size-4" />
          </Button>
        </div>
      )}

      {events.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            Timeline ({filteredEvents.length} events)
          </div>
          <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2">
            {filteredEvents.map((event, index) => {
              const isActive = index === currentIndex;
              const isPast = index < currentIndex;

              return (
                <button
                  key={event.id}
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentIndex(index);
                  }}
                  className={`w-full text-left rounded-md p-3 transition-colors border ${
                    isActive
                      ? "bg-primary/5 border-primary/20"
                      : isPast
                        ? "bg-muted/30 border-transparent opacity-70"
                        : "bg-background border-transparent opacity-40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={isActive ? "primary" : "neutral"}
                        className="text-xs"
                      >
                        {EVENT_TYPE_LABELS[event.event_type]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(event.timestamp)}
                      </span>
                    </div>
                    {event.actor_id && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="size-3" />
                        {event.actor_id}
                      </span>
                    )}
                  </div>
                  {isActive && event.new_state && Object.keys(event.new_state).length > 0 && (
                    <div className="mt-2 text-sm font-mono bg-muted/50 rounded p-2">
                      {formatChange(event.new_state)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!events.length && !loading && (
        <Card className="p-8 text-center text-muted-foreground">
          <p>Select a customer, lead, deal, or employee to view its event history.</p>
        </Card>
      )}

      {loading && (
        <Card className="p-8 text-center text-muted-foreground">
          <p>Loading events...</p>
        </Card>
      )}
    </div>
  );
}
