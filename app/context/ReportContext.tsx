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
  /** Per-client PDF URL forwarded to <ReportViewer>'s download link.
   *  Omit when no PDF is available — the link will be hidden. */
  pdfPath?: string;
}

export function ReportProvider({ children, pdfPath }: ReportProviderProps) {
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
        pdfPath={pdfPath}
      />
    </ReportCtx.Provider>
  );
}

export function useReport() {
  return useContext(ReportCtx);
}
