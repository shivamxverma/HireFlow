# Hireflow LinkedIn Saver Extension

This Chrome extension saves the LinkedIn profile you are currently viewing into Hireflow.

## Install locally

1. Start the Hireflow backend.
2. Open Chrome and visit `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this `extension` folder.

## Use

1. Open a LinkedIn profile URL such as `https://www.linkedin.com/in/...`.
2. Click the Hireflow extension icon.
3. Confirm the API URL and API key.
4. Click **Save current profile**.

The extension posts to `POST /outreach-flow/profiles` and stores the profile as `LINKEDIN_EXTENSION`.

It only extracts the active profile after you click the button. It does not send messages or automate LinkedIn actions.
