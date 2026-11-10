"use client";

import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/** Ventana modal con título, descripción opcional y botón de cerrar. */
function Modal({
  open,
  onOpenChange,
  titulo,
  descripcion,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  titulo: string;
  descripcion?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
        <D.Content
          className={cn(
            "bg-background data-[state=open]:animate-in data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-xl border p-6 shadow-lg",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <D.Title className="text-lg font-semibold">{titulo}</D.Title>
              {descripcion ? (
                <D.Description className="text-muted-foreground text-sm">{descripcion}</D.Description>
              ) : (
                <D.Description className="sr-only">{titulo}</D.Description>
              )}
            </div>
            <D.Close
              className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 -mt-1 -mr-2 rounded-md p-2 outline-none focus-visible:ring-[3px]"
              aria-label="Cerrar"
            >
              <X className="size-4" />
            </D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export { Modal };
