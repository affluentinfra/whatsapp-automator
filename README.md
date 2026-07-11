# Creative Automation Platform (CAP)

CAP is a modern, responsive **Creative Automation Platform** built with **Python Flask** and **Supabase (PostgreSQL & Storage)**. The platform is designed for marketing teams, channel partners, sales agents, and real estate professionals to generate personalized marketing creatives from templates and share them directly via WhatsApp.

---

## 🚀 Key Features

1. **Dashboard & Analytics**: Displays overall share metrics, daily performance graphs (using Chart.js), user activity leaderboards, and top-performing templates.
2. **Visual Template Designer**: Allows admins to upload background graphics and define dynamic placeholders (e.g., Name, Mobile, Logo, QR Code) using a drag-and-drop **Fabric.js** canvas stage.
3. **Contact Manager**: Supports manually adding contacts or bulk importing lists from **CSV** or **Excel (.xlsx)**. Features auto phone number normalization (e.g. `+91 98765-43210` -> `919876543210`) and manual duplicate prompt resolution.
4. **Campaign Coordinator**: Links active marketing campaigns to specified templates.
5. **Instant WhatsApp Clipboard Share**: 
   - Generates quick manual click-to-chat links using `https://wa.me/` redirects.
   - Bypasses progress screens on single shares for rapid execution.
   - **Clipboard Injection**: Automatically copies the generated creative image to your clipboard on share, allowing you to press **`Ctrl + V`** inside WhatsApp Web to instantly attach the native image file!
6. **Robust Auth System**: Uses cryptographically signed secure cookie sessions and supports in-browser user registration with role switching.

---

## 🛠️ Tech Stack

- **Backend**: Python Flask, SQLite (development fallback), Supabase Client.
- **Database & Storage**: Supabase PostgreSQL, Supabase Blob Storage, SQLite (local config fallback).
- **Frontend**: HTML5, Javascript, Fabric.js (Canvas editor), Chart.js (Analytics), FontAwesome (Icons), custom Vanilla CSS (Dark/Light toggle themes).

---

## 💻 Local Setup & Running

### Prerequisites
- Python 3.10 or higher.
- A Supabase account (Optional, defaults to local SQLite).

### Installation Steps

1. **Clone the Repository** and open the folder:
   ```powershell
   cd "whatsapp automator"
   ```

2. **Install Dependencies**:
   ```powershell
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```powershell
   cp .env.example .env
   ```
   Open the `.env` file and customize your configurations. By default, leaving `SUPABASE_URL` and `SUPABASE_KEY` blank will make the application run using a local SQLite file (`cap_local.db`) and local files saving.

4. **Launch the Flask Server**:
   ```powershell
   python app.py
   ```
   The application will boot up at **`http://127.0.0.1:5000`**.

---

## ☁️ Connecting to Supabase Cloud

To switch database and storage layers to the cloud:

1. **Create Database Schema**:
   Open the Supabase Dashboard, go to **SQL Editor** -> **New Query**, copy the contents of the `supabase_schema.sql` file, and click **Run**. This creates all Postgres tables and default settings.

2. **Configure Storage Bucket**:
   Go to the **Storage** tab in your Supabase Dashboard, create a new bucket named exactly **`cap-creatives`**, and make it **Public**.

3. **Set credentials in `.env`**:
   Add your Supabase URL and keys to `.env`. 
   > ⚠️ **Important**: For backend server environments like Flask, replace the `SUPABASE_KEY` with the **`service_role`** secret key found under *Project Settings -> API* in Supabase. This bypasses Row Level Security (RLS) constraints for server-side insertions.

4. **Restart Server**:
   ```powershell
   python app.py
   ```
   The database tables will sync automatically.

---

## 📂 Project Structure

```
whatsapp automator/
├── app.py                  # Main Flask application & REST APIs
├── database.py             # Database layer (SQLite / Supabase Postgres)
├── storage.py              # Media storage layer (Local / Supabase bucket)
├── requirements.txt        # PIP dependencies
├── .env.example            # Configuration templates
├── .gitignore              # Files excluded from git tracking
├── supabase_schema.sql     # Database setup queries for Supabase SQL editor
├── view_db.py              # Command-line tool to inspect SQLite tables
├── test_app.py             # Server unit test verification suite
├── templates/
│   └── index.html          # SPA interface template
└── static/
    ├── css/
    │   └── styles.css      # Core styles & dark/light layout themes
    └── js/
        ├── api.js          # Fetch REST caller wrapper
        ├── canvas-editor.js# Fabric.js stage builders
        └── app.js          # Core client router & controller
```
