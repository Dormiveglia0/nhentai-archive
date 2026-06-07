export function Cover({ src, title, small }: { src: string; title: string; small?: boolean }) {
  return (
    <div className={`cover ${small ? 'small' : ''}`}>
      <img src={src} alt={title} loading="lazy" />
    </div>
  );
}
