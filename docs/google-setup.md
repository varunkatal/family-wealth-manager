# Setting up Google sign-in

The app needs a Google **OAuth Client ID** to save to Google Sheets. It's free and takes about 15 minutes. You end up with one public value, the Client ID; you never need a client secret.

## 1. Create a project

1. Open [console.cloud.google.com](https://console.cloud.google.com) and sign in.
2. Project picker (top left) → **New project** → name it `Family Wealth Calculator` → **Create**, and make sure it is selected.

## 2. Turn on the APIs

Enable both, in the same project:

- [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)
- [Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com)

## 3. Sign-in screen

Open [Google Auth Platform](https://console.cloud.google.com/auth/overview) → **Get started**:

- App name `Family Wealth Calculator`, your support email.
- Audience: **External**.
- Contact email, agree, **Create**.

Then **Audience → Test users → Add users**: add the Google account(s) that will sign in while the app is in testing.

## 4. Client ID

**Clients → Create client**:

- Application type: **Web application**.
- **Authorized JavaScript origins**: `http://localhost:5173` (exactly; no trailing slash). Leave redirect URIs empty.
- **Create** and copy the **Client ID** (`…apps.googleusercontent.com`). Ignore the client secret.

Put it in `.env.local` in the project folder (this file is not committed):

```
VITE_GOOGLE_CLIENT_ID=123456789-abc….apps.googleusercontent.com
```

Restart `npm run dev`. The **Connect Google Sheet** button is now enabled.

## 5. Let other families sign in

While the app is in *Testing*, only test users can sign in, and Google asks them to sign in again every 7 days. To open it to everyone:

1. Host the app (see the README) and add its address, e.g. `https://your-site.netlify.app`, to the client's **Authorized JavaScript origins**.
2. **Branding**: add the home page (`https://your-site…/`) and privacy policy (`https://your-site…/privacy.html`) links.
3. **Audience → Publish app**.

The app uses only `drive.file`, a non-sensitive permission, so publishing needs no security assessment. Until Google verifies the app's branding (optional, free), users may see “Google hasn't verified this app”; they continue with **Advanced → Go to Family Wealth Calculator**.

## Troubleshooting

| Message | Fix |
|---|---|
| `Error 400: origin_mismatch` | The page's address must be listed exactly under Authorized JavaScript origins. Changes can take a few minutes. |
| `Error 403: access_denied` / “has not completed the Google verification process” | Add that account under **Audience → Test users**, or publish the app. A work (Google Workspace) account may also be blocked by its admin; use a personal account. |
| “Google Drive API (or Sheets API) has not been used in project … or it is disabled” | Enable both APIs in the project that owns the Client ID, wait a few minutes. |
| “The Google sign-in window was blocked” | Allow pop-ups for the site. |
| Connect button disabled | `.env.local` is missing or misnamed, or the dev server wasn't restarted. |
