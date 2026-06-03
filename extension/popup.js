const DEFAULT_API_URL = "http://localhost:3000";
const DEFAULT_API_KEY = "hireflow_sec_key_2026_x92a8b";

const apiUrlInput = document.getElementById("apiUrl");
const apiKeyInput = document.getElementById("apiKey");
const saveSettingsButton = document.getElementById("saveSettings");
const saveProfileButton = document.getElementById("saveProfile");
const messageEl = document.getElementById("message");
const statusDot = document.getElementById("statusDot");
const preview = document.getElementById("preview");
const profileName = document.getElementById("profileName");
const profileUrl = document.getElementById("profileUrl");

function setMessage(text, type = "") {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`.trim();
}

function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function normalizeLinkedInUrl(value) {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/in\/[^/?#]+/);
    if (!match) return value;
    return `${url.origin}${match[0]}/`;
  } catch {
    return value;
  }
}

function extractProfileFromPage(fallbackTitle, fallbackUrl) {
  const text = (selector, root = document) => {
    if (!root) return "";
    return cleanText(root.querySelector(selector)?.textContent);
  };
  const meta = (name) => cleanText(document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.content);
  const profileCard =
    document.querySelector("main section.artdeco-card") ||
    document.querySelector("main .pv-top-card") ||
    document.querySelector("main") ||
    document;
  const titleName = cleanText((document.title || fallbackTitle || "").replace(/\s*\|\s*LinkedIn.*$/i, ""));
  const fallbackUrlName = cleanText((fallbackUrl || window.location.href).match(/\/in\/([^/?#]+)/)?.[1]?.replace(/[-_]+/g, " "));
  const ignoredTopCardText = new Set([
    "he/him",
    "she/her",
    "they/them",
    "contact info",
    "open to",
    "add section",
    "enhance profile",
    "more",
    "show details",
  ]);

  const isVisible = (element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
  };

  const topCardItems = Array.from((profileCard || document).querySelectorAll("h1, h2, h3, p, span, a"))
    .filter(isVisible)
    .map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        text: cleanText(node.textContent),
        x: rect.left,
        y: rect.top,
      };
    })
    .filter((item) => item.text && item.text.length < 180)
    .filter((item) => item.y >= 0 && item.y < Math.min(window.innerHeight, 900))
    .filter((item) => item.x < window.innerWidth * 0.78)
    .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));

  const uniqueTopCardTexts = [];
  for (const item of topCardItems) {
    if (!uniqueTopCardTexts.includes(item.text)) {
      uniqueTopCardTexts.push(item.text);
    }
  }

  const isProfileMetaText = (value) => {
    const normalized = value.toLowerCase();
    return (
      ignoredTopCardText.has(normalized) ||
      /^view /.test(normalized) ||
      /^open /.test(normalized) ||
      /^edit /.test(normalized) ||
      /^skip /.test(normalized) ||
      /followers?|connections?/i.test(value) ||
      /profile views|post impressions|search appearances/i.test(value)
    );
  };

  const name =
    text("h1", profileCard) ||
    text("h2", profileCard) ||
    text("main h1") ||
    text("main h2") ||
    titleName ||
    fallbackUrlName ||
    meta("og:title").replace(/ \| LinkedIn$/, "");
  const nameIndex = uniqueTopCardTexts.findIndex((value) => value === name);
  const profileTextAfterName = nameIndex >= 0 ? uniqueTopCardTexts.slice(nameIndex + 1) : uniqueTopCardTexts;
  const orderedProfileText = profileTextAfterName.filter((value) => value !== name && !isProfileMetaText(value));

  const headline =
    text(".text-body-medium.break-words", profileCard) ||
    text(".pv-text-details__left-panel .text-body-medium", profileCard) ||
    orderedProfileText.find((value) => !value.includes(" · ") && !/\b(area|india|united states|remote|hybrid)\b/i.test(value)) ||
    meta("description");
  const companyLine =
    orderedProfileText.find((value) => value.includes(" · ") && value !== headline) ||
    "";

  const profileLocation =
    text(".text-body-small.inline.t-black--light.break-words", profileCard) ||
    text(".pv-text-details__left-panel .text-body-small", profileCard) ||
    orderedProfileText.find((value) => /\b(area|india|united states|canada|united kingdom|remote|hybrid)\b/i.test(value)) ||
    "";
  const pronouns = uniqueTopCardTexts.find((value) => /^(he\/him|she\/her|they\/them)$/i.test(value));

  const about =
    text("#about ~ div .inline-show-more-text") ||
    text('section:has(#about) .inline-show-more-text') ||
    "";

  const topCardLinks = profileCard ? Array.from(profileCard.querySelectorAll("a[href*='/company/'], a[href*='/school/']")) : [];
  const companyCandidates = topCardLinks
    .map((node) => cleanText(node.textContent).replace(/\s+logo$/, ""))
    .filter(Boolean)
    .filter((value) => !value.includes("LinkedIn"))
    .filter((value) => value.length > 1);

  const profileImage = profileCard ? (
    profileCard.querySelector("img.pv-top-card-profile-picture__image, img.profile-photo-edit__preview, img.presence-entity__image") ||
    Array.from(profileCard.querySelectorAll("img")).find((image) => {
      const alt = image.getAttribute("alt") || "";
      return (name && alt.includes(name)) || /profile/i.test(alt);
    })
  ) : null;
  const profileImageUrl = profileImage?.src || "";
  const followers = uniqueTopCardTexts.find((value) => /\bfollowers?\b/i.test(value));
  const connections = uniqueTopCardTexts.find((value) => /\bconnections?\b/i.test(value));

  const companyFromHeadline = headline.match(/\bat\s+([^|,]+)/i)?.[1];
  const companyFromLine = companyLine.split(" · ")[0];
  const company = cleanText(companyCandidates[0] || companyFromLine || companyFromHeadline || "Unknown");

  return {
    name,
    role: headline || "LinkedIn profile",
    company,
    linkedinUrl: normalizeLinkedInUrl(window.location.href || fallbackUrl),
    notes: [
      headline ? `Headline: ${headline}` : "",
      pronouns ? `Pronouns: ${pronouns}` : "",
      companyLine ? `Profile card company/school: ${companyLine}` : "",
      profileLocation ? `Location: ${profileLocation}` : "",
      followers ? `Followers: ${followers}` : "",
      connections ? `Connections: ${connections}` : "",
      profileImageUrl ? `Profile image: ${profileImageUrl}` : "",
      about ? `About: ${about}` : "",
    ].filter(Boolean).join("\n"),
    source: "LINKEDIN_EXTENSION",
    tags: ["linkedin", "extension"],
  };
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function extractFromActiveTab() {
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url?.includes("linkedin.com/in/")) {
    throw new Error("Open a LinkedIn profile URL first.");
  }

  let result;
  let extractionError = null;
  try {
    [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractProfileFromPage,
      args: [tab.title || "", tab.url || ""],
    });
  } catch (error) {
    console.error("Hireflow page extraction failed:", error);
    extractionError = error.message || String(error);
  }

  const extractedProfile = result?.result || {};
  const fallbackName = cleanText((tab.title || "").replace(/\s*\|\s*LinkedIn.*$/i, ""));
  const fallbackSlugName = cleanText(tab.url.match(/\/in\/([^/?#]+)/)?.[1]?.replace(/[-_]+/g, " "));
  const name = extractedProfile.name || fallbackName || fallbackSlugName;

  return {
    ...extractedProfile,
    name,
    role: extractedProfile.role || "LinkedIn profile",
    company: extractedProfile.company || "Unknown",
    linkedinUrl: extractedProfile.linkedinUrl || normalizeLinkedInUrl(tab.url),
    notes: extractedProfile.notes || `Saved from Chrome tab: ${tab.title || tab.url}${extractionError ? `\n(Extraction Error: ${extractionError})` : ""}`,
  };
}

async function loadSettings() {
  const settings = await chrome.storage.sync.get(["apiUrl", "apiKey"]);
  apiUrlInput.value = settings.apiUrl || DEFAULT_API_URL;
  apiKeyInput.value = settings.apiKey || DEFAULT_API_KEY;
  statusDot.classList.add("ready");
}

async function saveSettings() {
  await chrome.storage.sync.set({
    apiUrl: apiUrlInput.value.trim() || DEFAULT_API_URL,
    apiKey: apiKeyInput.value.trim() || DEFAULT_API_KEY,
  });
  setMessage("Settings saved.", "success");
}

async function saveProfile() {
  saveProfileButton.disabled = true;
  setMessage("Reading current LinkedIn profile...");

  try {
    const profile = await extractFromActiveTab();
    preview.classList.remove("hidden");
    profileName.textContent = profile.name;
    profileUrl.textContent = profile.linkedinUrl;

    const apiUrl = (apiUrlInput.value.trim() || DEFAULT_API_URL).replace(/\/$/, "");
    const apiKey = apiKeyInput.value.trim() || DEFAULT_API_KEY;

    setMessage("Saving to Hireflow...");
    const response = await fetch(`${apiUrl}/outreach-flow/profiles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        "bypass-tunnel-reminder": "true",
      },
      body: JSON.stringify({ profiles: [profile] }),
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || json.error || "Hireflow rejected the profile.");
    }

    setMessage("Saved to Hireflow.", "success");
  } catch (error) {
    setMessage(error.message || String(error), "error");
  } finally {
    saveProfileButton.disabled = false;
  }
}

saveSettingsButton.addEventListener("click", saveSettings);
saveProfileButton.addEventListener("click", saveProfile);
loadSettings().catch((error) => setMessage(error.message || String(error), "error"));
