import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Image from "next/image";
import { Audiowide } from "next/font/google";

import { Press_Start_2P } from "next/font/google";

const arcade = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
});







export const metadata: Metadata = {
  title: "Quarters Music Bingo",
  description: "Music bingo for Quarters Nick's Bar & Grill",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      
        <body className={`${arcade.className} ...`}>






      
        {/* Global neon background */}
        
<div className="fixed inset-0 -z-10 overflow-hidden flex items-center justify-center">
  <Image
    src="/quarters-bg.jpg"
    alt="Quarters Nick's Bar & Grill neon background"
    width={2000}   // any large width, Next.js will adjust
    height={2000}
    priority
    className="pointer-events-none select-none"
    style={{
      transform: "scale(0.8)",   // <—— CHANGE THIS NUMBER YOURSELF
      objectFit: "contain",      // keeps full image visible
    }}
  />
</div>


        {/* All pages render on top of the background */}
        {children}
      </body>
    </html>
  );
}
