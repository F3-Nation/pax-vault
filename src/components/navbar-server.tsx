import { getCachedRegionList } from "@/lib/region";
import NavbarClient from "@/components/navbar-client";
import { getCachedPaxList } from "@/lib/pax";

export default async function NavbarComponent() {
  const regionData = await getCachedRegionList();
  const paxData = await getCachedPaxList();
  const regionRows = regionData.map(({ id, name, logo, ...rest }) => ({
    id: String(id),
    name,
    logo: logo ?? null, // Ensure logo is string or null
    ...rest,
  }));
  const paxRows = paxData.map(({ id, f3_name, avatar, ...rest }) => ({
    id: String(id),
    avatar,
    f3_name,
    ...rest,
  }));

  return <NavbarClient regionData={regionRows} paxData={paxRows} />;
}