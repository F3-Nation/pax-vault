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

type SearchPayload = {
  regions: RegionInfo[];
  aos: AOInfo[];
  pax: PAXInfo[];
};

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

async function fetchSearchResults(url: string): Promise<SearchPayload> {
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
  return res.json() as Promise<SearchPayload>;
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
  const [includeInactive, setIncludeInactive] = useState(false);
  const [paxResults, setPaxResults] = useState<PAXInfo[]>([]);
  const [regionResults, setRegionResults] = useState<RegionInfo[]>([]);
  const [aoResults, setAoResults] = useState<AOInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
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
      setIncludeInactive(false);
      setPaxResults([]);
      setRegionResults([]);
      setAoResults([]);
      setSearchError(null);
      setFocusedIndex(-1);
    }
  }, [isOpen]);

  // Debounced unified search — single API call.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setPaxResults([]);
      setRegionResults([]);
      setAoResults([]);
      setLoading(false);
      setSearchError(null);
      setFocusedIndex(-1);
      return;
    }

    setLoading(true);
    setSearchError(null);
    setFocusedIndex(-1);

    let cancelled = false;
    const encoded = encodeURIComponent(q);
    const inactiveParam = includeInactive ? "&includeInactive=true" : "";

    const t = setTimeout(() => {
      fetchSearchResults(`/api/search?q=${encoded}${inactiveParam}`)
        .then((data) => {
          if (!cancelled) {
            setRegionResults(data.regions);
            setAoResults(data.aos);
            setPaxResults(data.pax);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled)
            setSearchError(
              err instanceof Error ? err.message : "Search failed",
            );
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, includeInactive]);

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
                placeholder="Search for PAX, Regions, AOs..."
                variant="bordered"
                size="lg"
                isClearable
                onClear={() => setQuery("")}
                startContent={
                  loading ? (
                    <Spinner size="sm" color="primary" />
                  ) : (
                    <SearchIcon className="h-4 w-4 text-default-400" />
                  )
                }
              />
            </div>

            {/* Include inactive checkbox */}
            <div className="flex items-center gap-2 px-4 pb-2">
              <input
                id="include-inactive"
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer accent-primary"
              />
              <label
                htmlFor="include-inactive"
                className="text-xs text-default-400 cursor-pointer select-none"
              >
                Include inactive search results
              </label>
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

              {hasQuery && !loading && !hasResults && !searchError && (
                <div className="px-4 py-8 text-center text-sm text-default-400">
                  No results found
                </div>
              )}

              {hasQuery && searchError && (
                <div className="px-4 py-4 text-center text-sm text-danger-500">
                  {searchError}
                </div>
              )}

              {/* Regions section */}
              <ResultSection
                id={SECTION_IDS.regions}
                title="REGIONS"
                loading={loading}
                empty={hasQuery && !loading && regionResults.length === 0}
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
                        className={`flex-shrink-0 ${!region.is_active ? "opacity-50" : ""}`}
                      />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-sm font-medium truncate ${!region.is_active ? "text-default-400" : ""}`}>
                            {region.region_name}
                          </span>
                          {!region.is_active && (
                            <span className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-default-100 text-default-400 uppercase tracking-wide">
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                    </ResultItem>
                  );
                })}
              </ResultSection>

              {/* AOs section */}
              <ResultSection
                id={SECTION_IDS.aos}
                title="AOs"
                loading={loading}
                empty={hasQuery && !loading && aoResults.length === 0}
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
                        className={`flex-shrink-0 ${!ao.is_active ? "opacity-50" : ""}`}
                      />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-sm font-medium truncate ${!ao.is_active ? "text-default-400" : ""}`}>
                            {ao.ao_name}
                          </span>
                          {!ao.is_active && (
                            <span className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-default-100 text-default-400 uppercase tracking-wide">
                              Inactive
                            </span>
                          )}
                        </div>
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
                loading={loading}
                empty={hasQuery && !loading && paxResults.length === 0}
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
  empty,
  showDivider = false,
  children,
}: {
  id: string;
  title: string;
  loading: boolean;
  empty: boolean;
  showDivider?: boolean;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : !!children;

  if (!loading && empty) return null;
  if (!loading && !hasChildren) return null;

  return (
    <div
      id={id}
      className={showDivider ? "border-t border-divider mt-1 pt-1" : "mt-2"}
    >
      <div className="px-4 py-1 text-xs font-semibold tracking-widest text-default-400 uppercase">
        {title}
      </div>
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
