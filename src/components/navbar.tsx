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

// F3 brand glyph (circle + stylized "F3"). Uses currentColor so it adapts to
// the navbar's light/dark text color. Paths match fallbackF3Logo().
function F3Glyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 41.73 41.73"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <circle
        stroke="currentColor"
        fill="none"
        strokeWidth="2"
        cx="20.86"
        cy="20.86"
        r="19.86"
      />
      <path
        fill="currentColor"
        d="M16.8,10.69v18.12c0,.4.08.69.23.86.08.1.16.17.23.19.07.03.31.09.71.19.49.11.74.4.74.85,0,.27-.13.48-.4.65-.2.12-.52.19-.97.19h-7.8c-.37,0-.66-.07-.86-.21-.2-.14-.3-.34-.3-.59,0-.42.21-.7.62-.83.34-.11.54-.18.59-.21.06-.03.12-.08.18-.18.12-.16.19-.43.19-.79v-15.44c0-.36-.06-.62-.19-.79-.06-.09-.12-.15-.18-.18-.06-.03-.25-.09-.59-.21-.41-.13-.62-.41-.62-.83,0-.26.1-.46.3-.59s.49-.21.86-.21h7.26ZM18.08,21.92v-1.79c.61-.29,1.05-.6,1.33-.93.28-.33.49-.79.62-1.36.08-.39.19-.66.32-.81s.32-.22.57-.22c.33,0,.56.13.68.39.07.13.11.44.11.91v5.88c0,.48-.05.82-.16,1-.11.19-.31.28-.59.28-.24,0-.42-.07-.56-.22-.13-.14-.24-.38-.32-.72-.19-.71-.44-1.25-.76-1.63-.32-.38-.74-.63-1.25-.76ZM18.16,10.69h6.21v5.38c0,.35-.06.6-.19.76-.12.15-.32.23-.6.23-.21,0-.37-.05-.49-.16s-.22-.29-.3-.55c-.15-.5-.35-.97-.6-1.39-.25-.42-.52-.78-.83-1.08-.42-.41-.88-.73-1.39-.94s-1.11-.36-1.82-.45v-1.8Z"
      />
      <path
        fill="currentColor"
        d="M29.34,22.52v.99c-.7-.09-1.3-.24-1.79-.46-.57-.25-1.01-.59-1.32-1.01s-.47-.89-.47-1.4.17-.97.51-1.33c.34-.35.76-.53,1.26-.53.55,0,1.01.22,1.38.66.26.31.39.65.39,1.01,0,.26-.07.51-.2.75-.13.25-.31.45-.53.6-.2.14-.3.25-.3.33,0,.1.11.19.32.26s.46.11.75.11ZM29.34,10.36v.95c-.25.06-.42.12-.53.18-.07.04-.13.09-.17.15s-.07.12-.07.16c0,.1.07.2.2.3l.43.35c.21.17.31.47.31.9,0,.46-.17.85-.5,1.18-.33.33-.73.49-1.19.49s-.86-.17-1.17-.5c-.31-.34-.47-.75-.47-1.25,0-.43.11-.84.33-1.22.22-.39.54-.72.94-.99.47-.31,1.09-.55,1.89-.7ZM32.18,16.77c.55.16.96.31,1.23.44s.51.29.72.48c.28.26.5.58.66.98.16.4.25.81.25,1.24,0,.98-.33,1.78-1,2.42-.41.39-.91.69-1.5.89-.59.21-1.24.31-1.94.31h-.42v-1c.35-.1.61-.25.76-.44.09-.11.16-.23.2-.36.04-.13.06-.3.06-.51v-2.71c0-.26-.01-.46-.04-.58-.03-.12-.08-.24-.17-.35-.18-.23-.45-.36-.83-.38-.25-.01-.42-.04-.5-.09-.14-.09-.21-.22-.21-.4s.05-.3.15-.37.28-.12.55-.14c.71-.06,1.06-.42,1.06-1.07v-.37s0-2.13,0-2.13c0-.4-.08-.69-.23-.88-.15-.19-.42-.33-.79-.42v-1h.26c.6,0,1.19.08,1.75.25.56.17,1.04.41,1.43.71.39.3.69.65.89,1.05.2.41.31.84.31,1.31,0,.84-.27,1.54-.8,2.1-.23.25-.48.44-.74.59-.26.15-.63.29-1.1.44Z"
      />
    </svg>
  );
}

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
            <F3Glyph className="h-6 w-6 shrink-0" />
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
              color="default"
              size="md"
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
              color="default"
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
