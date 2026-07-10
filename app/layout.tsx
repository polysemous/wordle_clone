import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daily Word — A Bible Word Puzzle",
  description: "A thoughtful daily five-letter word puzzle with friendly competition.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
