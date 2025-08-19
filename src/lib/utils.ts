export function getBaseUrl() {
  const isServer = typeof window === 'undefined';

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  if (isServer && process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }

  throw new Error('NEXT_PUBLIC_SITE_URL must be defined in production');
}

export function formatDate(
  date: string | Date,
  format?: "M D Y" | "M Y" // Example option, can be extended as needed
): string {
  const d = new Date(date);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday as start of week

  // If options?.types exists, you can use it as needed in your logic
  // For now, just demonstrating its presence

  if (d >= startOfWeek && !format) {
    // If date is this week, show day of week (e.g., Monday)
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  } else {
    // Else, show e.g., Tue, Jan 3 2003
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate();
    const year = d.toLocaleDateString('en-US', { year: 'numeric' });

    switch (format) {
      case "M D Y":
        return `${month} ${day} ${year}`;
      case "M Y":
        return `${month} ${year}`;
      default:
        return `${weekday}, ${month} ${day} ${year}`;
    }
  }
}

export function cleanEventName(name: string): string {
  return name.replace(/^Backblast!\s*/i, '').trim();
} 

export function formatChangeDescription(change: number | null, label: string): string {
  if (change === null) return "";
  if (change > 0) {
    return `${label} volume is up ${change.toFixed(2)}% from last month.`;
  } else if (change < 0) {
    return `${label} volume is down ${Math.abs(change).toFixed(2)}% from last month.`;
  } else {
    return `There is no change in ${label} volume from last month.`;
  }
}

export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatTime(time: string): string {
  if (!time || time.length !== 4) return time;
  const hours = parseInt(time.substring(0, 2), 10);
  const minutes = time.substring(2);
  const suffix = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes}${suffix}`;
}
