# RxGuard — Offline Prescription Safety Checker

RxGuard is a **client-side educational prototype** that helps flag possible medication-safety concerns in a typed prescription. It was designed with low-connectivity settings in mind and includes English, Hindi, Telugu, and Tamil interfaces.

> **Important medical-safety notice**
>
> RxGuard is a student/hackathon prototype, **not a medical device** and not a substitute for a qualified doctor or pharmacist. Its rules are limited and may be incomplete, incorrect, or out of date. Do not use its output to diagnose a condition, prescribe or change a medicine, or make a treatment decision. A qualified clinician or pharmacist must independently verify every concern. Do not enter real patient-identifying information.

## Features

- Checks a typed or pasted medicine list for possible drug interactions and duplicate medicines.
- Flags selected dose-related concerns, including some weight-based child-dose checks.
- Includes selected allergy, age, pregnancy, and health-condition warnings.
- Shows findings with severity/action guidance and a safety score for demonstration purposes.
- English, Hindi, Telugu, and Tamil interface options.
- Light/dark appearance, read-aloud support, print report, and copy-summary options.
- Progressive Web App (PWA) support for caching the app for offline use after it has been loaded once over HTTP/HTTPS.
- Runs locally in the browser; the app code does not intentionally send entered information to a server.

## Tech stack

- HTML5, CSS3, and vanilla JavaScript
- Service Worker and Web App Manifest for PWA/offline caching
- Node.js for the included engine tests

No frontend framework, package installation, API key, or build step is required.

## Run locally

You need a modern browser. Python 3 is recommended for serving the app locally; Node.js is needed only if you want to run the tests.

### Option 1: Windows

1. Download or clone this repository.
2. Open the project folder.
3. Double-click `start.bat`.
4. The app should open at <http://localhost:8000>.

If the browser does not open automatically, visit <http://localhost:8000> after the server starts.

### Option 2: macOS / Linux

From the project folder, run:

```bash
chmod +x start.sh
./start.sh
```

Then visit <http://localhost:8000> if it does not open automatically.

### Option 3: Start the server manually

From the project folder, run one of the following:

```bash
python -m http.server 8000
```

or

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000> in your browser. Serving the app over localhost is recommended for Service Worker/PWA functionality; opening `index.html` directly may limit offline-install features.

## Run the tests

Install Node.js if it is not already installed, then run this command from the project folder:

```bash
node tests/engine.test.js
```

The test file checks representative parsing and rule-engine scenarios. Passing these tests does **not** establish clinical accuracy, completeness, or safety for real-world use.

## Project structure

```text
RxGuard/
├── index.html                 # Main application page
├── favicon.svg                # Browser tab icon
├── manifest.webmanifest       # PWA metadata
├── sw.js                      # Offline cache/service worker
├── start.bat                  # Windows local-server launcher
├── start.sh                   # macOS/Linux local-server launcher
├── assets/
│   └── logo.svg               # App logo
├── css/
│   └── style.css              # App styling and themes
├── js/
│   ├── data.js                # Hand-curated medicine/rule data
│   ├── engine.js              # Prescription parsing and rule checks
│   ├── i18n.js                # Main translations
│   ├── i18n.more.js           # Additional translated strings
│   └── app.js                 # UI and browser interactions
└── tests/
    └── engine.test.js         # Node.js engine tests
```

## Demo walkthrough

1. Open the app and try one of the built-in sample prescriptions.
2. Review the findings and their suggested actions.
3. Switch between English, Hindi, Telugu, and Tamil.
4. Try read-aloud, copy-summary, or print-report options.
5. Try a sample with fewer warnings to compare the demo output.

Sample cases are illustrative only and are not treatment recommendations.

## Known limitations

- The medicine list and rules are limited and do not cover every medicine, brand, dose, patient group, or interaction.
- Prescription text parsing is heuristic. Unrecognized names or formats may not be interpreted correctly.
- Results can include false positives or miss genuine risks; a green/low-risk result does not prove a prescription is safe.
- The safety score is a prototype display metric, not a validated clinical risk score.
- Some detailed interaction explanations may remain in English. Translations should be reviewed by qualified native-speaking clinicians before any clinical use.
- The rule data needs independent clinical review, evidence references, maintenance, and formal validation before any real-world healthcare use.
- Offline caching is intended for app assets. Do not treat this as secure medical-record storage.

## Contributing

For code improvements, open an issue describing the bug or proposed change, then submit a pull request with a clear summary and test results. Changes to medication rules should include reliable clinical references and must be reviewed by qualified professionals before being considered for real-world use.

## License

No open-source license has been added yet. Unless a license is added, normal copyright restrictions apply; please do not assume the code is available for reuse or redistribution. Choose and add a license before inviting others to reuse the project.
