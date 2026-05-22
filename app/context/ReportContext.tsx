"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import ReportViewer from "@/components/audit/ReportViewer";

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
}

export function ReportProvider({ children }: ReportProviderProps) {
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
      />
    </ReportCtx.Provider>
  );
}

export function useReport() {
  return useContext(ReportCtx);
}
