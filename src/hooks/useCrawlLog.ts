import { useState, useCallback } from "react";
import { CrawlEntry } from "../components/FirecrawlTicker";

export function useCrawlLog() {
  const [log, setLog] = useState<CrawlEntry[]>([]);

  const addEntry = useCallback(
    (
      action: string,
      url: string,
      status: CrawlEntry["status"],
      result?: string
    ) => {
      const entry: CrawlEntry = {
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        action,
        url,
        status,
        result,
      };
      setLog((prev) => [entry, ...prev].slice(0, 5));
    },
    []
  );

  const updateLast = useCallback(
    (status: CrawlEntry["status"], result?: string) => {
      setLog((prev) => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        updated[0] = { ...updated[0], status, result };
        return updated;
      });
    },
    []
  );

  const clearLog = useCallback(() => setLog([]), []);

  return { log, addEntry, updateLast, clearLog };
}
