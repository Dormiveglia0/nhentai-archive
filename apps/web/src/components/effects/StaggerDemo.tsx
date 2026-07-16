// 示例组件:验证 motion 原语链路(逐项进场)。仅用于阶段 0 验收,不接入真实页面。
import { Stagger, StaggerItem } from "../../lib/motion";

const SAMPLE = ["其一", "其二", "其三", "其四"];

export function StaggerDemo() {
  return (
    <Stagger className="fx-scope">
      {SAMPLE.map((label) => (
        <StaggerItem key={label}>
          <div
            style={{
              padding: "16px 20px",
              marginBottom: 8,
              background: "var(--surface-solid)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              color: "var(--ink)",
              boxShadow: "var(--shadow)",
            }}
          >
            {label}
          </div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
