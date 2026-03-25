"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalContent, ModalBody } from "@heroui/modal";
import { Input } from "@heroui/input";
import { Avatar } from "@heroui/avatar";
import { Spinner } from "@heroui/spinner";
import { PAXInfo, RegionInfo, AOInfo } from "@/lib/types";

type SearchModalProps = {
  isOpen: boolean;
  onOpenChange: () => void;
};

type SearchResult =
  | { kind: "pax"; item: PAXInfo }
  | { kind: "region"; item: RegionInfo }
  | { kind: "ao"; item: AOInfo };

function routeForResult(result: SearchResult): string {
  switch (result.kind) {
    case "pax":
      return `/stats/pax/${result.item.user_id}`;
    case "region":
      return `/stats/region/${result.item.region_id}`;
    case "ao":
      return `/stats/ao/${result.item.ao_id}`;
  }
}

async function fetchJson<T>(url: string): Promise<T[]> {
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error || `Request failed: ${res.status}`,
    );
  }
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Unexpected response format");
  return data as T[];
}

const SECTION_IDS = {
  regions: "search-section-regions",
  aos: "search-section-aos",
  pax: "search-section-pax",
} as const;

export default function SearchModal({
  isOpen,
  onOpenChange,
}: SearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [paxResults, setPaxResults] = useState<PAXInfo[]>([]);
  const [regionResults, setRegionResults] = useState<RegionInfo[]>([]);
  const [aoResults, setAoResults] = useState<AOInfo[]>([]);
  const [paxLoading, setPaxLoading] = useState(false);
  const [regionLoading, setRegionLoading] = useState(false);
  const [aoLoading, setAoLoading] = useState(false);
  const [paxError, setPaxError] = useState<string | null>(null);
  const [regionError, setRegionError] = useState<string | null>(null);
  const [aoError, setAoError] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Flatten all results into a single ordered list for keyboard nav.
  // Order: Regions → AOs → PAX
  const allResults = useMemo<SearchResult[]>(() => {
    const items: SearchResult[] = [];
    for (const r of regionResults) items.push({ kind: "region", item: r });
    for (const a of aoResults) items.push({ kind: "ao", item: a });
    for (const p of paxResults) items.push({ kind: "pax", item: p });
    return items;
  }, [regionResults, aoResults, paxResults]);

  const isLoading = paxLoading || regionLoading || aoLoading;
  const hasQuery = query.trim().length >= 2;
  const hasResults = allResults.length > 0;

  // Which jump-to links to show (only sections that have results).
  const jumpLinks = useMemo(() => {
    const links: { label: string; id: string }[] = [];
    if (regionResults.length > 0)
      links.push({ label: "Regions", id: SECTION_IDS.regions });
    if (aoResults.length > 0) links.push({ label: "AOs", id: SECTION_IDS.aos });
    if (paxResults.length > 0)
      links.push({ label: "PAX", id: SECTION_IDS.pax });
    return links;
  }, [regionResults.length, aoResults.length, paxResults.length]);

  const scrollToSection = useCallback((sectionId: string) => {
    const container = scrollContainerRef.current;
    const section = document.getElementById(sectionId);
    if (!container || !section) return;
    container.scrollTop = section.offsetTop - container.offsetTop;
  }, []);

  // Reset state when modal opens/closes.
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setPaxResults([]);
      setRegionResults([]);
      setAoResults([]);
      setPaxError(null);
      setRegionError(null);
      setAoError(null);
      setFocusedIndex(-1);
    }
  }, [isOpen]);

  // Debounced search — fires 3 parallel fetches.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setPaxResults([]);
      setRegionResults([]);
      setAoResults([]);
      setPaxLoading(false);
      setRegionLoading(false);
      setAoLoading(false);
      setPaxError(null);
      setRegionError(null);
      setAoError(null);
      setFocusedIndex(-1);
      return;
    }

    setPaxLoading(true);
    setRegionLoading(true);
    setAoLoading(true);
    setFocusedIndex(-1);

    let cancelled = false;
    const encoded = encodeURIComponent(q);

    const t = setTimeout(() => {
      fetchJson<PAXInfo>(`/api/pax/list?q=${encoded}`)
        .then((data) => {
          if (!cancelled) setPaxResults(data);
        })
        .catch((err) => {
          if (!cancelled)
            setPaxError(err instanceof Error ? err.message : "Search failed");
        })
        .finally(() => {
          if (!cancelled) setPaxLoading(false);
        });

      fetchJson<RegionInfo>(`/api/region/list?q=${encoded}`)
        .then((data) => {
          if (!cancelled) setRegionResults(data);
        })
        .catch((err) => {
          if (!cancelled)
            setRegionError(
              err instanceof Error ? err.message : "Search failed",
            );
        })
        .finally(() => {
          if (!cancelled) setRegionLoading(false);
        });

      fetchJson<AOInfo>(`/api/ao/list?q=${encoded}`)
        .then((data) => {
          if (!cancelled) setAoResults(data);
        })
        .catch((err) => {
          if (!cancelled)
            setAoError(err instanceof Error ? err.message : "Search failed");
        })
        .finally(() => {
          if (!cancelled) setAoLoading(false);
        });
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const navigate = useCallback(
    (result: SearchResult) => {
      router.push(routeForResult(result));
      onOpenChange();
    },
    [router, onOpenChange],
  );

  // Keyboard navigation.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, allResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, -1));
      } else if (e.key === "Enter" && focusedIndex >= 0) {
        e.preventDefault();
        const result = allResults[focusedIndex];
        if (result) navigate(result);
      }
    },
    [allResults, focusedIndex, navigate],
  );

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      placement="top"
      size="2xl"
      backdrop="blur"
      classNames={{
        base: "mt-16",
        body: "p-0",
      }}
      hideCloseButton
    >
      <ModalContent>
        <ModalBody>
          <div onKeyDown={handleKeyDown}>
            {/* Search input */}
            <div className="px-4 pt-4 pb-2">
              <Input
                ref={inputRef}
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder="Search for PAX, regions, AOs..."
                variant="bordered"
                size="lg"
                isClearable
                onClear={() => setQuery("")}
                startContent={
                  isLoading ? (
                    <Spinner size="sm" color="primary" />
                  ) : (
                    <SearchIcon className="h-4 w-4 text-default-400" />
                  )
                }
              />
            </div>

            {/* Jump-to-section bar — only when multiple sections have results */}
            {jumpLinks.length > 1 && (
              <div className="flex items-center gap-1 px-4 pb-2 text-xs text-default-400">
                <span className="mr-1">Jump to:</span>
                {jumpLinks.map((link, i) => (
                  <span key={link.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      className="text-primary hover:underline cursor-pointer"
                      onClick={() => scrollToSection(link.id)}
                    >
                      {link.label}
                    </button>
                    {i < jumpLinks.length - 1 && (
                      <span className="text-default-300">·</span>
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* Results */}
            <div
              ref={scrollContainerRef}
              className="max-h-[60vh] overflow-y-auto pb-4"
            >
              {!hasQuery && (
                <div className="px-4 py-8 text-center text-sm text-default-400">
                  Type at least 2 characters to search
                </div>
              )}

              {hasQuery && !isLoading && !hasResults && (
                <div className="px-4 py-8 text-center text-sm text-default-400">
                  No results found
                </div>
              )}

              {/* Regions section */}
              <ResultSection
                id={SECTION_IDS.regions}
                title="REGIONS"
                loading={regionLoading}
                error={regionError}
                empty={hasQuery && !regionLoading && regionResults.length === 0}
              >
                {regionResults.map((region) => {
                  const idx = allResults.findIndex(
                    (r) =>
                      r.kind === "region" &&
                      r.item.region_id === region.region_id,
                  );
                  return (
                    <ResultItem
                      key={region.region_id}
                      isFocused={focusedIndex === idx}
                      onMouseEnter={() => setFocusedIndex(idx)}
                      onClick={() => navigate({ kind: "region", item: region })}
                    >
                      <Avatar
                        alt={region.region_name}
                        size="sm"
                        src={region.logo_url ?? undefined}
                        className="flex-shrink-0"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">
                          {region.region_name}
                        </span>
                      </div>
                    </ResultItem>
                  );
                })}
              </ResultSection>

              {/* AOs section */}
              <ResultSection
                id={SECTION_IDS.aos}
                title="AOs"
                loading={aoLoading}
                error={aoError}
                empty={hasQuery && !aoLoading && aoResults.length === 0}
                showDivider
              >
                {aoResults.map((ao) => {
                  const idx = allResults.findIndex(
                    (r) => r.kind === "ao" && r.item.ao_id === ao.ao_id,
                  );
                  return (
                    <ResultItem
                      key={ao.ao_id}
                      isFocused={focusedIndex === idx}
                      onMouseEnter={() => setFocusedIndex(idx)}
                      onClick={() => navigate({ kind: "ao", item: ao })}
                    >
                      <Avatar
                        alt={ao.ao_name}
                        size="sm"
                        src={ao.logo_url ?? undefined}
                        className="flex-shrink-0"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">
                          {ao.ao_name}
                        </span>
                        <span className="text-xs text-default-400 truncate">
                          {ao.region_name}
                        </span>
                      </div>
                    </ResultItem>
                  );
                })}
              </ResultSection>

              {/* PAX section */}
              <ResultSection
                id={SECTION_IDS.pax}
                title="PAX"
                loading={paxLoading}
                error={paxError}
                empty={hasQuery && !paxLoading && paxResults.length === 0}
                showDivider
              >
                {paxResults.map((pax) => {
                  const idx = allResults.findIndex(
                    (r) => r.kind === "pax" && r.item.user_id === pax.user_id,
                  );
                  return (
                    <ResultItem
                      key={pax.user_id}
                      isFocused={focusedIndex === idx}
                      onMouseEnter={() => setFocusedIndex(idx)}
                      onClick={() => navigate({ kind: "pax", item: pax })}
                    >
                      <Avatar
                        alt={pax.f3_name}
                        size="sm"
                        src={pax.avatar_url ?? undefined}
                        className="flex-shrink-0"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">
                          {pax.f3_name || "Unknown PAX"}
                        </span>
                        <span className="text-xs text-default-400 truncate">
                          {pax.home_region_name || "Unknown Region"}
                        </span>
                      </div>
                    </ResultItem>
                  );
                })}
              </ResultSection>
            </div>

            {/* Footer: keyboard hints */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-divider text-xs text-default-400">
              <span>
                <kbd className="px-1 py-0.5 rounded bg-default-100 font-mono">
                  ↑↓
                </kbd>{" "}
                navigate
              </span>
              <span>
                <kbd className="px-1 py-0.5 rounded bg-default-100 font-mono">
                  ↵
                </kbd>{" "}
                select
              </span>
              <span>
                <kbd className="px-1 py-0.5 rounded bg-default-100 font-mono">
                  esc
                </kbd>{" "}
                close
              </span>
            </div>

            {/* Footer: duplicate PAX note */}
            <div className="px-4 py-2 border-t border-divider text-xs text-default-400">
              Seeing duplicate PAX results?{" "}
              <a
                href="https://docs.google.com/document/d/1e7tmuY3irKDt9oy1URQVcxPwxyet1ZY_bVZhGvhESEw/edit?tab=t.5anzgzo1iu9#heading=h.w93pdbdrmr21"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Consult the FAQ guide on how to merge accounts.
              </a>
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

// --- Sub-components ---

function ResultSection({
  id,
  title,
  loading,
  error,
  empty,
  showDivider = false,
  children,
}: {
  id: string;
  title: string;
  loading: boolean;
  error: string | null;
  empty: boolean;
  showDivider?: boolean;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : !!children;

  if (!loading && !error && empty) return null;
  if (!loading && !error && !hasChildren) return null;

  return (
    <div
      id={id}
      className={showDivider ? "border-t border-divider mt-1 pt-1" : "mt-2"}
    >
      <div className="px-4 py-1 text-xs font-semibold tracking-widest text-default-400 uppercase">
        {title}
      </div>
      {error && (
        <div className="px-4 py-2 text-xs text-danger-500">{error}</div>
      )}
      {loading && !hasChildren && (
        <div className="flex items-center gap-2 px-4 py-3 text-xs text-default-400">
          <Spinner size="sm" /> Searching...
        </div>
      )}
      {children}
    </div>
  );
}

function ResultItem({
  isFocused,
  onMouseEnter,
  onClick,
  children,
}: {
  isFocused: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors cursor-pointer ${
        isFocused
          ? "bg-primary-50 dark:bg-primary-900/20"
          : "hover:bg-default-100"
      }`}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path
        d="M16.5 16.5L21 21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
