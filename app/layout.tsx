import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// [NEW] 토스트 프로바이더 임포트
import { ToastProvider } from "@/app/components/ToastProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NBBANG - 정산의 시작",
  description: "쉽고 빠른 1/N 정산 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        {/* [NEW] 여기서 감싸주면 앱 어디서든 showToast를 쓸 수 있음! */}
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}