"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { AuditResult } from "@/engine/runAudit";
import ReportViewer from "@/components/audit/ReportViewer";

export interface ReportBranding {
  agencyLogo?: string;
  agencyLogoLight?: string;
  clientLogo?: string;
  clientLogoLight?: string;
}

interface ReportContextValue {
  openReport: (page: number) => void;
  closeReport: () => void;
  openPage: number | null;
}

const ReportCtx = createContext<ReportContextValue>({
  openReport: () => {},
  closeReport: () => {},
  openPage: null,
});

interface ReportProviderProps {
  children: ReactNode;
  /** Audit result to render inside the report viewer. */
  audit: AuditResult;
  /** Live benchmark sliders (so the report reflects what the user is exploring). */
  liveCpl: number;
  liveCtr: number;
  /** Industry slug for benchmark labels. */
  industry: string;
  /** Agency + client logos so the report header is properly branded. */
  branding: ReportBranding;
}

export function ReportProvider({
  children,
  audit,
  liveCpl,
  liveCtr,
  industry,
  branding,
}: ReportProviderProps) {
  const [openPage, setOpenPage] = useState<number | null>(null);

  const openReport = (page: number) => setOpenPage(page);
  const closeReport = () => setOpenPage(null);

  return (
    <ReportCtx.Provider value={{ openReport, closeReport, openPage }}>
      {children}
      <ReportViewer
        open={openPage !== null}
        page={openPage ?? 1}
        onClose={closeReport}
        audit={audit}
        liveCpl={liveCpl}
        liveCtr={liveCtr}
        industry={industry}
        branding={branding}
      />
    </ReportCtx.Provider>
  );
}

export function useReport() {
  return useContext(ReportCtx);
}
