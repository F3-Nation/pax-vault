'use client';

import { useRouter } from "next/navigation";
import { useState } from "react";
// import { Navbar, NavbarBrand, NavbarContent, NavbarItem, NavbarMenu, NavbarMenuItem, NavbarMenuToggle } from "@heroui/navbar";
import { Navbar, NavbarBrand, NavbarContent, NavbarItem } from "@heroui/navbar";
import { Link } from "@heroui/link";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter } from "@heroui/drawer";
import { useDisclosure } from "@heroui/use-disclosure";
import { Divider } from "@heroui/divider";

type Props = {
  regionData: {
    id: string;
    logo: string | null;
    name: string;
  }[];
  paxData: {
    avatar: string | undefined;
    f3_name: string;
    id: string;
    region: string;
    region_default: string;
  }[];
};

export default function NavbarClient({ regionData, paxData }: Props) {
  const router = useRouter();
  const {isOpen, onOpen, onOpenChange} = useDisclosure();

  // Pax search state
  const [paxKey, setPaxKey] = useState<React.Key | null>(null);
  const [paxLoading, setPaxLoading] = useState(false);
  const [paxInput, setPaxInput] = useState<string>('');

  // Region search state
  const [regionKey, setRegionKey] = useState<React.Key | null>(null);
  const [regionLoading, setRegionLoading] = useState(false);
  const [regionInput, setRegionInput] = useState<string>('');

  // Navigation state
  // const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Handle pax input change with loading
  const handlePaxInputChange = (value: string) => {
    setPaxInput(value);
    if (value.length > 0) {
      setPaxLoading(true);
      setTimeout(() => {
        setPaxLoading(false);
      }, 300); // Simulate loading delay
    }
  };

  // Handle region input change with loading
  const handleRegionInputChange = (value: string) => {
    setRegionInput(value);
    if (value.length > 0) {
      setRegionLoading(true);
      setTimeout(() => {
        setRegionLoading(false);
      }, 300); // Simulate loading delay
    }
  };

  // Navigate to pax page
  const handlePaxSelection = (key: React.Key | null) => {
    setPaxKey(key);
    if (key !== "null") {
      router.push(`/stats/pax/${key}`);
      setTimeout(() => {
        setPaxInput(''); // Clear input after selection
        setPaxKey(null); // Reset key after selection
      }, 100); // Clear input after selection
    }
  };

  // Navigate to pax page on mobile
  // This function is used to handle the selection of a pax in the mobile drawer
  const handlePaxSelectionMobile = (key: React.Key | null) => {
    setPaxKey(key);
    if (key !== "null") {
      router.push(`/stats/pax/${key}`);
      setTimeout(() => {
        setPaxInput(''); // Clear input after selection
        setPaxKey(null); // Reset key after selection
        onOpenChange(); // Close drawer after selection
      }, 100); // Clear input after selection
    }
  };

  // Navigate to region page
  const handleRegionSelection = (key: React.Key | null) => {
    setRegionKey(key);
    if (key !== "null") {
      router.push(`/stats/region/${key}`);
      setTimeout(() => {
        setRegionInput(''); // Clear input after selection
        setRegionKey(null); // Reset key after selection
      }, 100); // Clear input after selection
    }
  };

  // Navigate to region page on mobile
  // This function is used to handle the selection of a region in the mobile drawer
  const handleRegionSelectionMobile = (key: React.Key | null) => {
    setRegionKey(key);
    if (key !== "null") {
      router.push(`/stats/region/${key}`);
      setTimeout(() => {
        setRegionInput(''); // Clear input after selection
        setRegionKey(null); // Reset key after selection
        onOpenChange(); // Close drawer after selection
      }, 100); // Clear input after selection
    }
  };

  return (
    <Navbar
      isBordered
      // isMenuOpen={isMenuOpen}
      // onMenuOpenChange={setIsMenuOpen}
      className="bg-background/70 backgdrop-blur-md backgrop-saturate-150"  
    >
      <NavbarContent>
        {/* <NavbarMenuToggle
          area-label={isMenuOpen ? "Close menu" : "Open menu"}
          className="lg:hidden"
        /> */}
        <NavbarBrand>
          <Link href="/" className="flex items-center gap-2 font-bold text-inherit">PAX STATS</Link>
        </NavbarBrand>
      </NavbarContent>

      {/* Desktop Search Fields */}
      <NavbarContent className="hidden lg:flex gap-10" justify="end">
        <NavbarItem className="w-64">
          <Autocomplete
            className="w-full"
            label="SEARCH FOR A REGION"
            defaultItems={regionData}
            inputValue={regionInput}
            isLoading={regionLoading}
            // placeholder="F3 REGION NAME"
            itemHeight={40}
            selectedKey={String(regionKey)}
            onInputChange={handleRegionInputChange}
            onSelectionChange={handleRegionSelection}
            variant="bordered"
            color="secondary"
            size="sm"
            isClearable
          >
          {(region) => (
            <AutocompleteItem key={region.id} textValue={region.name}>
              <div className="flex gap-2 items-center">
                <Avatar alt={region.name} className="flex-shrink-0" size="sm" src={region.logo ?? undefined} />
                <div className="flex flex-col">
                  <span className="text-small">{region.name}</span>
                </div>
              </div>
            </AutocompleteItem>
          )}
          </Autocomplete>
        </NavbarItem>

        <NavbarItem className="w-64">
          <Autocomplete
            className="w-full"
            label="SEARCH FOR A PAX"
            defaultItems={paxData}
            inputValue={paxInput}
            isLoading={paxLoading}
            // placeholder="F3 PAX NAME"
            itemHeight={40}
            selectedKey={String(paxKey)}
            onInputChange={handlePaxInputChange}
            onSelectionChange={handlePaxSelection}
            variant="bordered"
            color="secondary"
            size="sm"
            isClearable
          >
          {(pax) => (
            <AutocompleteItem key={pax.id} textValue={pax.f3_name}>
              <div className="flex gap-2 items-center">
                <Avatar alt={pax.f3_name} className="flex-shrink-0" size="sm" src={pax.avatar} />
                <div className="flex flex-col">
                  <span className="text-small">
                    {pax.f3_name && pax.f3_name.length > 20
                      ? pax.f3_name.slice(0, 20) + '...'
                      : pax.f3_name || 'Unknown PAX'}
                  </span>
                  <span className="text-tiny text-default-400">{pax.region || pax.region_default || "Unknown Region"}</span>
                </div>
              </div>
            </AutocompleteItem>
          )}
          </Autocomplete>
        </NavbarItem>
      </NavbarContent>

      {/* Mobile Search Buttons */}
      <NavbarContent className="flex lg:hidden" justify="end">
          <Button
            key="search-region-pax"
            className="w-40"
            variant="flat"
            color="secondary"
            size="sm"
            onPress={() => onOpen()}
            >
              FIND REGION/PAX
            </Button>
      </NavbarContent>

      <Drawer 
        isOpen={isOpen} 
        key={isOpen ? 'mobile_open' : 'mobile_closed'} 
        backdrop="blur" 
        placement="top" 
        classNames={{
          wrapper: 'h-full',
        }}
        onOpenChange={onOpenChange}
        isDismissable={false}
        
        isKeyboardDismissDisabled={true}
      >
        <DrawerContent>
          <DrawerHeader className="flex flex-col gap-1">SEARCH FOR A REGION OR A PAX</DrawerHeader>
          <Divider />
          <DrawerBody className="flex flex-col gap-10 py-10">
            <Autocomplete
              className="w-full"
              label="SEARCH FOR A REGION"
              defaultItems={regionData}
              inputValue={regionInput}
              isLoading={regionLoading}
              // placeholder="F3 REGION NAME"
              itemHeight={40}
              selectedKey={String(regionKey)}
              onInputChange={handleRegionInputChange}
              onSelectionChange={handleRegionSelectionMobile}
              variant="bordered"
              size="lg"
              color="secondary"
              isClearable
            >
            {(region) => (
              <AutocompleteItem key={region.id} textValue={region.name}>
                <div className="flex gap-2 items-center">
                  <Avatar alt={region.name} className="flex-shrink-0" size="sm" src={region.logo ?? undefined} />
                  <div className="flex flex-col">
                    <span className="text-small">{region.name}</span>
                  </div>
                </div>
              </AutocompleteItem>
            )}
            </Autocomplete>
            <Autocomplete
              className="w-full"
              label="SEARCH FOR A PAX"
              defaultItems={paxData}
              inputValue={paxInput}
              isLoading={paxLoading}
              // placeholder="F3 PAX NAME"
              itemHeight={40}
              selectedKey={String(paxKey)}
              onInputChange={handlePaxInputChange}
              onSelectionChange={handlePaxSelectionMobile}
              variant="bordered"
              size="lg"
              color="secondary"
              isClearable
            >
            {(pax) => (
              <AutocompleteItem key={pax.id} textValue={pax.f3_name}>
                <div className="flex gap-2 items-center">
                  <Avatar alt={pax.f3_name} className="flex-shrink-0" size="sm" src={pax.avatar} />
                  <div className="flex flex-col">
                    <span className="text-small">
                      {pax.f3_name && pax.f3_name.length > 20
                        ? pax.f3_name.slice(0, 20) + '...'
                        : pax.f3_name || 'Unknown PAX'}
                    </span>
                    <span className="text-tiny text-default-400">{pax.region || pax.region_default || "Unknown Region"}</span>
                  </div>
                </div>
              </AutocompleteItem>
            )}
            </Autocomplete>
          </DrawerBody>
          <DrawerFooter>
            {/* <Button color="danger" variant="light" onPress={onClose}>
              Close
            </Button>
            <Button color="primary" onPress={onClose}>
              Action
            </Button> */}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>



      {/* Mobile Menu */}
      {/* <NavbarMenu className="pt-6">
        <NavbarMenuItem className="mb-6">
          <Autocomplete
            className="w-full"
            label="SEARCH FOR A REGION"
            defaultItems={regionData}
            inputValue={regionInput}
            isLoading={regionLoading}
            placeholder="F3 REGION NAME"
            itemHeight={40}
            selectedKey={String(regionKey)}
            onInputChange={handleRegionInputChange}
            onSelectionChange={(key) => {
              handleRegionSelection(key);
              setIsMenuOpen(false);
            }}
            variant="underlined"
            isClearable
          >
          {(region) => (
            <AutocompleteItem key={region.id} textValue={region.name}>
              <div className="flex gap-2 items-center">
                <Avatar alt={region.name} className="flex-shrink-0" size="sm" src={region.logo ?? undefined} />
                <div className="flex flex-col">
                  <span className="text-small">{region.name}</span>
                </div>
              </div>
            </AutocompleteItem>
          )}
          </Autocomplete>
        </NavbarMenuItem>
        <NavbarMenuItem className="mb-6">
          <Autocomplete
            className="w-full"
            label="SEARCH FOR A PAX"
            defaultItems={paxData}
            inputValue={paxInput}
            isLoading={paxLoading}
            placeholder="F3 PAX NAME"
            itemHeight={40}
            selectedKey={String(paxKey)}
            onInputChange={handlePaxInputChange}
            onSelectionChange={(key) => {
              handlePaxSelection(key);
              setIsMenuOpen(false);
            }}
            variant="underlined"
            isClearable
          >
          {(pax) => (
            <AutocompleteItem key={pax.id} textValue={pax.f3_name} className="py-2">
              <div className="flex gap-2 items-center">
                <Avatar alt={pax.f3_name} className="flex-shrink-0" size="sm" src={pax.avatar} />
                <div className="flex flex-col">
                  <span className="text-small">
                    {pax.f3_name && pax.f3_name.length > 20
                      ? pax.f3_name.slice(0, 20) + '...'
                      : pax.f3_name || 'Unknown PAX'}
                  </span>
                  <span className="text-tiny text-default-400">{pax.region || pax.region_default || "Unknown Region"}</span>
                </div>
              </div>
            </AutocompleteItem>
          )}
          </Autocomplete>
        </NavbarMenuItem>
      </NavbarMenu> */}


    </Navbar>
  );
}