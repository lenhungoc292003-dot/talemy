import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Talemy · AI Skill Test Round 2",
  description: "Bài đánh giá thực hành năng lực ứng dụng AI trong công việc theo khung 4D.",
  openGraph: {
    title: "Talemy · AI Skill Test Round 2",
    description: "Work sample đánh giá Delegation, Description, Discernment và Diligence.",
    images: [{ url: "/social-preview.png", width: 1200, height: 630, alt: "Talemy AI Skill Test Round 2" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Talemy · AI Skill Test Round 2",
    description: "Work sample đánh giá năng lực ứng dụng AI trong công việc.",
    images: ["/social-preview.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
