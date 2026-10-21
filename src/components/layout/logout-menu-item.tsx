"use client";

import { LogOut } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/app/login/actions";

export function LogoutMenuItem() {
  return (
    <DropdownMenuItem variant="destructive" onClick={() => logoutAction()}>
      <LogOut className="size-4" />
      Sair do Sistema
    </DropdownMenuItem>
  );
}
