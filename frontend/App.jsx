import React from "react";
import { AuthProvider } from "./App/hooks/authContext";
import { ThemeProvider } from "./App/constants/theme/ThemeContext";
import AppContent from "./App/components/AppContent";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
