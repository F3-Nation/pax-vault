"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Navbar, NavbarBrand, NavbarContent, NavbarItem } from "@heroui/navbar";
import { Link } from "@heroui/link";
import { Button } from "@heroui/button";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/modal";
import { useDisclosure } from "@heroui/use-disclosure";
import { useAuth } from "@/lib/auth/AuthProvider";
import { MoonIcon, SunIcon } from "@/components/icons";
import SearchModal from "@/components/search-modal";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

// --- Inline SVG icon components for Sign in / Sign out ---
function SignInIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M10 17L15 12L10 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 12H3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 4V20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SignOutIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M14 7L19 12L14 17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 12H7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 4V20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M4 6H20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4 12H20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4 18H20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BugIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M9 9L6.5 7.5M15 9L17.5 7.5M4 14H7M17 14H20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 7C9.2 7 7 9.2 7 12V14C7 16.8 9.2 19 12 19C14.8 19 17 16.8 17 14V12C17 9.2 14.8 7 12 7Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 5V7M9 5H15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DownloadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M12 3V14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8 10L12 14L16 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 20H19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function NavbarClient() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const isAuthed = !!user;
  const {
    isOpen: isSearchOpen,
    onOpen: onSearchOpen,
    onOpenChange: onSearchOpenChange,
  } = useDisclosure();
  const {
    isOpen: isInstallOpen,
    onOpen: onInstallOpen,
    onOpenChange: onInstallOpenChange,
  } = useDisclosure();
  const [pwaPrompt, setPwaPrompt] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [themeMounted, setThemeMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  const handleSignIn = useCallback(() => {
    router.push("/#signin");
  }, [router]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push("/");
  }, [router, signOut]);

  const handlePwaInstall = useCallback(async () => {
    if (isIOS) {
      onInstallOpen();
      return;
    }

    if (!pwaPrompt) return;

    await pwaPrompt.prompt();
    await pwaPrompt.userChoice;
    setPwaPrompt(null);
  }, [isIOS, onInstallOpen, pwaPrompt]);

  const handleReportBug = useCallback(() => {
    window.open(
      "https://github.com/F3-Nation/pax-vault/issues",
      "_blank",
      "noopener,noreferrer",
    );
  }, []);

  // PWA install detection + Cmd/Ctrl+K shortcut to open search.
  useEffect(() => {
    setThemeMounted(true);
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const ua = window.navigator.userAgent ?? "";
    const iOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (window.navigator.platform === "MacIntel" &&
        window.navigator.maxTouchPoints > 1);
    setIsIOS(iOS);
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      nav.standalone === true;
    setPwaInstalled(Boolean(isStandalone));

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPwaPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setPwaInstalled(true);
      setPwaPrompt(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onSearchOpen();
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onSearchOpen]);

  const showInstallAction = (Boolean(pwaPrompt) || isIOS) && !pwaInstalled;
  const isDark = themeMounted && resolvedTheme === "dark";

  const handleToggleTheme = useCallback(() => {
    if (!themeMounted) return;
    setTheme(isDark ? "light" : "dark");
  }, [isDark, setTheme, themeMounted]);

  const renderActionMenu = (size: "sm" | "md" | "lg") => (
    <Dropdown>
      <DropdownTrigger>
        <Button
          size={size}
          variant="light"
          color="default"
          startContent={<MenuIcon className="h-4 w-4" />}
        >
          Menu
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Feature menu">
        {themeMounted ? (
          <DropdownItem key="theme" onPress={handleToggleTheme}>
            <div className="flex items-center gap-2">
              {isDark ? (
                <SunIcon className="h-4 w-4" />
              ) : (
                <MoonIcon className="h-4 w-4" />
              )}
              <span>{isDark ? "Light Theme" : "Dark Theme"}</span>
            </div>
          </DropdownItem>
        ) : null}
        {showInstallAction ? (
          <DropdownItem key="install" onPress={handlePwaInstall}>
            <div className="flex items-center gap-2">
              <DownloadIcon className="h-4 w-4" />
              <span>Install App</span>
            </div>
          </DropdownItem>
        ) : null}
        {!authLoading ? (
          <DropdownItem
            key={isAuthed ? "sign-out" : "sign-in"}
            onPress={isAuthed ? handleSignOut : handleSignIn}
          >
            <div className="flex items-center gap-2">
              {isAuthed ? (
                <SignOutIcon className="h-4 w-4" />
              ) : (
                <SignInIcon className="h-4 w-4" />
              )}
              <span>{isAuthed ? "Sign out" : "Sign in"}</span>
            </div>
          </DropdownItem>
        ) : null}
        <DropdownItem key="report-bug" onPress={handleReportBug}>
          <div className="flex items-center gap-2">
            <BugIcon className="h-4 w-4" />
            <span>Report Bug</span>
          </div>
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );

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
            {/* <span className="px-2 py-[2px] text-[10px] rounded-md bg-warning-200 text-warning-800 dark:bg-warning-300/20 dark:text-warning-300 font-semibold tracking-wide">
              ALPHA
            </span> */}
          </Link>
        </NavbarBrand>
      </NavbarContent>

      {/* Desktop — single search button */}
      <NavbarContent className="hidden lg:flex" justify="end">
        {isAuthed && (
          <NavbarItem>
            <Button
              variant="bordered"
              color="primary"
              size="sm"
              onPress={onSearchOpen}
            >
              SEARCH
            </Button>
          </NavbarItem>
        )}
        <NavbarItem>{renderActionMenu("lg")}</NavbarItem>
      </NavbarContent>

      {/* Mobile — single search button */}
      <NavbarContent className="flex lg:hidden" justify="end">
        {isAuthed && (
          <NavbarItem>
            <Button
              variant="bordered"
              color="primary"
              size="sm"
              onPress={onSearchOpen}
            >
              SEARCH
            </Button>
          </NavbarItem>
        )}
        <NavbarItem>{renderActionMenu("sm")}</NavbarItem>
      </NavbarContent>

      {/* Unified search modal */}
      {isAuthed && (
        <SearchModal isOpen={isSearchOpen} onOpenChange={onSearchOpenChange} />
      )}

      {/* PWA install modal (iOS instructions) */}
      <Modal
        isOpen={isInstallOpen}
        onOpenChange={onInstallOpenChange}
        backdrop="blur"
        size="sm"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            Install PAX VAULT
          </ModalHeader>
          <ModalBody className="text-sm text-default-600">
            <div>To install on iOS Safari:</div>
            <ol className="list-decimal pl-5">
              <li>Tap the Share button in the toolbar.</li>
              <li>Select &quot;Add to Home Screen&quot;.</li>
              <li>Tap &quot;Add&quot; to confirm.</li>
            </ol>
            <Button size="sm" variant="flat" onPress={onInstallOpenChange}>
              Got it
            </Button>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Navbar>
  );
}
