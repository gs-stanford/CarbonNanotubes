"use client";

import { useEffect, useRef, useState } from "react";
import type { PlotRecord } from "@/lib/data";
import type { FigureResponse, FigureSelectionResponse } from "@/lib/figure-api";

export function useFigureSelection(figure: FigureResponse | null, selectedId: string | null) {
  const cache = useRef(new Map<string, PlotRecord>());
  const token = figure?.selection_context?.token;
  const release = figure?.release.release_id;
  const key = token && selectedId ? `${token}:${selectedId}` : null;
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<{ key: string | null; error: string | null; expired: boolean }>({ key: null, error: null, expired: false });
  const initialRecord = figure?.selected_record?.record_id === selectedId ? figure.selected_record : null;

  useEffect(() => {
    if (!key || !selectedId || !token) return;
    setStatus({ key, error: null, expired: false });
    if (cache.current.has(key)) return;
    const remember = (record: PlotRecord) => {
      cache.current.set(key, record);
      if (cache.current.size > 32) cache.current.delete(cache.current.keys().next().value!);
      setStatus({ key, error: null, expired: false });
    };
    if (initialRecord) { remember(initialRecord); return; }
    const controller = new AbortController();
    let cancelled = false;
    let timedOut = false;
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
    void (async () => {
      try {
        const response = await fetch("/api/v1/figures/selection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context_token: token, record_id: selectedId }),
          signal: controller.signal
        });
        const payload = await response.json() as FigureSelectionResponse & { error?: { code?: string; message?: string } };
        if (cancelled) return;
        if (!response.ok) {
          setStatus({ key, error: payload.error?.message || "Point details could not be loaded.", expired: payload.error?.code === "selection_expired" });
          return;
        }
        if (payload.record.record_id !== selectedId || payload.release.release_id !== release) throw new Error("Point details did not match this figure.");
        remember(payload.record);
      } catch (error) {
        if (!cancelled) setStatus({ key, error: timedOut ? "Point details timed out. Please retry." : error instanceof Error ? error.message : "Point details could not be loaded.", expired: false });
      } finally {
        window.clearTimeout(timer);
      }
    })();
    return () => { cancelled = true; controller.abort(); window.clearTimeout(timer); };
  }, [key, selectedId, token, release, initialRecord, attempt]);

  return {
    record: key ? cache.current.get(key) ?? initialRecord : null,
    error: selectedId && figure && !token ? "Refresh the figure to load point details." : status.key === key ? status.error : null,
    expired: Boolean(selectedId && figure && !token) || (status.key === key && status.expired),
    retry: () => setAttempt(value => value + 1)
  };
}
