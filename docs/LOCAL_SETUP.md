# Run KagojReady on your own computer with Google's free Gemini API

Want to look around first, with no key and no internet? Run `npm install`, then `npm run demo`, and open http://localhost:3000. Chat answers come straight from the sources. The document check in demo mode does **not** read photos (it alternates between "looks ready" and "mismatch").

Everything runs on your computer. The only thing that leaves it is the photos you add, which go to Google so Gemini can read them.

## Read this first: what the free tier means for privacy

Google's pricing page says that on the **free** Gemini API tier, what you send is used to improve Google's products, and on the **paid** tier it is not. Google's older terms also warned against sending personal information through the unpaid service, and said people may read the content.

So while you are on the free tier:
- **Use only sample documents.** 31 sets of fake specimen photos are in `testdata/specimens/`. Each folder holds `nid.jpg` and `old_passport.jpg`.
- **Do not upload real NID or passport photos**, yours or anyone else's.
- The app shows a warning on screen while the free tier is active, and it refuses to start in production on the free tier.

When you want to use real documents, enable billing (see "Switching later").

## Steps (Windows, macOS or Linux)

1. **Install Node.js 20 or newer** from https://nodejs.org (the LTS version). Check with `node -v`.
2. **Unzip the project** and open a terminal in its folder. On Windows: open the folder, click the address bar, type `cmd`, press Enter.
3. **Install:** `npm install` (needs internet, 1 to 3 minutes).
4. **Get a free key:** open https://aistudio.google.com/apikey, sign in with a Google account, create a key, and copy it.
5. **Create your settings file.** Windows: `copy .env.example .env`. macOS/Linux: `cp .env.example .env`. Open `.env` in a text editor and paste your key after `GEMINI_API_KEY=`. Leave `LLM_PROVIDER=gemini` and `GEMINI_TIER=free`. Save. Never share this file.
6. **Check that it works:** `npm run check:llm`. It tests your key, finds a valid model name, and reads two sample photos. You want to see `Setup looks good`.
7. **Start the app:** `npm run start:dev`, then open http://localhost:3000 in your browser. Press Ctrl+C in the terminal to stop it.
8. **Try it** with sample photos from `testdata/specimens/`:

| Folder | Add both photos | You should see |
|---|---|---|
| `clean_english__clean` | nid.jpg and old_passport.jpg | Looks ready |
| `dob_year_mismatch__clean` | both | Not ready (date of birth differs) |
| `name_honorific_missing__clean` | both | Almost ready (name written differently) |
| `missing_old_passport__clean` | nid.jpg only | Not ready (passport missing) |
| `clean_english__blur` | both | Probably "could not read clearly" |

You can also just type questions, in Bangla or English, for example "পাসপোর্ট নবায়নের জন্য কী কী কাগজ লাগে?" or "How long does an NID correction take?". Answers come from the knowledge base, written by the AI and then checked. An off-topic question such as the weather is politely declined.

On a phone-sized window the layout is easiest to judge. The app is in Bangla by default; the button at the top right switches to English.

## Free-tier limits

The app sends at most **5 requests a minute** on the free tier, because Google no longer publishes exact per-model limits. Each document photo is one request, and each chat answer is one request, so a two-document check takes about 25 seconds, and a second question asked straight away may wait a few seconds with the typing dots showing. If Google asks the app to wait, it waits. To see your real limits, open https://aistudio.google.com/rate-limit and set `LLM_MAX_RPM` in `.env` to match. Daily limits reset at midnight Pacific time.

## Switching providers and tiers

Change one line in `.env`, then restart (`Ctrl+C`, then `npm run start:dev`).

| You want | Set in `.env` |
|---|---|
| Gemini, free | `LLM_PROVIDER=gemini`, `GEMINI_API_KEY=...`, `GEMINI_TIER=free` |
| Gemini, paid | Enable billing for the project that owns your key in Google AI Studio, then set `GEMINI_TIER=paid` and `LLM_MAX_RPM=0` |
| Claude instead | `LLM_PROVIDER=anthropic` and `ANTHROPIC_API_KEY=...` |
| A different model | `LLM_MODEL=<name>`. `npm run check:llm` lists the names your key can use |

Setting `GEMINI_TIER=paid` is your statement that billing is on. The app cannot check it.

## If something goes wrong

| What you see | What to do |
|---|---|
| `The key was rejected` | Copy the key again from AI Studio. No spaces or quotes in `.env` |
| `not available in your country or region` | Google's API is not offered where you are, or on this network. Try another network, or use Claude |
| `Model ... is not available` | Use a name from the list the check prints: `LLM_MODEL=...` |
| `rate or daily limit` | Wait a few minutes, or until midnight Pacific. Lower `LLM_MAX_RPM` |
| `Could not reach the AI service` | Check internet, VPN or firewall |
| Page says "This service is not available right now" | The server has no key. Check `.env`, then restart |
| Banner says "Demo mode" | You started with `npm run demo`. Use `npm run start:dev` |

## Not yet verified

This was built and tested against a local imitation of Gemini's documented web format, not against Google's real service, because no key was available when it was written. `npm run check:llm` is the first real test. If it reports anything unexpected, send me the output (it never prints your key).

The default model name `gemini-flash-latest` is a guess that may need changing. Google renames models often.
