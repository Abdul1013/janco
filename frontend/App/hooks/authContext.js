import React, { createContext, useContext, useState } from 'react';
import { useAuth as useAuthHook } from './useAuth';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const auth = useAuthHook();
  // UI-only flag: lets a janitor temporarily browse the customer view.
  // Resets to false whenever the user logs out (hook re-mounts).
  const [viewAsCustomer, setViewAsCustomer] = useState(false);

  return (
    <AuthContext.Provider value={{ ...auth, viewAsCustomer, setViewAsCustomer }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
