export const formatINR = (n: number, opts: { showSign?: boolean; compact?: boolean } = {}): string => {
  if (n === null || n === undefined || isNaN(n)) return "₹0";
  const abs = Math.abs(n);
  if (opts.compact && abs >= 100000) {
    if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  }
  const formatted = abs.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  if (opts.showSign && n > 0) return `+₹${formatted}`;
  if (n < 0) return `−₹${formatted}`;
  return `₹${formatted}`;
};

export const formatPercent = (n: number, opts: { showSign?: boolean } = {}): string => {
  if (n === null || n === undefined || isNaN(n)) return "0.0%";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${opts.showSign === false ? "" : sign}${Math.abs(n).toFixed(1)}%`;
};

export const formatNumber = (n: number): string => {
  if (n === null || n === undefined || isNaN(n)) return "0";
  return n.toLocaleString("en-IN");
};

export const formatDate = (s: string | Date): string => {
  const d = typeof s === "string" ? new Date(s) : s;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export const formatRelativeTime = (s: string | Date): string => {
  const d = typeof s === "string" ? new Date(s) : s;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
};

export const amountColor = (n: number): string => {
  if (n > 0) return "text-success";
  if (n < 0) return "text-destructive";
  return "text-muted-foreground";
};
