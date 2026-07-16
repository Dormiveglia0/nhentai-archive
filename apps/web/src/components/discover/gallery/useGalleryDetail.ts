import { useCallback, useEffect, useRef, useState } from "react";

import { api, type GalleryDetail } from "../../../lib/api";
import { navigate } from "../../../lib/navigation";
import { galleryTitle } from "./galleryDetailModel";

export function useGalleryDetail(galleryId: number, returnTo?: string) {
  const [detail, setDetail] = useState<GalleryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [queued, setQueued] = useState(false);
  const [revision, setRevision] = useState(0);
  const detailRequest = useRef(0);
  const importRequest = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      detailRequest.current += 1;
      importRequest.current += 1;
    };
  }, []);

  useEffect(() => {
    const request = ++detailRequest.current;
    setDetail(null);
    setLoading(true);
    setError(null);
    setNotice(null);
    setQueued(false);
    api.gallery(galleryId)
      .then((payload) => {
        if (request === detailRequest.current) setDetail(payload);
      })
      .catch((reason: Error) => {
        if (request === detailRequest.current) setError(reason.message);
      })
      .finally(() => {
        if (request === detailRequest.current) setLoading(false);
      });
    return () => { detailRequest.current += 1; };
  }, [galleryId, revision]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const goBack = useCallback(() => {
    if (returnTo) {
      window.history.replaceState(null, "", `#${returnTo}`);
      window.dispatchEvent(new Event("hashchange"));
      return;
    }
    navigate({ name: "discover" });
  }, [returnTo]);

  const read = useCallback(() => {
    if (!detail) return;
    if (detail.imported && detail.work_id) navigate({ name: "reader", workId: detail.work_id });
    else navigate({ name: "readerRemote", galleryId: detail.gallery_id });
  }, [detail]);

  const enqueue = useCallback(async () => {
    if (!detail || importing || queued) return;
    const request = ++importRequest.current;
    setImporting(true);
    setError(null);
    try {
      await api.importGallery(detail.gallery_id);
      if (!mounted.current || request !== importRequest.current) return;
      setQueued(true);
      setNotice("已加入真实导入队列，可在任务中心查看进度。");
    } catch (reason) {
      if (mounted.current && request === importRequest.current) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    } finally {
      if (mounted.current && request === importRequest.current) setImporting(false);
    }
  }, [detail, importing, queued]);

  return {
    detail,
    title: detail ? galleryTitle(detail) : "",
    loading,
    error,
    notice,
    importing,
    queued,
    goBack,
    read,
    enqueue,
    reload: () => setRevision((value) => value + 1),
  };
}
