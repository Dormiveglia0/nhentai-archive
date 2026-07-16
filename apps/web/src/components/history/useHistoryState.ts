import { useEffect, useRef, useState } from "react";

import { api, type ReadingHistoryPage } from "../../lib/api";

export function useHistoryState() {
  const [data, setData] = useState<ReadingHistoryPage | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    api
      .libraryReadingHistory(page)
      .then((payload) => {
        if (currentRequest === requestId.current) setData(payload);
      })
      .catch((err: Error) => {
        if (currentRequest === requestId.current) setError(err.message);
      })
      .finally(() => {
        if (currentRequest === requestId.current) setLoading(false);
      });
    return () => { requestId.current += 1; };
  }, [page, revision]);

  return { data, page, setPage, loading, error, reload: () => setRevision((value) => value + 1) };
}
