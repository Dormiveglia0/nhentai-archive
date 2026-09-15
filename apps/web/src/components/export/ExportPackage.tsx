import { m } from "motion/react";
import { FileCode2, FileJson, Images, Package } from "lucide-react";
import type { ExportOptions } from "../../lib/api";
import { usePrefersReducedMotion } from "../../lib/motion";
import "./ExportPackage.css";

export function ExportPackage({options,onChange}:{options:ExportOptions;onChange:(key:keyof ExportOptions,value:boolean)=>void}) {
  const reduce=usePrefersReducedMotion();
  const transition=reduce?{duration:0}:{type:'spring' as const,stiffness:230,damping:27};
  return <section className={`export-package-map${options.compress?' is-compressed':''}`} aria-label="打包内容">
    <header><Package size={17}/><strong>CBZ</strong><label><input type="checkbox" checked={options.compress} onChange={e=>onChange('compress',e.target.checked)} aria-label="标准压缩"/><span>压缩</span></label></header>
    <div className="export-package-layers">
      {[{key:'write_comicinfo' as const,label:'ComicInfo.xml',detail:'作品元数据',Icon:FileCode2},{key:'keep_json' as const,label:'JSON',detail:'保留源数据',Icon:FileJson}].map(({key,label,detail,Icon},i)=>
        <m.label key={key} className={options[key]?'is-included':''} animate={{x:options[key]?0:18,y:options.compress ? i*-6:0}} transition={transition}>
          <input type="checkbox" checked={options[key]} onChange={e=>onChange(key,e.target.checked)} aria-label={key==='keep_json'?'保留 JSON':'写入 ComicInfo.xml'}/><Icon size={22}/><span><strong>{label}</strong><small>{detail}</small></span><i>{options[key]?'＋':'−'}</i>
        </m.label>)}
      <m.div className="export-package-pages" animate={{y:options.compress?-12:0}} transition={transition}><Images size={22}/><span><strong>漫画页面</strong><small>原始画面</small></span><i>CBZ</i></m.div>
    </div>
  </section>;
}
