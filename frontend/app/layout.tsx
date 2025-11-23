import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "@radix-ui/themes/styles.css";
import "./globals.css";
import { Theme } from "@radix-ui/themes";
import ToastProvider from "./components/ToastProvider";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "DIVERGENCE | The Agentic Risk Terminal",
  description: "Real-time risk console for high-frequency traders",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} antialiased`}>
        <Theme
          appearance="dark"
          accentColor="red"
          grayColor="slate"
          radius="medium"
          scaling="100%"
        >
          <ToastProvider />
          {children}
        </Theme>
      </body>
    </html>
  );
}
