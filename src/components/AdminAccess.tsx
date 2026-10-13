import { createContext, useContext } from 'react';
export const AdminAccess = createContext(false);
export const useAdminAccess = () => useContext(AdminAccess);
