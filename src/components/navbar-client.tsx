'use client';

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Navbar, NavbarBrand, NavbarContent, NavbarItem } from "@heroui/navbar";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Avatar } from "@heroui/avatar";

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
  }[];
};

export default function NavbarClient({ regionData, paxData }: Props) {
  const router = useRouter();
  const [selectedPax, setSelectedPax] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  return (
    <Navbar>
      <NavbarBrand>
        <Link href="/" className="flex items-center gap-2 font-bold text-inherit">PAX STATS</Link>
      </NavbarBrand>
      <NavbarContent className="hidden sm:flex gap-4" justify="center">
        <NavbarItem>
          <Autocomplete
            aria-label="SEARCH FOR A REGION"
            className="max-w-xs"
            defaultItems={regionData}
            isVirtualized
            itemHeight={40}
            label="F3 REGION"
            onSelectionChange={(key) => {
              if (key) {
                router.push(`/stats/region/${key}`);
                setSelectedRegion(null);
              }
            }}
            placeholder="SEARCH FOR A REGION"
            selectedKey={selectedRegion}
            size="sm"
            style={{ minWidth: '200px' }}
            variant="underlined"
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
        <NavbarItem>
          <Autocomplete
            aria-label="SEARCH FOR A PAX"
            className="max-w-xs"
            defaultItems={paxData}
            isVirtualized
            itemHeight={40}
            label="F3 PAX"
            onSelectionChange={(key) => {
              if (key) {
                router.push(`/stats/pax/${key}`);
                setSelectedPax(null);
              }
            }}
            placeholder="SEARCH FOR A PAX"
            selectedKey={selectedPax}
            size="sm"
            style={{ minWidth: '200px' }}
            variant="underlined"
          >
          {(pax) => (
            <AutocompleteItem key={pax.id} textValue={pax.f3_name}>
              <div className="flex gap-2 items-center">
                <Avatar alt={pax.f3_name} className="flex-shrink-0" size="sm" src={pax.avatar} />
                <div className="flex flex-col">
                  <span className="text-small">{pax.f3_name}</span>
                  <span className="text-tiny text-default-400">{pax.region}</span>
                </div>
              </div>
            </AutocompleteItem>
          )}
          </Autocomplete>
        </NavbarItem>

        
        <NavbarItem>
          <Link color="foreground" href="#">
            Integrations
          </Link>
        </NavbarItem>
      </NavbarContent>
      <NavbarContent justify="end">
        <NavbarItem className="hidden lg:flex">
          <Link href="#">Login</Link>
        </NavbarItem>
        <NavbarItem>
          <Button as={Link} color="primary" href="#" variant="flat">
            Sign Up
          </Button>
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
}