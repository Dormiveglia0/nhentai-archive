import { useEffect, useState } from "react";

import { api, type ReadingHistoryPage } from "../../lib/api";

export function useHistoryState() {
  const [data, setData] = useState<ReadingHistoryPage | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .libraryReadingHistory(page)
      .then((payload) => alive && setData(payload))
      .catch((err: Error) => alive && setError(err.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [page]);

  return { data, page, setPage, loading, error };
}
