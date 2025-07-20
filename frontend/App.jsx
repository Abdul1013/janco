import React from "react";
import { AuthProvider } from "./App/hooks/authContext";
import AppContent from "./App/components/AppContent"; 

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
