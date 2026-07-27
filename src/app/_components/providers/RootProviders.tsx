'use client';

import { AuthProvider } from "@/context/authProvider";
import { ScrollToTop } from "../ScrollToTop";
import ReactQueryProvider from "./ReactQueryProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ReactQueryProvider>
      <AuthProvider>
        <ScrollToTop />
        {children}
      </AuthProvider>
    </ReactQueryProvider>
  );
}
