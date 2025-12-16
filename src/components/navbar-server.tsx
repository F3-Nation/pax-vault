import { getCachedRegionList } from "@/lib/region";
import NavbarClient from "@/components/navbar-client";
import { getCachedPaxList } from "@/lib/pax";

export default async function NavbarComponent() {
  const regionData = await getCachedRegionList();
  const paxData = await getCachedPaxList();
  return <NavbarClient regionData={regionData} paxData={paxData} />;
}
