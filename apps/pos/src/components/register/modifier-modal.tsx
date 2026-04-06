"use client";

import { useState } from "react";
import type { Product, ModifierOption } from "@/types/database";
import { displayRM } from "@/types/database";

type SelectedModifier = { group_name: string; option: ModifierOption };

type Props = {
  product: Product;
  onConfirm: (selectedModifiers: SelectedModifier[]) => void;
  onClose: () => void;
};

export function ModifierModal({ product, onConfirm, onClose }: Props) {
  // Store selections per group: single-select = one option, multi-select = array of options
  const [selections, setSelections] = useState<Record<string, ModifierOption[]>>(() => {
    const initial: Record<string, ModifierOption[]> = {};
    for (const group of product.modifiers) {
      if (group.max_select === 1 && group.is_required && group.options.length > 0) {
        // Auto-select first option for required single-select
        initial[group.group_name] = [group.options[0]];
      } else {
        initial[group.group_name] = [];
      }
    }
    return initial;
  });

  function isMultiSelect(group: { max_select: number }): boolean {
    return group.max_select > 1;
  }

  function toggleOption(groupName: string, option: ModifierOption, multi: boolean, maxSelect: number) {
    setSelections((prev) => {
      const current = prev[groupName] ?? [];

      if (multi) {
        // Multi-select: toggle the option in the array
        const exists = current.some((o) => o.name === option.name);
        if (exists) {
          return { ...prev, [groupName]: current.filter((o) => o.name !== option.name) };
        } else if (current.length < maxSelect) {
          return { ...prev, [groupName]: [...current, option] };
        }
        return prev; // max reached
      } else {
        // Single-select: replace or deselect
        const isSelected = current.length === 1 && current[0].name === option.name;
        return { ...prev, [groupName]: isSelected ? [] : [option] };
      }
    });
  }

  function isOptionSelected(groupName: string, optionName: string): boolean {
    return (selections[groupName] ?? []).some((o) => o.name === optionName);
  }

  function handleConfirm() {
    // Validate required groups
    for (const group of product.modifiers) {
      if (group.is_required && (selections[group.group_name] ?? []).length < group.min_select) {
        return;
      }
    }

    const selected: SelectedModifier[] = [];
    for (const [groupName, options] of Object.entries(selections)) {
      for (const option of options) {
        selected.push({ group_name: groupName, option });
      }
    }
    onConfirm(selected);
  }

  // Calculate total with modifiers
  const modifierTotal = Object.values(selections).flat().reduce((sum, o) => sum + o.price, 0);
  const totalPrice = product.price + modifierTotal;

  const allRequiredMet = product.modifiers
    .filter((g) => g.is_required)
    .every((g) => (selections[g.group_name] ?? []).length >= g.min_select);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-surface-raised shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold">{product.name}</h3>
            <p className="text-sm text-text-muted">Base price: {displayRM(product.price)}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-hover">&times;</button>
        </div>

        {/* Modifier groups */}
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {product.modifiers.map((group) => {
            const multi = isMultiSelect(group);
            return (
              <div key={group.group_name} className="mb-5 last:mb-0">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-semibold">{group.group_name}</span>
                  {group.is_required && (
                    <span className="rounded bg-brand/10 px-1.5 py-0.5 text-xs font-medium text-brand">Required</span>
                  )}
                  {multi && (
                    <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-muted">
                      Pick up to {group.max_select}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((option) => {
                    const selected = isOptionSelected(group.group_name, option.name);
                    return (
                      <button
                        key={option.name}
                        onClick={() => toggleOption(group.group_name, option, multi, group.max_select)}
                        className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                          selected
                            ? "border-brand bg-brand/10 font-medium text-brand"
                            : "border-border hover:border-brand/50"
                        }`}
                      >
                        {multi && (
                          <span className={`mr-1.5 inline-block h-3 w-3 rounded border text-center text-[8px] leading-3 ${
                            selected ? "border-brand bg-brand text-white" : "border-text-dim"
                          }`}>
                            {selected ? "✓" : ""}
                          </span>
                        )}
                        {option.name}
                        {option.price > 0 && (
                          <span className="ml-1 text-xs text-text-muted">+{displayRM(option.price)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4">
          <button
            onClick={handleConfirm}
            disabled={!allRequiredMet}
            className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add to Order &middot; {displayRM(totalPrice)}
          </button>
        </div>
      </div>
    </div>
  );
}
