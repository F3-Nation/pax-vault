import { getEventData } from "@/lib/event";
import { EventDetail } from "@/types/event";
import { IdProps } from "@/types/props";
import { formatDate } from "@/lib/utils";

export default async function AoDetailPage({ params }: IdProps) {
  const { id } = await params;

  let eventData: EventDetail | null = null;
  try {
    eventData = await getEventData(Number(id));
  } catch (err) {
    console.error("Error fetching cached ao data:", err);
  }

  if (!eventData) {
    return <div className="p-8 text-center text-red-600">Event not found</div>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 text-gray-800">
      <div className="p-8 rounded-xl bg-white shadow-xl text-center max-w-md">
        <h1 className="text-4xl font-bold mb-4">{eventData.name}</h1>
        <p>
          <strong>Start Date:</strong> {formatDate(eventData.start_date)}
        </p>
        <p>
          <strong>End Date:</strong> {formatDate(eventData.end_date)}
        </p>
        <p>
          <strong>AO:</strong> {eventData.ao_name}
        </p>
        <p>
          <strong>Backblast:</strong>
        </p>
        <p>{eventData.backblast}</p>
      </div>
    </main>
  );
}
