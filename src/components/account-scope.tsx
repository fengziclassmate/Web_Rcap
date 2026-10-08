"use client";

import { createContext, useContext } from "react";

export const AccountScope = createContext<string | null>(null);
export function useAccountId() {
  return useContext(AccountScope);
}
