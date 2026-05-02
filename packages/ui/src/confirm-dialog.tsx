"use client";

// useConfirm() — Promise-based replacement for window.confirm().
//
// Usage:
//   const { confirm, ConfirmDialog } = useConfirm();
//   ...
//   <ConfirmDialog />   {/* mount once near root of your component */}
//   ...
//   if (await confirm({ title: "Delete invoice?", confirmLabel: "Delete" })) {
//     // user said yes
//   }
//
// We deliberately pair the hook with a render-here component instead of
// providing a global Provider, so the dialog appears in the same React tree
// as the caller (focus trap, portal, etc. behave correctly inside modals
// and side sheets).

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Button } from "./button";

export type ConfirmOptions = {
  title?: string;
  /** Body text. Pass a string for the common case, or a node for richer copy. */
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Use the destructive button variant — for delete/clear/discard flows. */
  destructive?: boolean;
};

type State =
  | { open: false }
  | { open: true; opts: ConfirmOptions; resolve: (v: boolean) => void };

export function useConfirm() {
  const [state, setState] = React.useState<State>({ open: false });

  const confirm = React.useCallback((opts: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, opts, resolve });
    });
  }, []);

  const close = React.useCallback(
    (value: boolean) => {
      setState((s) => {
        if (s.open) s.resolve(value);
        return { open: false };
      });
    },
    [],
  );

  const ConfirmDialog = React.useCallback(
    () => (
      <Dialog
        open={state.open}
        onOpenChange={(open) => {
          // If the user dismisses (esc / overlay click), treat as cancel.
          if (!open) close(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {state.open ? state.opts.title ?? "Are you sure?" : ""}
            </DialogTitle>
            {state.open && state.opts.description ? (
              <DialogDescription>{state.opts.description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => close(false)}>
              {state.open ? state.opts.cancelLabel ?? "Cancel" : "Cancel"}
            </Button>
            <Button
              variant={
                state.open && state.opts.destructive ? "destructive" : "default"
              }
              onClick={() => close(true)}
              autoFocus
            >
              {state.open ? state.opts.confirmLabel ?? "Confirm" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    ),
    [state, close],
  );

  return { confirm, ConfirmDialog };
}
