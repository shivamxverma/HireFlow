import * as fs from "fs";
import * as path from "path";

function importCookies() {
  const authDir = path.resolve(process.cwd(), "authentication");
  const rawCandidates = [
    path.resolve(process.cwd(), "raw-cookies.json"),
    path.resolve(authDir, "raw-cookies.json"),
  ];
  const rawPath = rawCandidates.find((candidate) => fs.existsSync(candidate));
  const outputPath = path.resolve(authDir, "session.json");

  if (!rawPath) {
    console.error(`\n❌ Error: Could not find 'raw-cookies.json'. Checked: ${rawCandidates.join(", ")}`);
    console.log("Please export your cookies using a standard browser extension (like Cookie-Editor) and save it as 'raw-cookies.json'.");
    process.exit(1);
  }

  try {
    fs.mkdirSync(authDir, { recursive: true });
    const rawContent = fs.readFileSync(rawPath, "utf-8");
    const rawCookies = JSON.parse(rawContent);

    if (!Array.isArray(rawCookies)) {
      throw new Error("raw-cookies.json must be a JSON array containing cookie objects.");
    }

    const mappedCookies = rawCookies.map((cookie: any) => {
      // Map SameSite values to formats Playwright understands (Lax, Strict, None)
      let sameSite = "Lax";
      if (cookie.sameSite) {
        const val = cookie.sameSite.toLowerCase();
        if (val === "no_restriction" || val === "none") sameSite = "None";
        else if (val === "lax") sameSite = "Lax";
        else if (val === "strict") sameSite = "Strict";
      }

      return {
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expirationDate || Math.floor(Date.now() / 1000) + 86400 * 30, // fallback: 30 days
        httpOnly: cookie.httpOnly ?? false,
        secure: cookie.secure ?? true,
        sameSite: sameSite,
      };
    });

    const storageState = {
      cookies: mappedCookies,
      origins: [],
    };

    fs.writeFileSync(outputPath, JSON.stringify(storageState, null, 2), "utf-8");
    console.log(`\n✅ Success! Converted exported cookies to Playwright format!`);
    console.log(`Saved session credentials to: ${outputPath}`);
    console.log("You can now run the live Wellfound connector with the saved session.");
  } catch (error: any) {
    console.error("\n❌ Failed to parse or map cookies:", error.message);
  }
}

importCookies();
