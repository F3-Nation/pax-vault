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
    const year = d.getFullYear();

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