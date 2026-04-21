"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Menu } from "@base-ui/react/menu";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const { data: session } = useSession();
  if (!session?.user) return null;

  const { name, email, image } = session.user;
  const initials = (name ?? email ?? "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu>
      <Menu.Trigger
        className={cn(
          "flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground",
          "text-sm font-medium overflow-hidden focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "cursor-pointer"
        )}
        aria-label="User menu"
      >
        {image ? (
          <Image src={image} alt={name ?? "User"} width={32} height={32} className="object-cover" />
        ) : (
          <span>{initials}</span>
        )}
      </Menu.Trigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium leading-none truncate">{name ?? "User"}</p>
          {email && (
            <p className="text-xs text-muted-foreground mt-1 truncate">{email}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive cursor-pointer"
          onClick={() => signOut({ callbackUrl: "/signin" })}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
