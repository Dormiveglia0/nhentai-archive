import { Check } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useState } from "react";

import { duration, ease } from "../../lib/motion";
import { type FolioPageId, type SettingsSection } from "../folio/config";
import { FolioChrome } from "../folio/shell/FolioChrome";
import { DemoPage } from "./modules/DemoPage";
import { DemoCommandBar } from "./ui/DemoCommandBar";

export function FrontendDemo() {
  const [page, setPage] = useState<FolioPageId>("workbench");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("connection");
  const [settingsRevision, setSettingsRevision] = useState(0);
  const [privacy, setPrivacy] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const previous = document.title;
    document.title = "NH Archive · 前端演示";
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function resetSettings() {
    setSettingsRevision((value) => value + 1);
    setSettingsSection("connection");
    setNotice("已恢复演示页初始状态，未读取任何本地配置。");
  }

  return (
    <FolioChrome
      page={page}
      privacy={privacy}
      onPrivacyChange={setPrivacy}
      onNavigate={setPage}
      scrollKey={settingsSection}
      footer={<DemoCommandBar page={page} onNavigate={setPage} onResetSettings={resetSettings} announce={setNotice} />}
      overlay={
        <AnimatePresence>
          {notice ? (
            <m.div className="folio-notice" role="status" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: duration.fast, ease: ease.standard }}>
              <Check size={16} />
              {notice}
            </m.div>
          ) : null}
        </AnimatePresence>
      }
    >
      <DemoPage
        page={page}
        settingsSection={settingsSection}
        onSettingsSection={setSettingsSection}
        settingsRevision={settingsRevision}
        onNavigate={setPage}
        announce={setNotice}
      />
    </FolioChrome>
  );
}
