import type { Metadata } from "next";
import "./globals.css";
import NavbarWrapper from "@/components/NavbarWrapper";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "eFootball Arena — AI-Powered Challenge Platform",
  description: "Challenge your friends in eFootball. Submit results with proof, climb the rankings, become the Lord.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <AuthProvider>
          <NavbarWrapper />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
