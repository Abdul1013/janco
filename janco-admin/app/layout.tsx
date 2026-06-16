import type { Metadata } from "next";
import { Quicksand, Chewy } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/components/QueryProvider";
import { Toaster } from "sonner";

const quicksand = Quicksand({
  subsets: ["latin"],
  variable: "--font-quicksand",
  display: "swap",
});

const chewy = Chewy({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-chewy",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JANCO Admin",
  description: "JANCO platform operations dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      // Default to dark mode — matches existing admin panel
      className={`dark ${quicksand.variable} ${chewy.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-bg text-text antialiased">
          <QueryProvider>
            {children}
            <Toaster richColors position="top-right" />
          </QueryProvider>
        </body>
    </html>
  );
}
