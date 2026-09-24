"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { DEFAULT_PHONE_COUNTRY, PHONE_COUNTRIES, type PhoneCountry } from "@/lib/phone-countries";

type CountryCodePickerProps = {
  value: PhoneCountry;
  onChange: (country: PhoneCountry) => void;
  disabled?: boolean;
};

export function CountryCodePicker({ value, onChange, disabled }: CountryCodePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return PHONE_COUNTRIES;
    return PHONE_COUNTRIES.filter((country) => {
      return (
        country.name.toLowerCase().includes(needle) ||
        country.iso.toLowerCase().includes(needle) ||
        country.dialCode.includes(needle) ||
        `+${country.dialCode}`.includes(needle)
      );
    });
  }, [query]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => searchRef.current?.focus(), 0);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm transition hover:bg-white disabled:opacity-60"
      >
        <span className="text-base leading-none" aria-hidden>
          {value.flag}
        </span>
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-semibold text-white">
          {value.iso}
        </span>
        <span className="text-sm font-medium text-slate-800">+{value.dialCode}</span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search country or code"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              style={{ fontSize: 16 }}
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-slate-500">No countries match.</li>
            ) : (
              filtered.map((country) => {
                const selected = country.iso === value.iso && country.dialCode === value.dialCode;
                return (
                  <li key={`${country.iso}-${country.dialCode}-${country.name}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onChange(country);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition ${
                        selected ? "bg-emerald-50 text-emerald-900" : "text-slate-800 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-base leading-none" aria-hidden>
                        {country.flag}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{country.name}</span>
                      <span className="shrink-0 text-slate-500">+{country.dialCode}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
            Default: {DEFAULT_PHONE_COUNTRY.name} (+{DEFAULT_PHONE_COUNTRY.dialCode})
          </div>
        </div>
      ) : null}
    </div>
  );
}
