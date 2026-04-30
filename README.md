# dashboard-excel

A web-based Excel/claims dashboard built with React, Vite, and TypeScript.

---

## 🚀 How to Run the Dashboard Locally (Beginner-Friendly)

Follow every step in order. Each step builds on the previous one.

---

### Step 1 — Install Node.js (one-time setup)

Node.js is the engine that runs the dashboard on your computer. You only need to do this once.

1. Go to **https://nodejs.org** in your browser.
2. Click the big **"LTS"** (recommended) download button.
3. Open the downloaded file and follow the installer — just click **Next** through every screen.
4. When the installer finishes, close it.

**Verify it worked** — open any terminal (see Step 3 below) and run:

```bash
node -v
npm -v
```

You should see version numbers printed (e.g. `v20.11.0` and `10.2.4`). If you do, Node is ready. ✅

---

### Step 2 — Download (clone) this repository

> **If you already have the project folder on your computer, skip to Step 3.**

#### Option A — Using Git (recommended)

1. Open a terminal (see Step 3 for how to open one).
2. `cd` into the folder where you want to keep the project.  
   For example, on **Windows**: `cd C:\Users\YourName\Projects`  
   On **macOS**: `cd ~/Projects`
3. Run:

   ```bash
   git clone https://github.com/billylevine2003/dashboard-excel.git
   ```

4. A new folder called `dashboard-excel` is created. Move into it:

   ```bash
   cd dashboard-excel
   ```

#### Option B — Download a ZIP

1. On the GitHub page click **Code → Download ZIP**.
2. Unzip the file somewhere easy to find (e.g. your Desktop or `Documents/Projects`).

---

### Step 3 — Open the project in VS Code

[Visual Studio Code](https://code.visualstudio.com/) is the recommended editor because it has a built-in terminal that makes the next steps easy.

1. **Download and install VS Code** from https://code.visualstudio.com if you haven't already.
2. Open VS Code.
3. From the menu bar choose **File → Open Folder…**
4. Navigate to the `dashboard-excel` folder (wherever you cloned/unzipped it) and click **Open**.
5. VS Code will show the project files in the left sidebar — you're in the right place. ✅

---

### Step 4 — Open the integrated terminal inside VS Code

You need a terminal to run the commands that start the dashboard.

1. In VS Code, go to the top menu bar and click **Terminal → New Terminal**.  
   A panel will appear at the bottom of the VS Code window.
2. The terminal automatically starts **inside** the project folder — you don't need to `cd` anywhere.

> **Tip:** If you ever see a prompt like `PS C:\Users\…>` (PowerShell on Windows) or `username@Mac ~ %` (macOS) that is **not** inside the project folder, run `cd path/to/dashboard-excel` to navigate there first.

---

### Step 5 — Install dependencies

Dependencies are the libraries the dashboard needs. You only need to install them **once** (and again whenever someone adds new packages).

In the terminal you opened in Step 4, run:

```bash
npm install
```

This will print a lot of output and may take 30–60 seconds. When it finishes you'll see your prompt again. ✅

---

### Step 6 — Start the dev server

```bash
npm run dev
```

You'll see output similar to:

```
  VITE v5.x.x  ready in 300 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

The browser will open **automatically**. If it doesn't, open your browser and go to:

```
http://localhost:3000
```

The dashboard is now running on your machine. 🎉

---

### Step 7 — Stop the server

When you're done, go back to the terminal and press **Ctrl + C** (on both Windows and macOS). This stops the server.

---

## 🔧 Troubleshooting

### "Port 3000 is already in use"

Something else on your computer is already using port 3000.

**Quick fix — kill whatever is using the port:**

- **macOS / Linux:**
  ```bash
  lsof -ti :3000 | xargs kill -9
  ```
- **Windows (PowerShell):**
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
  ```

Then run `npm run dev` again.

**Alternative fix — use a different port:**

```bash
npm run dev -- --port 3001
```

Then open `http://localhost:3001` instead.

---

### "node: command not found" or wrong Node version

The dashboard requires **Node.js 18 or newer**.

Check your version:

```bash
node -v
```

- If the command is not found, go back to **Step 1** and install Node.js.
- If the version is below 18 (e.g. `v14.x`), download the latest LTS from https://nodejs.org and reinstall.

> **Using nvm?** Run `nvm use 20` (or `nvm install 20`) to switch to Node 20.

---

### "npm install" fails or shows errors

1. Delete the `node_modules` folder and `package-lock.json`, then reinstall:

   ```bash
   # macOS / Linux
   rm -rf node_modules package-lock.json
   npm install

   # Windows PowerShell
   Remove-Item -Recurse -Force node_modules, package-lock.json
   npm install
   ```

2. Make sure you're in the `dashboard-excel` folder (the one that contains `package.json`) when you run the command.

---

### The page is blank after opening `http://localhost:3000`

- Check the terminal for any red error messages — they usually explain what's wrong.
- Make sure `npm install` completed successfully before running `npm run dev`.
- Try a hard refresh: **Ctrl + Shift + R** (Windows) or **Cmd + Shift + R** (macOS).

---

## 🤖 AI Adjuster Summary (Optional)

The adjuster summary panel supports live AI-generated commentary for the selected adjuster.

Create a `.env` file in the project root with:

```
VITE_OPENAI_API_KEY=your_api_key
VITE_OPENAI_MODEL=gpt-4o-mini
# Optional override (defaults to OpenAI Chat Completions endpoint)
VITE_OPENAI_API_URL=https://api.openai.com/v1/chat/completions
```

If `VITE_OPENAI_API_KEY` is not set, the app automatically falls back to a local summary so the feature still works without an API key.

---

## 📝 Available Commands

| Command | What it does |
|---|---|
| `npm install` | Install/update all dependencies |
| `npm run dev` | Start the local dev server at `http://localhost:3000` |
| `npm run build` | Build an optimised production bundle |
| `npm run preview` | Preview the production build locally |
