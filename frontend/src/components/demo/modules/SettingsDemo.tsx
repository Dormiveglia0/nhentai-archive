import { BarChart3, Check, Eye, EyeOff, HardDrive } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useState } from "react";

import { duration, ease } from "../../../lib/motion";
import { SETTINGS_SECTIONS, type SettingsSection } from "../config";
import { DemoField, DemoSelect, EmptyCanvas, ToggleRow } from "../ui/DemoPrimitives";

export function SettingsDemo({
  section,
  onSection,
  announce,
}: {
  section: SettingsSection;
  onSection: (section: SettingsSection) => void;
  announce: (message: string) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
  const [provider, setProvider] = useState<"google" | "deepl">("google");
  const [language, setLanguage] = useState<"zh-CN" | "zh-TW">("zh-CN");
  const [batch, setBatch] = useState("20");
  const [privacy, setPrivacy] = useState(true);
  const [blur, setBlur] = useState(true);
  const [reader, setReader] = useState<"single" | "scroll">("single");
  const [comicInfo, setComicInfo] = useState(true);
  const [json, setJson] = useState(true);
  const [compress, setCompress] = useState(true);
  const current = SETTINGS_SECTIONS.find((item) => item.id === section) ?? SETTINGS_SECTIONS[0];

  return (
    <div className="folio-demo-page-body folio-demo-settings-body">
      <nav className="folio-demo-settings-nav" aria-label="设置章节">
        {SETTINGS_SECTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" className={section === item.id ? "is-active" : ""} aria-current={section === item.id ? "page" : undefined} onClick={() => onSection(item.id)}>
              {section === item.id ? (
                <m.span className="folio-demo-settings-nav-active" layoutId="folio-demo-settings-nav-active" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
              ) : null}
              <Icon size={16} />
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </button>
          );
        })}
      </nav>

      <AnimatePresence mode="wait" initial={false}>
        <m.section
          key={section}
          className="folio-demo-settings-stage"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: duration.fast, ease: ease.standard }}
        >
          <div className="folio-demo-settings-head">
            <div>
              <h2>{current.label}</h2>
              <p>{current.description}</p>
            </div>
            <div className="folio-demo-settings-state"><i />演示配置</div>
          </div>

          {section === "connection" ? (
            <>
              <div className="folio-demo-field-matrix">
                <label className="folio-demo-field folio-demo-field-wide">
                  <span>NH API Key</span>
                  <div className="folio-demo-secret">
                    <input type={keyVisible ? "text" : "password"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="公开演示不会发送或保存密钥" autoComplete="off" />
                    <button type="button" aria-label={keyVisible ? "隐藏密钥" : "显示密钥"} onClick={() => setKeyVisible((value) => !value)}>
                      {keyVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>
                <DemoField label="Base URL" placeholder="演示环境未连接" readOnly />
                <DemoField label="请求超时（秒）" placeholder="—" readOnly />
                <DemoField label="User-Agent" placeholder="—" readOnly wide />
              </div>
              <div className="folio-demo-editor-actions">
                <button className="folio-demo-line-button" type="button" onClick={() => announce("演示环境未连接后端，未执行远端验证。")}>验证连接</button>
                <button className="folio-demo-line-button" type="button" onClick={() => setApiKey("")} disabled={!apiKey}>清除 Key</button>
              </div>
            </>
          ) : null}

          {section === "translation" ? (
            <>
              <div className="folio-demo-choice-row">
                <button className={provider === "google" ? "is-active" : ""} type="button" onClick={() => setProvider("google")}>
                  {provider === "google" ? <m.i className="folio-demo-choice-active" layoutId="folio-demo-provider-active" /> : null}
                  <span>Google 免费翻译</span><small>无需 API Key</small><Check size={16} />
                </button>
                <button className={provider === "deepl" ? "is-active" : ""} type="button" onClick={() => setProvider("deepl")}>
                  {provider === "deepl" ? <m.i className="folio-demo-choice-active" layoutId="folio-demo-provider-active" /> : null}
                  <span>DeepL API</span><small>需要独立 Key</small><Check size={16} />
                </button>
              </div>
              <div className="folio-demo-field-matrix">
                <DemoSelect label="目标语言" value={language} onChange={setLanguage} options={[
                  { value: "zh-CN", label: "简体中文" },
                  { value: "zh-TW", label: "繁体中文" },
                ]} />
                <DemoField label="批量建议数量" value={batch} onChange={setBatch} type="number" />
                {provider === "deepl" ? <DemoField label="DeepL API Key" placeholder="公开演示不会发送或保存密钥" wide /> : null}
              </div>
            </>
          ) : null}

          {section === "privacy" ? (
            <>
              <div className="folio-demo-toggle-list">
                <ToggleRow label="隐私模式默认开启" copy="页面切换时保持敏感信息收敛。" checked={privacy} onChange={setPrivacy} />
                <ToggleRow label="封面模糊默认开启" copy="媒体内容在主动操作前保持模糊。" checked={blur} onChange={setBlur} />
              </div>
              <div className="folio-demo-segment-field">
                <span>默认阅读模式</span>
                <div>
                  <button className={reader === "single" ? "is-active" : ""} type="button" onClick={() => setReader("single")}>
                    {reader === "single" ? <m.span className="folio-demo-control-active" layoutId="folio-demo-reader-active" /> : null}<span>单页</span>
                  </button>
                  <button className={reader === "scroll" ? "is-active" : ""} type="button" onClick={() => setReader("scroll")}>
                    {reader === "scroll" ? <m.span className="folio-demo-control-active" layoutId="folio-demo-reader-active" /> : null}<span>连续滚动</span>
                  </button>
                </div>
              </div>
            </>
          ) : null}

          {section === "export" ? (
            <div className="folio-demo-toggle-list">
              <ToggleRow label="写入 ComicInfo.xml" copy="导出时生成标准漫画元数据。" checked={comicInfo} onChange={setComicInfo} />
              <ToggleRow label="保留原始 JSON" copy="保留源归档中已有的 JSON 元数据。" checked={json} onChange={setJson} />
              <ToggleRow label="标准压缩" copy="以较小体积生成新的 CBZ 文件。" checked={compress} onChange={setCompress} />
            </div>
          ) : null}

          {section === "data" ? (
            <EmptyCanvas icon={BarChart3} title="演示环境未连接本地馆藏" copy="这里不会生成统计数字。接入真实后端后，再显示馆藏、阅读进度和语言分布。" />
          ) : null}

          {section === "storage" ? (
            <>
              <div className="folio-demo-field-matrix">
                <DemoField label="数据目录" placeholder="公开演示不读取本机路径" readOnly wide />
                <DemoField label="源文件占用" placeholder="—" readOnly />
                <DemoField label="可回收空间" placeholder="—" readOnly />
              </div>
              <EmptyCanvas icon={HardDrive} title="存储状态保持空白" copy="磁盘占用、缺失源文件与清理建议只会来自真实本机数据。" />
            </>
          ) : null}
        </m.section>
      </AnimatePresence>
    </div>
  );
}


