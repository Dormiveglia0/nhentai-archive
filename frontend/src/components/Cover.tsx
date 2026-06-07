import { useEffect, useState } from 'react';

export function Cover({ src, title, selected, token }: { src?: string | null; title: string; selected?: boolean; token?: string | null }) {
  const [failed, setFailed] = useState(false);
  const [objectUrl, setObjectUrl] = useState('');
  const needsAuthorizedFetch = Boolean(src?.startsWith('/api/') && token);
  const imageSrc = needsAuthorizedFetch ? objectUrl : (objectUrl || src || '');
  const showImage = Boolean(imageSrc) && !failed;

  useEffect(() => {
    setFailed(false);
    setObjectUrl('');
    if (!src || !needsAuthorizedFetch) return undefined;
    let cancelled = false;
    let nextUrl = '';
    fetch(src, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => {
        if (!response.ok) throw new Error(response.statusText);
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        nextUrl = URL.createObjectURL(blob);
        setObjectUrl(nextUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [src, token, needsAuthorizedFetch]);

  return (
    <div className={`cover-frame ${selected ? 'selected' : ''}`}>
      {showImage ? (
        <img src={imageSrc} alt={title} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div className="cover-placeholder" aria-label={`${title} 封面占位`}>
          <span />
          <strong>{initials(title)}</strong>
          <em />
        </div>
      )}
    </div>
  );
}

function initials(value: string) {
  const clean = value.replace(/[^\p{Letter}\p{Number}]+/gu, '').trim();
  return clean.slice(0, 2).toUpperCase() || 'NH';
}
