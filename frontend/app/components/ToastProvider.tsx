"use client";

import { Toaster } from "react-hot-toast";

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: "var(--slate-3)",
          color: "var(--slate-12)",
          border: "1px solid var(--slate-6)",
          fontSize: "14px",
        },
        success: {
          iconTheme: {
            primary: "var(--green-9)",
            secondary: "var(--slate-1)",
          },
        },
        error: {
          iconTheme: {
            primary: "var(--red-9)",
            secondary: "var(--slate-1)",
          },
        },
      }}
    />
  );
}
