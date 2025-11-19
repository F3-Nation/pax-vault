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
  format?: "M D Y" | "M Y"
): string {
  // Normalize input to a pure UTC date (no local conversion!)
  const d =
    typeof date === "string"
      ? new Date(date + "T00:00:00Z")
      : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  // Always use UTC now
  const now = new Date();
  const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Compute start of week in UTC
  const startOfWeek = new Date(utcNow);
  startOfWeek.setUTCDate(utcNow.getUTCDate() - utcNow.getUTCDay());

  const optionsUTC = (opts: Intl.DateTimeFormatOptions) => ({
    ...opts,
    timeZone: "UTC"
  });

  if (d >= startOfWeek && !format) {
    return d.toLocaleDateString("en-US", optionsUTC({ weekday: "long" }));
  } else {
    const weekday = d.toLocaleDateString("en-US", optionsUTC({ weekday: "short" }));
    const month = d.toLocaleDateString("en-US", optionsUTC({ month: "short" }));
    const day = d.getUTCDate();
    const year = d.toLocaleDateString("en-US", optionsUTC({ year: "numeric" }));

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

export function fallbackF3Logo(color: string = "#fff"): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 41.73 41.73">
      <circle stroke="${color}" fill="none" stroke-width="2" cx="20.86" cy="20.86" r="19.86" />
      <path fill="${color}" d="M16.8,10.69v18.12c0,.4.08.69.23.86.08.1.16.17.23.19.07.03.31.09.71.19.49.11.74.4.74.85,0,.27-.13.48-.4.65-.2.12-.52.19-.97.19h-7.8c-.37,0-.66-.07-.86-.21-.2-.14-.3-.34-.3-.59,0-.42.21-.7.62-.83.34-.11.54-.18.59-.21.06-.03.12-.08.18-.18.12-.16.19-.43.19-.79v-15.44c0-.36-.06-.62-.19-.79-.06-.09-.12-.15-.18-.18-.06-.03-.25-.09-.59-.21-.41-.13-.62-.41-.62-.83,0-.26.1-.46.3-.59s.49-.21.86-.21h7.26ZM18.08,21.92v-1.79c.61-.29,1.05-.6,1.33-.93.28-.33.49-.79.62-1.36.08-.39.19-.66.32-.81s.32-.22.57-.22c.33,0,.56.13.68.39.07.13.11.44.11.91v5.88c0,.48-.05.82-.16,1-.11.19-.31.28-.59.28-.24,0-.42-.07-.56-.22-.13-.14-.24-.38-.32-.72-.19-.71-.44-1.25-.76-1.63-.32-.38-.74-.63-1.25-.76ZM18.16,10.69h6.21v5.38c0,.35-.06.6-.19.76-.12.15-.32.23-.6.23-.21,0-.37-.05-.49-.16s-.22-.29-.3-.55c-.15-.5-.35-.97-.6-1.39-.25-.42-.52-.78-.83-1.08-.42-.41-.88-.73-1.39-.94s-1.11-.36-1.82-.45v-1.8Z"/>
    <path fill="${color}" d="M29.34,22.52v.99c-.7-.09-1.3-.24-1.79-.46-.57-.25-1.01-.59-1.32-1.01s-.47-.89-.47-1.4.17-.97.51-1.33c.34-.35.76-.53,1.26-.53.55,0,1.01.22,1.38.66.26.31.39.65.39,1.01,0,.26-.07.51-.2.75-.13.25-.31.45-.53.6-.2.14-.3.25-.3.33,0,.1.11.19.32.26s.46.11.75.11ZM29.34,10.36v.95c-.25.06-.42.12-.53.18-.07.04-.13.09-.17.15s-.07.12-.07.16c0,.1.07.2.2.3l.43.35c.21.17.31.47.31.9,0,.46-.17.85-.5,1.18-.33.33-.73.49-1.19.49s-.86-.17-1.17-.5c-.31-.34-.47-.75-.47-1.25,0-.43.11-.84.33-1.22.22-.39.54-.72.94-.99.47-.31,1.09-.55,1.89-.7ZM32.18,16.77c.55.16.96.31,1.23.44s.51.29.72.48c.28.26.5.58.66.98.16.4.25.81.25,1.24,0,.98-.33,1.78-1,2.42-.41.39-.91.69-1.5.89-.59.21-1.24.31-1.94.31h-.42v-1c.35-.1.61-.25.76-.44.09-.11.16-.23.2-.36.04-.13.06-.3.06-.51v-2.71c0-.26-.01-.46-.04-.58-.03-.12-.08-.24-.17-.35-.18-.23-.45-.36-.83-.38-.25-.01-.42-.04-.5-.09-.14-.09-.21-.22-.21-.4s.05-.3.15-.37.28-.12.55-.14c.71-.06,1.06-.42,1.06-1.07v-.37s0-2.13,0-2.13c0-.4-.08-.69-.23-.88-.15-.19-.42-.33-.79-.42v-1h.26c.6,0,1.19.08,1.75.25.56.17,1.04.41,1.43.71.39.3.69.65.89,1.05.2.41.31.84.31,1.31,0,.84-.27,1.54-.8,2.1-.23.25-.48.44-.74.59-.26.15-.63.29-1.1.44Z"/>
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
