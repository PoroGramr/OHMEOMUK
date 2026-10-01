import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "오머먹 — 오늘 뭐 먹지?",
  description: "고민은 짧게, 점심은 맛있게. 내 주변 점심 추천.",
  verification: {
    google: "2RFSMEwVcjyWCzDxXFdBs6oHhxhsbhySm-QNfwWrPCY",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
