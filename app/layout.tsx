import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Talemy · AI Skill Assessment",
  description: "Bài đánh giá hai vòng đo AI literacy và năng lực ứng dụng AI trong công việc.",
  openGraph: {
    title: "Talemy · AI Skill Assessment",
    description: "Hiểu AI là bước đầu. Làm việc tốt với AI mới là năng lực.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Talemy · AI Skill Assessment",
    description: "Bài đánh giá hai vòng dành cho người đi làm.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
