import "./RouteFallback.css";

function PageSheets() {
  return <span className="route-loading-sheets" aria-hidden="true"><i /><i /><i /></span>;
}

export function FolioRouteFallback() {
  return (
    <section className="folio-route-loading" role="status" aria-label="正在读取页面">
      <PageSheets />
      <span><strong>正在读取页面</strong><small>整理真实本机数据与界面状态</small></span>
    </section>
  );
}

export function ReaderRouteFallback() {
  return (
    <section className="reader-route-loading" role="status" aria-label="正在打开阅读器">
      <PageSheets />
      <span><strong>正在打开阅读器</strong><small>装载页面索引</small></span>
    </section>
  );
}
