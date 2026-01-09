import { getCachedRegionList } from "@/lib/cache/region";
import { getCachedPaxList } from "@/lib/cache/pax";
import NavbarClient from "@/components/navbar-client";

export default async function NavbarComponent() {
  const regionData = await getCachedRegionList();
  const paxData = await getCachedPaxList();
  return <NavbarClient regionData={regionData} paxData={paxData} />;
}
