const SOURCE_BASE_URLS: Record<string, string> = {
  wellfound: "https://wellfound.com",
};

export function normalizeJobUrl(source: string, applyUrl: string): string {
  const trimmedUrl = applyUrl.trim();

  if (!trimmedUrl) {
    return trimmedUrl;
  }

  if (/^https?:\/\//i.test(trimmedUrl)) {
    return trimmedUrl;
  }

  const baseUrl = SOURCE_BASE_URLS[source];

  if (!baseUrl) {
    return trimmedUrl;
  }

  return `${baseUrl}/${trimmedUrl.replace(/^\/+/, "")}`;
}
