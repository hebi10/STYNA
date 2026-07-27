import type { Metadata, Viewport } from "next";
import "./globals.css";
import "../styles/variables.css";
import Header from "./_components/header/Header";
import Footer from "./_components/footer/Footer";
import RootProviders from "./_components/providers/RootProviders";
import ChatWidget from "./_components/chat/ChatWidget";
import SiteGuideManager from "./_components/popup/SiteGuideManager";
import { rootMetadata } from "@/shared/constants/routeMetadata";

export const metadata: Metadata = rootMetadata;

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <RootProviders>
          <Header />
          <main style={{ minHeight: "100vh" }}>{children}</main>
          <Footer />
          <ChatWidget />
          <SiteGuideManager />
        </RootProviders>
      </body>
    </html>
  );
}
