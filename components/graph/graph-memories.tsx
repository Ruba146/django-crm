"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { EntityType, MemoryType } from "@/types/graph";
import { MEMORY_TYPE_CONFIG } from "@/types/graph";

interface GraphMemoriesProps {
  entityType: EntityType;
  entityId: string;
  entityLabel: string;
}

export function GraphMemories({ entityType, entityId, entityLabel }: GraphMemoriesProps) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [memoryType, setMemoryType] = useState<MemoryType>("note");
  const [source, setSource] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const memoriesQuery = useQuery({
    queryKey: ["graph-memories", entityType, entityId],
    queryFn: async () => {
      const res = await fetch(`/api/graph/memories?entity_type=${entityType}&entity_id=${entityId}`);
      if (!res.ok) return { memories: [] };
      const data = await res.json();
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/graph/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          memory_type: memoryType,
          content,
          source: source || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create memory");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["graph-memories", entityType, entityId] });
      setContent("");
      setSource("");
      setMemoryType("note");
      setIsCreating(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/graph/memories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete memory");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["graph-memories", entityType, entityId] });
    },
  });

  const memories = memoriesQuery.data?.memories || [];

  return (
    <Card className="space-y-4 bg-[#0B1120] border-white/10">
      <div>
        <h3 className="text-lg font-semibold text-slate-100">Organizational Memory</h3>
        <p className="text-sm text-slate-400">
          {entityLabel} ({entityType})
        </p>
      </div>

      {!isCreating ? (
        <Button variant="outline" size="sm" onClick={() => setIsCreating(true)} className="w-full border-white/10 text-slate-300 hover:bg-white/5 hover:text-white">
          <Plus className="mr-2 size-4" />
          Add Memory
        </Button>
      ) : (
        <div className="space-y-3 rounded-md border border-white/10 p-3 bg-[#050A14]">
          <Select
            value={memoryType}
            onChange={(e) => setMemoryType(e.target.value as MemoryType)}
            className="w-full"
            options={[
              { value: "decision", label: "Decision" },
              { value: "context", label: "Context" },
              { value: "lesson", label: "Lesson" },
              { value: "note", label: "Note" },
            ]}
          />
          <Textarea
            placeholder="Enter memory content..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="bg-[#0B1120] border-white/10 text-slate-200 placeholder:text-slate-500"
          />
          <input
            type="text"
            placeholder="Source (optional)"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full rounded-md border border-white/10 px-3 py-2 text-sm bg-[#0B1120] text-slate-200 placeholder:text-slate-500"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={!content.trim() || createMutation.isPending}
              className="bg-purple-600 hover:bg-purple-500 text-white"
            >
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsCreating(false);
                setContent("");
                setSource("");
              }}
              className="text-slate-400 hover:text-white hover:bg-white/5"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {memories.length === 0 ? (
          <p className="text-sm text-slate-500">No memories recorded yet.</p>
        ) : (
          memories.map((mem: { id: string; memory_type: string; content: string; source?: string; created_at: string }) => (
            <div key={mem.id} className="rounded-md border border-white/10 p-3 space-y-1 bg-[#050A14]">
              <div className="flex items-center justify-between">
                <Badge
                  variant="outline"
                  style={{
                    borderColor: MEMORY_TYPE_CONFIG[mem.memory_type as MemoryType]?.color || "#6b7280",
                    color: MEMORY_TYPE_CONFIG[mem.memory_type as MemoryType]?.color || "#6b7280",
                  }}
                >
                  {MEMORY_TYPE_CONFIG[mem.memory_type as MemoryType]?.label || mem.memory_type}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-slate-500 hover:text-slate-200 hover:bg-white/5"
                  onClick={() => deleteMutation.mutate(mem.id)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
              <p className="text-sm text-slate-300">{mem.content}</p>
              {mem.source && <p className="text-xs text-slate-500">Source: {mem.source}</p>}
              <p className="text-xs text-slate-400">
                {new Date(mem.created_at).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
