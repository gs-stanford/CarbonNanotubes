import { randomBytes } from "node:crypto";
import type { PlotRecord } from "./data";
import type { ReleaseDescriptor } from "./query-store";
import type { FigureSelectionContext, FigureSelectionResponse } from "./figure-api";

type Snapshot = {
  expiresAt: number;
  release: ReleaseDescriptor;
  records: Map<string, string>;
  bytes: number;
};

// Opaque, short-lived contexts permit one plotted record at a time, never arbitrary IDs.
export class FigureSelectionStore {
  private contexts = new Map<string, Snapshot>();
  private bytes = 0;
  private options;
  constructor(options = { maxBytes: 16 * 1024 * 1024, maxContexts: 64, ttlMs: 15 * 60 * 1000, now: Date.now }) {
    this.options = options;
  }

  private remove(token: string) {
    const snapshot = this.contexts.get(token);
    if (snapshot) this.bytes -= snapshot.bytes;
    this.contexts.delete(token);
  }

  create(records: PlotRecord[], release: ReleaseDescriptor): FigureSelectionContext {
    const now = this.options.now();
    for (const [token, snapshot] of this.contexts) if (snapshot.expiresAt <= now) this.remove(token);
    const values = new Map(records.map(record => [record.record_id, JSON.stringify(record)]));
    const bytes = [...values].reduce((sum, [id, value]) => sum + Buffer.byteLength(id) + Buffer.byteLength(value), 0);
    if (bytes > this.options.maxBytes) throw new Error("Figure detail snapshot exceeds its memory budget.");
    while (this.contexts.size && (this.contexts.size >= this.options.maxContexts || this.bytes + bytes > this.options.maxBytes)) {
      this.remove(this.contexts.keys().next().value!);
    }
    const token = randomBytes(32).toString("base64url");
    const expiresAt = now + this.options.ttlMs;
    this.contexts.set(token, { expiresAt, release: { ...release }, records: values, bytes });
    this.bytes += bytes;
    return { token, expires_at: new Date(expiresAt).toISOString() };
  }

  read(token: string, recordId: string): FigureSelectionResponse | "expired" | "not_plotted" {
    const snapshot = this.contexts.get(token);
    if (!snapshot || snapshot.expiresAt <= this.options.now()) {
      this.remove(token);
      return "expired";
    }
    const record = snapshot.records.get(recordId);
    if (!record) return "not_plotted";
    this.contexts.delete(token);
    this.contexts.set(token, snapshot);
    return { api_version: "v1", release: { ...snapshot.release }, record: JSON.parse(record) as PlotRecord };
  }
}

// Next bundles each route separately; share the bounded store within the server process.
const server = globalThis as typeof globalThis & { icpmFigureSelections?: FigureSelectionStore };
export const figureSelections = server.icpmFigureSelections ??= new FigureSelectionStore();
