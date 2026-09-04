import type { ReactNode } from "react";

import { AuthWakeDemo } from "./AuthWakeDemo";

type Props = {
  children: (logout: () => Promise<void>) => ReactNode;
};

export function AuthGate({ children }: Props) {
  return <AuthWakeDemo>{children}</AuthWakeDemo>;
}
