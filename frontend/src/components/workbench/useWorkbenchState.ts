import { useCallback, useEffect, useState } from "react";

import { api, WorkbenchOverview } from "../../lib/api";

export function useWorkbenchState() {
  const [overview, setOverview] = useState<WorkbenchOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await api.workbenchOverview();
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法加载工作台数据");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("initial");
  }, [load]);

  const refresh = useCallback(() => load("refresh"), [load]);

  return { overview, loading, refreshing, error, refresh };
}
