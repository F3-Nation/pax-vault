"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { PaxSummary } from "@/types/pax";
import { formatNumber } from "@/lib/utils";
import { Link } from "@heroui/link";

export function SummaryCard({ summary }: { summary: PaxSummary }) {
  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6 lg:min-h-16">
        <div className="font-semibold text-xl">PAX Summary</div>
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
            <span className="text-primary">Total Events:</span>
            <span>
              {summary?.event_count === 0 ? (
                <span className="text-default-500 italic">No Event Data</span>
              ) : (
                <>{formatNumber(summary.event_count)} Events</>
              )}
            </span>
          </div>
          <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
            <span className="text-primary">Total Qs:</span>
            <span>
              {summary?.event_count === 0 ? (
                <span className="text-default-500 italic">No Event Data</span>
              ) : (
                <>{formatNumber(summary.q_count)} Qs</>
              )}
            </span>
          </div>
          <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
            <span className="text-primary">First Event:</span>
            <span>
              {summary?.event_count === 0 ? (
                <span className="text-default-500 italic">No Event Data</span>
              ) : (
                <>
                  {summary?.first_event_date}
                  {" at "}
                  <Link
                    className="text-sm"
                    color="secondary"
                    href={`/stats/ao/${summary?.first_event_ao_id}`}
                  >
                    {summary?.first_event_ao_name
                      ? summary?.first_event_ao_name
                      : "Unknown AO"}
                  </Link>
                </>
              )}
            </span>
          </div>
          <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
            <span className="text-primary">Last Seen:</span>
            <span>
              {summary?.event_count === 0 ? (
                <span className="text-default-500 italic">No Event Data</span>
              ) : (
                <>
                  {summary?.last_event_date}
                  {" at "}
                  <Link
                    className="text-sm"
                    color="secondary"
                    href={`/stats/ao/${summary?.last_event_ao_id}`}
                  >
                    {summary?.last_event_ao_name
                      ? summary?.last_event_ao_name
                      : "Unknown AO"}
                  </Link>
                </>
              )}
            </span>
          </div>
          <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
            <span className="text-primary">Bestie:</span>
            <span>
              {summary?.event_count === 0 ? (
                <span className="text-default-500 italic">No Event Data</span>
              ) : (
                <>
                  {summary?.bestie_count}
                  {" BDs with "}
                  <Link
                    className="text-sm"
                    color="secondary"
                    href={`/stats/pax/${summary?.bestie_user_id}`}
                  >
                    {summary?.bestie_f3_name}
                  </Link>
                </>
              )}
            </span>
          </div>
          <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
            <span className="text-primary">Unique PAX Met:</span>
            <span>
              {summary?.event_count === 0 ? (
                <span className="text-default-500 italic">No Event Data</span>
              ) : (
                <>{formatNumber(summary.unique_users_met)} PAX</>
              )}
            </span>
          </div>
          <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
            <span className="text-primary">First Q:</span>
            <span>
              {summary?.q_count === 0 ? (
                <span className="text-default-500 italic">No Event Data</span>
              ) : (
                <>
                  {summary?.first_q_date}
                  {" at "}
                  <Link
                    className="text-sm"
                    color="secondary"
                    href={`/stats/ao/${summary?.first_q_ao_id}`}
                  >
                    {summary?.first_q_ao_name
                      ? summary?.first_q_ao_name
                      : "Unknown AO"}
                  </Link>
                </>
              )}
            </span>
          </div>
          <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
            <span className="text-primary">Most Recent Q:</span>
            <span>
              {summary?.q_count === 0 ? (
                <span className="text-default-500 italic">No Event Data</span>
              ) : (
                <>
                  {summary?.last_q_date}
                  {" at "}
                  <Link
                    className="text-sm"
                    color="secondary"
                    href={`/stats/ao/${summary?.last_q_ao_id}`}
                  >
                    {summary?.last_q_ao_name
                      ? summary?.last_q_ao_name
                      : "Unknown AO"}
                  </Link>
                </>
              )}
            </span>
          </div>
          <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
            <span className="text-primary">Unique PAX Led:</span>
            <span>
              {summary?.event_count === 0 ? (
                <span className="text-default-500 italic">No Event Data</span>
              ) : (
                <>{formatNumber(summary.unique_pax_when_q)} PAX</>
              )}
            </span>
          </div>
          <div className="flex justify-between py-1 pb-2">
            <span className="text-primary">Efficiency:</span>
            <span>
              {summary?.event_count === 0 ? (
                <span className="text-default-500 italic">No Event Data</span>
              ) : (
                <>{formatNumber(summary.effective_percentage, 2)}%</>
              )}
            </span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
