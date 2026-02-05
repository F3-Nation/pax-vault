"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navbar, NavbarBrand, NavbarContent, NavbarItem } from "@heroui/navbar";
import { Link } from "@heroui/link";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
} from "@heroui/drawer";
import { useDisclosure } from "@heroui/use-disclosure";
import { Divider } from "@heroui/divider";
import { ThemeSwitcher } from "@/lib/theme-switcher";
import { RegionInfo, PAXInfo } from "@/lib/types";
import { useAuth } from "@/lib/auth/AuthProvider";

/**
 * Small helper for debounced, client-side search against a JSON endpoint.
 *
 * Design goals:
 * - Avoid duplicated useEffect/fetch boilerplate for each search box.
 * - Provide consistent loading/error semantics.
 * - Protect against state updates after unmount.
 */
type DebouncedSearchArgs<T> = {
  input: string;
  minChars?: number;
  delayMs?: number;
  urlForQuery: (q: string) => string;
  setData: (data: T[]) => void;
  setApiLoading: (v: boolean) => void;
  setApiError: (v: string | null) => void;
  setTypingLoading: (v: boolean) => void;
  validate?: (data: unknown) => data is T[];
};

function useDebouncedApiSearch<T>({
  input,
  minChars = 2,
  delayMs = 1000,
  urlForQuery,
  setData,
  setApiLoading,
  setApiError,
  setTypingLoading,
  validate,
}: DebouncedSearchArgs<T>) {
  useEffect(() => {
    let isMounted = true;

    const q = input.trim();
    if (q.length < minChars) {
      setData([]);
      setApiLoading(false);
      setApiError(null);
      setTypingLoading(false);
      return;
    }

    // Show spinner while user is actively searching.
    setApiLoading(true);
    setApiError(null);

    const t = setTimeout(async () => {
      try {
        const res = await fetch(urlForQuery(q), {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        if (!res.ok) {
          throw new Error(`Request failed: ${res.status} ${res.statusText}`);
        }

        const data = (await res.json()) as unknown;
        const ok = validate ? validate(data) : Array.isArray(data);
        if (!ok) {
          throw new Error("Search endpoint did not return an array");
        }

        if (isMounted) setData(data as T[]);
        if (isMounted) setTypingLoading(false);
        if (isMounted) setApiLoading(false);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (isMounted) {
          setApiError(message);
          setTypingLoading(false);
          setApiLoading(false);
        }
      }
    }, delayMs);

    return () => {
      isMounted = false;
      clearTimeout(t);
    };
  }, [
    input,
    minChars,
    delayMs,
    urlForQuery,
    setData,
    setApiLoading,
    setApiError,
    setTypingLoading,
    validate,
  ]);
}

/**
 * Build a consistent selection handler for autocomplete navigation.
 *
 * Note: HeroUI passes the selected key, or the string "null" in some cases.
 */
function makeNavSelectionHandler(args: {
  routeForKey: (key: React.Key) => string;
  setKey: (k: React.Key | null) => void;
  clearInput: () => void;
  onAfterNavigate?: () => void;
  routerPush: (href: string) => void;
}) {
  const { routeForKey, setKey, clearInput, onAfterNavigate, routerPush } = args;

  return (key: React.Key | null) => {
    setKey(key);

    // HeroUI sometimes provides the literal string "null".
    if (!key || key === "null") return;

    routerPush(routeForKey(key));

    // Small delay ensures the Autocomplete closes cleanly before we reset state.
    setTimeout(() => {
      clearInput();
      setKey(null);
      onAfterNavigate?.();
    }, 100);
  };
}

export default function NavbarClient() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const isAuthed = !!user;
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  // --- Search state (shared pattern: input -> debounced API -> options -> selection navigates) ---

  // Pax search state
  const [paxData, setPaxData] = useState<PAXInfo[]>([]);
  const [paxApiLoading, setPaxApiLoading] = useState(false);
  const [paxApiError, setPaxApiError] = useState<string | null>(null);
  const [paxKey, setPaxKey] = useState<React.Key | null>(null);
  const [paxLoading, setPaxLoading] = useState(false);
  const [paxInput, setPaxInput] = useState<string>("");

  // Region search state
  const [regionData, setRegionData] = useState<RegionInfo[]>([]);
  const [regionApiLoading, setRegionApiLoading] = useState(false);
  const [regionApiError, setRegionApiError] = useState<string | null>(null);
  const [regionKey, setRegionKey] = useState<React.Key | null>(null);
  const [regionLoading, setRegionLoading] = useState(false);
  const [regionInput, setRegionInput] = useState<string>("");

  // Memoize helpers so the debounced search hook doesn't re-run on every render.
  // Inline arrow functions are new references each render and can cause an effect loop
  // because the hook sets state inside its effect.
  const regionUrlForQuery = useCallback(
    (q: string) => `/api/region/list/?q=${encodeURIComponent(q)}`,
    [],
  );

  const paxUrlForQuery = useCallback(
    (q: string) => `/api/pax/list/?q=${encodeURIComponent(q)}`,
    [],
  );

  const validateArray = useCallback(
    (data: unknown): data is unknown[] => Array.isArray(data),
    [],
  );
  const validateRegionData = useCallback(
    (data: unknown): data is RegionInfo[] => validateArray(data),
    [validateArray],
  );
  const validatePaxData = useCallback(
    (data: unknown): data is PAXInfo[] => validateArray(data),
    [validateArray],
  );

  // Debounced region search (calls /api/region/list?q=...)
  useDebouncedApiSearch<RegionInfo>({
    input: regionInput,
    urlForQuery: regionUrlForQuery,
    setData: setRegionData,
    setApiLoading: setRegionApiLoading,
    setApiError: setRegionApiError,
    setTypingLoading: setRegionLoading,
    validate: validateRegionData,
  });

  // Debounced pax search (calls /api/users?q=...)
  useDebouncedApiSearch<PAXInfo>({
    input: paxInput,
    urlForQuery: paxUrlForQuery,
    setData: setPaxData,
    setApiLoading: setPaxApiLoading,
    setApiError: setPaxApiError,
    setTypingLoading: setPaxLoading,
    validate: validatePaxData,
  });

  // Defensive filtering: Autocomplete expects items with displayable names.
  const paxOptions = useMemo(
    () => paxData.filter((p) => p && p.f3_name),
    [paxData],
  );

  // Defensive filtering: Autocomplete expects items with displayable names.
  const regionOptions = useMemo(
    () => regionData.filter((r) => r && r.region_name),
    [regionData],
  );

  // Handle pax input change with loading
  const handlePaxInputChange = (value: string) => {
    setPaxInput(value);
    // Typing spinner is a UI hint; the effect will clear it when results arrive.
    setPaxLoading(value.trim().length > 0);
  };

  // Handle region input change with loading
  const handleRegionInputChange = (value: string) => {
    setRegionInput(value);
    // Typing spinner is a UI hint; the effect will clear it when results arrive.
    setRegionLoading(value.trim().length > 0);
  };

  // Navigation handlers (desktop/mobile share behavior; mobile also closes the drawer).
  const handlePaxSelection = useMemo(
    () =>
      makeNavSelectionHandler({
        routeForKey: (key) => `/stats/pax/${key}`,
        setKey: setPaxKey,
        clearInput: () => setPaxInput(""),
        routerPush: router.push,
      }),
    [router.push],
  );

  const handlePaxSelectionMobile = useMemo(
    () =>
      makeNavSelectionHandler({
        routeForKey: (key) => `/stats/pax/${key}`,
        setKey: setPaxKey,
        clearInput: () => setPaxInput(""),
        onAfterNavigate: () => onOpenChange(),
        routerPush: router.push,
      }),
    [router.push, onOpenChange],
  );

  const handleRegionSelection = useMemo(
    () =>
      makeNavSelectionHandler({
        routeForKey: (key) => `/stats/region/${key}`,
        setKey: setRegionKey,
        clearInput: () => setRegionInput(""),
        routerPush: router.push,
      }),
    [router.push],
  );

  const handleRegionSelectionMobile = useMemo(
    () =>
      makeNavSelectionHandler({
        routeForKey: (key) => `/stats/region/${key}`,
        setKey: setRegionKey,
        clearInput: () => setRegionInput(""),
        onAfterNavigate: () => onOpenChange(),
        routerPush: router.push,
      }),
    [router.push, onOpenChange],
  );

  const handleSignIn = useCallback(() => {
    router.push("/#signin");
  }, [router]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push("/");
  }, [router, signOut]);

  return (
    <Navbar
      isBordered
      className="bg-background/70 backdrop-blur-md backdrop-saturate-150"
    >
      <NavbarContent>
        <NavbarBrand>
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-inherit"
          >
            PAX VAULT
            <span className="px-2 py-[2px] text-[10px] rounded-md bg-warning-200 text-warning-800 dark:bg-warning-300/20 dark:text-warning-300 font-semibold tracking-wide">
              ALPHA
            </span>
          </Link>
        </NavbarBrand>
      </NavbarContent>

      {/* Desktop Search Fields */}
      <NavbarContent className="hidden lg:flex" justify="end">
        {isAuthed && (
          <>
            <NavbarItem className="w-64">
              <Autocomplete
                className="w-full"
                label="SEARCH FOR A REGION"
                defaultItems={regionOptions}
                inputValue={regionInput}
                isLoading={regionLoading || regionApiLoading}
                itemHeight={40}
                selectedKey={regionKey !== null ? String(regionKey) : null}
                onInputChange={handleRegionInputChange}
                onSelectionChange={handleRegionSelection}
                variant="bordered"
                color="primary"
                size="sm"
                isClearable
              >
                {(region) => (
                  <AutocompleteItem
                    key={region.region_id}
                    textValue={region.region_name}
                  >
                    <div className="flex gap-2 items-center">
                      <Avatar
                        alt={region.region_name}
                        className="flex-shrink-0"
                        size="sm"
                        src={region.logo_url ?? undefined}
                      />
                      <div className="flex flex-col">
                        <span className="text-small">{region.region_name}</span>
                      </div>
                    </div>
                  </AutocompleteItem>
                )}
              </Autocomplete>
              {regionApiError && (
                <div className="mt-1 text-tiny text-danger-500">
                  {regionApiError}
                </div>
              )}
            </NavbarItem>

            <NavbarItem className="w-64">
              <Autocomplete
                className="w-full"
                label="SEARCH FOR A PAX"
                defaultItems={paxOptions}
                inputValue={paxInput}
                isLoading={paxLoading || paxApiLoading}
                itemHeight={40}
                selectedKey={paxKey !== null ? String(paxKey) : null}
                onInputChange={handlePaxInputChange}
                onSelectionChange={handlePaxSelection}
                variant="bordered"
                color="primary"
                size="sm"
                isClearable
              >
                {(pax) => (
                  <AutocompleteItem key={pax.user_id} textValue={pax.f3_name}>
                    <div className="flex gap-2 items-center">
                      <Avatar
                        alt={pax.f3_name}
                        className="flex-shrink-0"
                        size="sm"
                        src={pax.avatar_url ?? undefined}
                      />
                      <div className="flex flex-col">
                        <span className="text-small">
                          {pax.f3_name && pax.f3_name.length > 20
                            ? pax.f3_name.slice(0, 20) + "..."
                            : pax.f3_name || "Unknown PAX"}
                        </span>
                        <span className="text-tiny text-default-400">
                          {pax.home_region_name || "Unknown Region"}
                        </span>
                      </div>
                    </div>
                  </AutocompleteItem>
                )}
              </Autocomplete>
              {paxApiError && (
                <div className="mt-1 text-tiny text-danger-500">
                  {paxApiError}
                </div>
              )}
            </NavbarItem>
          </>
        )}
        <NavbarItem>
          <ThemeSwitcher size="sm" iconSize="sm" />
        </NavbarItem>
        {!authLoading && (
          <NavbarItem>
            {isAuthed ? (
              <Button
                size="sm"
                variant="flat"
                color="danger"
                onPress={handleSignOut}
              >
                Sign out
              </Button>
            ) : (
              <Button
                size="sm"
                variant="flat"
                color="primary"
                onPress={handleSignIn}
              >
                Sign in
              </Button>
            )}
          </NavbarItem>
        )}
      </NavbarContent>

      {/* Mobile Search Buttons */}
      <NavbarContent className="flex lg:hidden" justify="end">
        {isAuthed && (
          <NavbarItem>
            <Button
              key="search-region-pax"
              className="w-40"
              variant="bordered"
              color="primary"
              size="sm"
              onPress={() => onOpen()}
            >
              FIND REGION OR PAX
            </Button>
          </NavbarItem>
        )}
        <NavbarItem>
          <ThemeSwitcher size="sm" iconSize="sm" />
        </NavbarItem>
        {!authLoading && (
          <NavbarItem>
            {isAuthed ? (
              <Button
                size="sm"
                variant="flat"
                color="danger"
                onPress={handleSignOut}
              >
                Sign out
              </Button>
            ) : (
              <Button
                size="sm"
                variant="flat"
                color="primary"
                onPress={handleSignIn}
              >
                Sign in
              </Button>
            )}
          </NavbarItem>
        )}
      </NavbarContent>

      {isAuthed && (
        <Drawer
          isOpen={isOpen}
          key={isOpen ? "mobile_open" : "mobile_closed"}
          backdrop="blur"
          placement="top"
          classNames={{
            wrapper: "h-full",
          }}
          onOpenChange={onOpenChange}
          isDismissable={false}
          isKeyboardDismissDisabled={true}
        >
          <DrawerContent>
            <DrawerHeader className="flex flex-col gap-1">
              SEARCH FOR A REGION OR A PAX
            </DrawerHeader>
            <Divider />
            <DrawerBody className="flex flex-col gap-10 py-10">
              <Autocomplete
                className="w-full"
                label="SEARCH FOR A REGION"
                defaultItems={regionOptions}
                inputValue={regionInput}
                isLoading={regionLoading || regionApiLoading}
                itemHeight={40}
                selectedKey={String(regionKey) ?? null}
                onInputChange={handleRegionInputChange}
                onSelectionChange={handleRegionSelectionMobile}
                variant="bordered"
                size="lg"
                color="primary"
                isClearable
              >
                {(region) => (
                  <AutocompleteItem
                    key={region.region_id}
                    textValue={region.region_name}
                  >
                    <div className="flex gap-2 items-center">
                      <Avatar
                        alt={region.region_name}
                        className="flex-shrink-0"
                        size="sm"
                        src={region.logo_url ?? undefined}
                      />
                      <div className="flex flex-col">
                        <span className="text-small">{region.region_name}</span>
                      </div>
                    </div>
                  </AutocompleteItem>
                )}
              </Autocomplete>
              {regionApiError && (
                <div className="mt-1 text-tiny text-danger-500">
                  {regionApiError}
                </div>
              )}
              <Autocomplete
                className="w-full"
                label="SEARCH FOR A PAX"
                defaultItems={paxOptions}
                inputValue={paxInput}
                isLoading={paxLoading || paxApiLoading}
                itemHeight={40}
                selectedKey={String(paxKey) ?? null}
                onInputChange={handlePaxInputChange}
                onSelectionChange={handlePaxSelectionMobile}
                variant="bordered"
                size="lg"
                color="primary"
                isClearable
              >
                {(pax) => (
                  <AutocompleteItem key={pax.user_id} textValue={pax.f3_name}>
                    <div className="flex gap-2 items-center">
                      <Avatar
                        alt={pax.f3_name}
                        className="flex-shrink-0"
                        size="sm"
                        src={pax.avatar_url ?? undefined}
                      />
                      <div className="flex flex-col">
                        <span className="text-small">
                          {pax.f3_name && pax.f3_name.length > 20
                            ? pax.f3_name.slice(0, 20) + "..."
                            : pax.f3_name || "Unknown PAX"}
                        </span>
                        <span className="text-tiny text-default-400">
                          {pax.home_region_name || "Unknown Region"}
                        </span>
                      </div>
                    </div>
                  </AutocompleteItem>
                )}
              </Autocomplete>
              {paxApiError && (
                <div className="mt-1 text-tiny text-danger-500">
                  {paxApiError}
                </div>
              )}
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      )}
    </Navbar>
  );
}
