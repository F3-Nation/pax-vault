import { IdProps } from "@/types/props";
import { loadAOStats } from "./loader";
import { PageHeader } from "@/components/pageHeader";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { EmailIcon, InstagramIcon, TwitterIcon, WebsiteIcon, FacebookIcon } from "@/components/icons";

export default async function AODetailPage({ params }: IdProps) {
  const { id } = await params;
  const { AOInfo } = await loadAOStats(Number(id));

  if (!AOInfo) {
    return <div className="p-8 text-center text-red-600">AO not found</div>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start pt-10 pb-10">
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pb-6 px-4">
        {/* Page Header */}
        <PageHeader
          image={AOInfo.logo ? AOInfo.logo : "https://placehold.in/300x200.png"}
          name={AOInfo.name}
          link={`/stats/region/${AOInfo.region_id}`}
          linkName={AOInfo.region_name}
        />
        {/* Location View */}
        <Card className="bg-background/60 dark:bg-default-100/50 w-full">
          <CardHeader className="text-center font-semibold text-xl px-6">
            Location Details
          </CardHeader>
          <Divider />
          <CardBody className="px-6">
            <div className="w-full flex flex-col lg:flex-row justify-between items-start">
              <div className="w-1/2 pr-4">
                <strong className="text-primary">Event Address:</strong>
                <div className="text-sm mt-2">
                  {typeof AOInfo.meta?.address1 === "string" && AOInfo.meta.address1 ? (
                    <div>{AOInfo.meta.address1}</div>
                  ) : null}
                  {typeof AOInfo.meta?.address2 === "string" && AOInfo.meta.address2 ? (
                    <div className="">{AOInfo.meta.address2}</div>
                  ) : null}
                  <div className="">
                    {String(AOInfo.meta?.city)}, {String(AOInfo.meta?.state)}{" "}
                    {String(AOInfo.meta?.postalCode)}
                  </div>
                </div>
                {(AOInfo.email || AOInfo.website || AOInfo.twitter || AOInfo.instagram || AOInfo.facebook) && (
                  <div className="mt-2">
                    <strong className="text-primary">Social Links:</strong>
                    <div className="text-sm flex mt-2 space-x-2">
                      {AOInfo.email && (
                        <div>
                          <a href={`mailto:${AOInfo.email}`} target="_blank" rel="noopener noreferrer">
                            <EmailIcon className="h-7 w-7" />
                          </a>
                        </div>
                      )}
                      {AOInfo.website && (
                        <div>
                          <a href={AOInfo.website} target="_blank" rel="noopener noreferrer">
                            <WebsiteIcon className="h-7 w-7" />
                          </a>
                        </div>
                      )}
                      {AOInfo.twitter && (
                        <div>
                          <a href={AOInfo.twitter} target="_blank" rel="noopener noreferrer">
                            <TwitterIcon className="h-7 w-7" />
                          </a>
                        </div>
                      )}
                      {AOInfo.instagram && (
                        <div>
                          <a href={AOInfo.instagram} target="_blank" rel="noopener noreferrer">
                            <InstagramIcon className="h-7 w-7" />
                          </a>
                        </div>
                      )}
                      {AOInfo.facebook && (
                        <div>
                          <a href={AOInfo.facebook} target="_blank" rel="noopener noreferrer">
                            <FacebookIcon className="h-7 w-7" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="w-1/2 text-right">
                {AOInfo.eventSchedule && AOInfo.eventSchedule.length > 0 && (
                  <div>
                    <strong className="text-primary">Event Schedule:</strong>
                    <div className="text-sm mt-2">
                      <ul className="list-disc pl-5 inline-block">
                        {AOInfo.eventSchedule.map((event) => (
                          <div key={event.id} className="mb-3">
                            <span className="font-semibold">{event.day_of_week}</span> : <span className="italic">{event.event_type}</span>
                            <div className="mt-1">{event.start_time} to {event.end_time}</div>
                          </div>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
