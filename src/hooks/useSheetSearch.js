// src/hooks/useSheetSearch.js
import { useCallback, useMemo, useState } from "react";

/**
 * useSheetSearch
 * - Accepts Google Sheets "rows" (2D array with a header row)
 * - Builds objects using the header row as keys
 * - Drops empty rows (where all values are blank/whitespace)
 * - Provides a case-insensitive substring search across ALL fields
 *
 * Returns:
 *   { query, setQuery, all, filtered, normalizedQuery }
 */
export default function useSheetSearch(rows) {
  // rows -> objects
  const items = useMemo(() => {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const [header, ...data] = rows;
    if (!Array.isArray(header)) return [];
    return data.map((r) =>
      Object.fromEntries(header.map((h, i) => [h, r?.[i] ?? ""]))
    );
  }, [rows]);

  // drop empty rows
  const isNonEmptyRow = useCallback(
    (obj) => obj && Object.values(obj).some((v) => String(v ?? "").trim() !== ""),
    []
  );
  const all = useMemo(() => items.filter(isNonEmptyRow), [items, isNonEmptyRow]);

  // search state
  const [query, setQuery] = useState("");
  const normalizedQuery = useMemo(() => String(query || "").trim().toLowerCase(), [query]);

  // match if the search appears anywhere in ANY field (case-insensitive)
  const matchesQuery = useCallback(
    (obj) => {
      if (!normalizedQuery) return true; // empty shows everything
      return Object.values(obj).some((v) =>
        String(v ?? "").toLowerCase().includes(normalizedQuery)
      );
    },
    [normalizedQuery]
  );

  const filtered = useMemo(() => all.filter(matchesQuery), [all, matchesQuery]);

  return { query, setQuery, all, filtered, normalizedQuery };
}