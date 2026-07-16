import os
import sqlite3
import json
from datetime import datetime
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Critical Configuration Error: SUPABASE_URL and SUPABASE_KEY environment variables are required. Local SQLite DB is disabled.")

try:
    from supabase import create_client
    supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("Connected to Supabase successfully!")
except Exception as e:
    raise RuntimeError(f"Critical Connection Error: Failed to connect to Supabase: {e}. Local SQLite DB is disabled.")

IS_SUPABASE = True
DB_FILE = None

def get_db_connection():
    raise RuntimeError("Local SQLite database is disabled. Access denied.")

def init_db():
    """Initialize database connection. Enforces Supabase presence."""
    print("Supabase database active. Connection verified successfully!")


# Unified Database API Methods

# --- USERS ---
def get_user_by_email(email):
    if IS_SUPABASE:
        try:
            res = supabase_client.table("users").select("*").eq("email", email).execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            print(f"Supabase user error: {e}")
        return None
    
    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()
    return dict(user) if user else None

def get_users():
    if IS_SUPABASE:
        res = supabase_client.table("users").select("*").execute()
        return res.data
    conn = get_db_connection()
    users = conn.execute("SELECT id, email, role, name, created_at FROM users").fetchall()
    conn.close()
    return [dict(u) for u in users]

def create_user(email, password_hash, role, name):
    if IS_SUPABASE:
        data = {"email": email, "password_hash": password_hash, "role": role, "name": name}
        res = supabase_client.table("users").insert(data).execute()
        return res.data[0] if res.data else None
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)",
        (email, password_hash, role, name)
    )
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": new_id, "email": email, "role": role, "name": name}

# --- CONTACTS ---
def get_contacts():
    if IS_SUPABASE:
        res = supabase_client.table("contacts").select("*").order("name").execute()
        return res.data
    conn = get_db_connection()
    contacts = conn.execute("SELECT * FROM contacts ORDER BY name").fetchall()
    conn.close()
    return [dict(c) for c in contacts]

def get_contact_by_mobile(mobile):
    if IS_SUPABASE:
        res = supabase_client.table("contacts").select("*").eq("mobile", mobile).execute()
        return res.data[0] if res.data else None
    conn = get_db_connection()
    contact = conn.execute("SELECT * FROM contacts WHERE mobile = ?", (mobile,)).fetchone()
    conn.close()
    return dict(contact) if contact else None

def create_contact(name, mobile, company, designation, notes):
    if IS_SUPABASE:
        data = {"name": name, "mobile": mobile, "company": company, "designation": designation, "notes": notes}
        res = supabase_client.table("contacts").insert(data).execute()
        return res.data[0] if res.data else None
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO contacts (name, mobile, company, designation, notes) VALUES (?, ?, ?, ?, ?)",
        (name, mobile, company, designation, notes)
    )
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": new_id, "name": name, "mobile": mobile, "company": company, "designation": designation, "notes": notes}

def update_contact(contact_id, name, mobile, company, designation, notes):
    if IS_SUPABASE:
        data = {"name": name, "mobile": mobile, "company": company, "designation": designation, "notes": notes}
        res = supabase_client.table("contacts").update(data).eq("id", contact_id).execute()
        return res.data[0] if res.data else None
    conn = get_db_connection()
    conn.execute(
        "UPDATE contacts SET name = ?, mobile = ?, company = ?, designation = ?, notes = ? WHERE id = ?",
        (name, mobile, company, designation, notes, contact_id)
    )
    conn.commit()
    conn.close()
    return {"id": contact_id, "name": name, "mobile": mobile, "company": company, "designation": designation, "notes": notes}

def delete_contact(contact_id):
    if IS_SUPABASE:
        res = supabase_client.table("contacts").delete().eq("id", contact_id).execute()
        return True
    conn = get_db_connection()
    conn.execute("DELETE FROM contacts WHERE id = ?", (contact_id,))
    conn.commit()
    conn.close()
    return True

# --- TEMPLATES ---
def get_templates(include_archived=False):
    if IS_SUPABASE:
        query = supabase_client.table("templates").select("*")
        if not include_archived:
            query = query.eq("status", "active")
        res = query.order("created_at", desc=True).execute()
        # Fetch fields for each template
        templates = res.data
        for t in templates:
            f_res = supabase_client.table("template_fields").select("*").eq("template_id", t["id"]).execute()
            t["fields"] = f_res.data
        return templates

    conn = get_db_connection()
    sql = "SELECT * FROM templates"
    if not include_archived:
        sql += " WHERE status = 'active'"
    sql += " ORDER BY created_at DESC"
    templates = conn.execute(sql).fetchall()
    
    result = []
    for t in templates:
        tdict = dict(t)
        fields = conn.execute("SELECT * FROM template_fields WHERE template_id = ?", (tdict["id"],)).fetchall()
        tdict["fields"] = [dict(f) for f in fields]
        result.append(tdict)
    conn.close()
    return result

def get_template_by_id(template_id):
    if IS_SUPABASE:
        res = supabase_client.table("templates").select("*").eq("id", template_id).execute()
        if not res.data:
            return None
        t = res.data[0]
        f_res = supabase_client.table("template_fields").select("*").eq("template_id", t["id"]).execute()
        t["fields"] = f_res.data
        return t

    conn = get_db_connection()
    t = conn.execute("SELECT * FROM templates WHERE id = ?", (template_id,)).fetchone()
    if not t:
        conn.close()
        return None
    tdict = dict(t)
    fields = conn.execute("SELECT * FROM template_fields WHERE template_id = ?", (template_id,)).fetchall()
    tdict["fields"] = [dict(f) for f in fields]
    conn.close()
    return tdict

def create_template(name, category, background_url):
    if IS_SUPABASE:
        data = {"name": name, "category": category, "background_url": background_url, "status": "active"}
        res = supabase_client.table("templates").insert(data).execute()
        return res.data[0] if res.data else None
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO templates (name, category, background_url, status) VALUES (?, ?, ?, 'active')",
        (name, category, background_url)
    )
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": new_id, "name": name, "category": category, "background_url": background_url, "status": "active"}

def update_template_status(template_id, status):
    if IS_SUPABASE:
        res = supabase_client.table("templates").update({"status": status}).eq("id", template_id).execute()
        return res.data[0] if res.data else None
    conn = get_db_connection()
    conn.execute("UPDATE templates SET status = ? WHERE id = ?", (status, template_id))
    conn.commit()
    conn.close()
    return True

def save_template_fields(template_id, fields_list):
    if IS_SUPABASE:
        # Delete old fields first
        supabase_client.table("template_fields").delete().eq("template_id", template_id).execute()
        # Insert new fields
        for f in fields_list:
            f["template_id"] = template_id
            if "id" in f:
                del f["id"]
            if "extra_styles" in f and isinstance(f["extra_styles"], dict):
                f["extra_styles"] = json.dumps(f["extra_styles"])
        if fields_list:
            supabase_client.table("template_fields").insert(fields_list).execute()
        return True

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM template_fields WHERE template_id = ?", (template_id,))
    for f in fields_list:
        extra_styles_str = json.dumps(f.get("extra_styles", {})) if isinstance(f.get("extra_styles"), dict) else f.get("extra_styles", "{}")
        cursor.execute(
            """INSERT INTO template_fields (
                template_id, name, type, position_x, position_y, width, height, is_default,
                font_family, font_size, font_weight, text_color, extra_styles
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                template_id, f["name"], f["type"], f["position_x"], f["position_y"],
                f["width"], f["height"], f.get("is_default", 0),
                f.get("font_family", "Inter"), f.get("font_size", 24),
                f.get("font_weight", "normal"), f.get("text_color", "#ffffff"),
                extra_styles_str
            )
        )
    conn.commit()
    conn.close()
    return True

def delete_template(template_id):
    """Permanently delete a template and its associated fields."""
    if IS_SUPABASE:
        supabase_client.table('template_fields').delete().eq('template_id', template_id).execute()
        supabase_client.table('templates').delete().eq('id', template_id).execute()
        return True
    conn = get_db_connection()
    conn.execute('DELETE FROM template_fields WHERE template_id = ?', (template_id,))
    conn.execute('DELETE FROM templates WHERE id = ?', (template_id,))
    conn.commit()
    conn.close()
    return True

# --- CAMPAIGNS ---
def get_campaigns():
    if IS_SUPABASE:
        res = supabase_client.table("campaigns").select("*").order("created_at", desc=True).execute()
        campaigns = res.data
        for c in campaigns:
            j_res = supabase_client.table("campaign_templates").select("template_id").eq("campaign_id", c["id"]).execute()
            c["template_ids"] = [row["template_id"] for row in j_res.data]
        return campaigns

    conn = get_db_connection()
    # Exclude soft-deleted campaigns
    campaigns = conn.execute("SELECT * FROM campaigns WHERE is_deleted = 0 ORDER BY created_at DESC").fetchall()
    result = []
    for c in campaigns:
        cdict = dict(c)
        temps = conn.execute("SELECT template_id FROM campaign_templates WHERE campaign_id = ?", (cdict["id"],)).fetchall()
        cdict["template_ids"] = [t["template_id"] for t in temps]
        result.append(cdict)
    conn.close()
    return result

def create_campaign(name, start_date, end_date, status, template_ids):
    if IS_SUPABASE:
        data = {"name": name, "start_date": start_date, "end_date": end_date, "status": status}
        res = supabase_client.table("campaigns").insert(data).execute()
        if not res.data:
            return None
        c_id = res.data[0]["id"]
        join_data = [{"campaign_id": c_id, "template_id": t_id} for t_id in template_ids]
        if join_data:
            supabase_client.table("campaign_templates").insert(join_data).execute()
        res.data[0]["template_ids"] = template_ids
        return res.data[0]

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO campaigns (name, start_date, end_date, status, is_deleted) VALUES (?, ?, ?, ?, 0)",
        (name, start_date, end_date, status)
    )
    c_id = cursor.lastrowid
    for t_id in template_ids:
        cursor.execute("INSERT INTO campaign_templates (campaign_id, template_id) VALUES (?, ?)", (c_id, t_id))
    conn.commit()
    conn.close()
    return {"id": c_id, "name": name, "start_date": start_date, "end_date": end_date, "status": status, "template_ids": template_ids}

def update_campaign(campaign_id, name, start_date, end_date, status, template_ids):
    if IS_SUPABASE:
        data = {"name": name, "start_date": start_date, "end_date": end_date, "status": status}
        supabase_client.table("campaigns").update(data).eq("id", campaign_id).execute()
        # Re-link templates
        supabase_client.table("campaign_templates").delete().eq("campaign_id", campaign_id).execute()
        join_data = [{"campaign_id": campaign_id, "template_id": t_id} for t_id in template_ids]
        if join_data:
            supabase_client.table("campaign_templates").insert(join_data).execute()
        return True

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE campaigns SET name = ?, start_date = ?, end_date = ?, status = ?, is_deleted = 0 WHERE id = ?",
        (name, start_date, end_date, status, campaign_id)
    )
    cursor.execute("DELETE FROM campaign_templates WHERE campaign_id = ?", (campaign_id,))
    for t_id in template_ids:
        cursor.execute("INSERT INTO campaign_templates (campaign_id, template_id) VALUES (?, ?)", (campaign_id, t_id))
    conn.commit()
    conn.close()
    return True

def soft_delete_campaign(campaign_id):
    if IS_SUPABASE:
        supabase_client.table("campaigns").update({"is_deleted": True}).eq("id", campaign_id).execute()
        return True
    conn = get_db_connection()
    conn.execute("UPDATE campaigns SET is_deleted = 1 WHERE id = ?", (campaign_id,))
    conn.commit()
    conn.close()
    return True

# --- SHARE HISTORY & LOGGING ---
def log_share(contact_id, user_id, template_id, campaign_id, generated_image_url, channel, status="sent", message_id=None):
    if IS_SUPABASE:
        data = {
            "contact_id": contact_id,
            "user_id": user_id,
            "template_id": template_id,
            "campaign_id": campaign_id,
            "generated_image_url": generated_image_url,
            "channel": channel,
            "delivery_status": status,
            "message_id": message_id,
            "share_timestamp": datetime.now().isoformat()
        }
        res = supabase_client.table("share_history").insert(data).execute()
        return res.data[0] if res.data else None

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO share_history (contact_id, user_id, template_id, campaign_id, generated_image_url, channel, delivery_status, message_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (contact_id, user_id, template_id, campaign_id, generated_image_url, channel, status, message_id)
    )
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": new_id, "contact_id": contact_id, "user_id": user_id, "generated_image_url": generated_image_url}

def update_share_status_by_message_id(message_id, status):
    if IS_SUPABASE:
        res = supabase_client.table("share_history").update({"delivery_status": status}).eq("message_id", message_id).execute()
        return True

    conn = get_db_connection()
    conn.execute("UPDATE share_history SET delivery_status = ? WHERE message_id = ?", (status, message_id))
    conn.commit()
    conn.close()
    return True

def get_share_history():
    if IS_SUPABASE:
        # Supabase complex join query
        res = supabase_client.table("share_history").select(
            "*, contacts(name, mobile), users(name), templates(name), campaigns(name)"
        ).order("share_timestamp", desc=True).execute()
        # Flatten structure to match SQLite output for front-end
        flattened = []
        for row in res.data:
            item = dict(row)
            item["contact_name"] = row["contacts"]["name"] if row.get("contacts") else "Unknown"
            item["contact_mobile"] = row["contacts"]["mobile"] if row.get("contacts") else ""
            item["user_name"] = row["users"]["name"] if row.get("users") else "System"
            item["template_name"] = row["templates"]["name"] if row.get("templates") else "N/A"
            item["campaign_name"] = row["campaigns"]["name"] if row.get("campaigns") else "Direct Share"
            item["event_count"] = 0
            item["last_event"] = None
            flattened.append(item)
        return flattened

    conn = get_db_connection()
    # Query with JOINs + event counts
    sql = """
        SELECT s.*,
               c.name AS contact_name, c.mobile AS contact_mobile,
               u.name AS user_name,
               t.name AS template_name,
               cp.name AS campaign_name,
               COUNT(sle.id) AS event_count,
               MAX(sle.event_timestamp) AS last_event
        FROM share_history s
        LEFT JOIN contacts c ON s.contact_id = c.id
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN templates t ON s.template_id = t.id
        LEFT JOIN campaigns cp ON s.campaign_id = cp.id
        LEFT JOIN share_link_events sle ON sle.share_id = s.id
        GROUP BY s.id
        ORDER BY s.share_timestamp DESC
    """
    history = conn.execute(sql).fetchall()
    conn.close()
    return [dict(h) for h in history]


def log_share_event(share_id, event_type, metadata=None):
    """Log a tracking event for a share (opened, clicked, deleted, etc.)"""
    import json
    meta_str = json.dumps(metadata) if metadata else None
    if IS_SUPABASE:
        supabase_client.table("share_link_events").insert({
            "share_id": share_id,
            "event_type": event_type,
            "metadata": meta_str
        }).execute()
        return
    conn = get_db_connection()
    conn.execute(
        "INSERT INTO share_link_events (share_id, event_type, metadata) VALUES (?, ?, ?)",
        (share_id, event_type, meta_str)
    )
    conn.commit()
    conn.close()


def get_share_events(share_id):
    """Get all tracking events for a specific share."""
    import json
    if IS_SUPABASE:
        res = supabase_client.table("share_link_events").select("*") \
            .eq("share_id", share_id).order("event_timestamp", desc=True).execute()
        return res.data
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT * FROM share_link_events WHERE share_id = ? ORDER BY event_timestamp DESC",
        (share_id,)
    ).fetchall()
    conn.close()
    events = []
    for r in [dict(row) for row in rows]:
        if r.get("metadata"):
            try:
                r["metadata"] = json.loads(r["metadata"])
            except Exception:
                pass
        events.append(r)
    return events


def delete_share_history_entry(share_id):
    """Permanently delete a share history entry and its events."""
    if IS_SUPABASE:
        supabase_client.table("share_link_events").delete().eq("share_id", share_id).execute()
        supabase_client.table("share_history").delete().eq("id", share_id).execute()
        return
    conn = get_db_connection()
    conn.execute("DELETE FROM share_link_events WHERE share_id = ?", (share_id,))
    conn.execute("DELETE FROM share_history WHERE id = ?", (share_id,))
    conn.commit()
    conn.close()

# --- ANALYTICS ---
def get_analytics_summary():
    if IS_SUPABASE:
        # We can implement using separate aggregates or RPC
        # For simplicity, load the data and calculate, or run count queries
        total_shares = supabase_client.table("share_history").select("id", count="exact").execute().count
        total_contacts = supabase_client.table("contacts").select("id", count="exact").execute().count
        total_templates = supabase_client.table("templates").select("id", count="exact").execute().count
        
        # We fetch recent data for counts per campaign, per user, daily, and templates
        shares = supabase_client.table("share_history").select("*, templates(name), campaigns(name), users(name)").execute().data
        
        campaign_counts = {}
        user_counts = {}
        daily_counts = {}
        template_counts = {}
        
        for s in shares:
            # Campaign
            camp = s.get("campaigns", {}).get("name") if s.get("campaigns") else "Direct"
            campaign_counts[camp] = campaign_counts.get(camp, 0) + 1
            # User
            usr = s.get("users", {}).get("name") if s.get("users") else "Unknown"
            user_counts[usr] = user_counts.get(usr, 0) + 1
            # Template
            tmpl = s.get("templates", {}).get("name") if s.get("templates") else "Deleted"
            template_counts[tmpl] = template_counts.get(tmpl, 0) + 1
            # Daily (YYYY-MM-DD)
            ts = s.get("share_timestamp", "")
            if ts:
                day = ts[:10]
                daily_counts[day] = daily_counts.get(day, 0) + 1

        top_campaign = max(campaign_counts.items(), key=lambda x: x[1])[0] if campaign_counts else "None"
        top_user = max(user_counts.items(), key=lambda x: x[1])[0] if user_counts else "None"
        top_template = max(template_counts.items(), key=lambda x: x[1])[0] if template_counts else "None"

        return {
            "total_shares": total_shares or 0,
            "total_contacts": total_contacts or 0,
            "total_templates": total_templates or 0,
            "top_campaign": top_campaign,
            "top_user": top_user,
            "top_template": top_template,
            "campaign_counts": campaign_counts,
            "user_counts": user_counts,
            "daily_counts": daily_counts,
            "template_counts": template_counts
        }

    conn = get_db_connection()
    total_shares = conn.execute("SELECT COUNT(*) FROM share_history").fetchone()[0]
    total_contacts = conn.execute("SELECT COUNT(*) FROM contacts").fetchone()[0]
    total_templates = conn.execute("SELECT COUNT(*) FROM templates WHERE status = 'active'").fetchone()[0]

    # Shares per campaign
    campaign_rows = conn.execute("""
        SELECT COALESCE(cp.name, 'Direct Share') as name, COUNT(s.id) as count 
        FROM share_history s LEFT JOIN campaigns cp ON s.campaign_id = cp.id 
        GROUP BY s.campaign_id
    """).fetchall()
    campaign_counts = {r["name"]: r["count"] for r in campaign_rows}

    # Shares per user
    user_rows = conn.execute("""
        SELECT u.name, COUNT(s.id) as count 
        FROM share_history s JOIN users u ON s.user_id = u.id 
        GROUP BY s.user_id
    """).fetchall()
    user_counts = {r["name"]: r["count"] for r in user_rows}

    # Daily shares
    daily_rows = conn.execute("""
        SELECT DATE(share_timestamp) as date, COUNT(id) as count 
        FROM share_history 
        GROUP BY DATE(share_timestamp) 
        ORDER BY date DESC LIMIT 30
    """).fetchall()
    daily_counts = {r["date"]: r["count"] for r in daily_rows}

    # Shares per template
    template_rows = conn.execute("""
        SELECT COALESCE(t.name, 'Deleted Template') as name, COUNT(s.id) as count 
        FROM share_history s LEFT JOIN templates t ON s.template_id = t.id 
        GROUP BY s.template_id
    """).fetchall()
    template_counts = {r["name"]: r["count"] for r in template_rows}

    # Top variables
    top_campaign = max(campaign_counts.items(), key=lambda x: x[1])[0] if campaign_counts else "None"
    top_user = max(user_counts.items(), key=lambda x: x[1])[0] if user_counts else "None"
    top_template = max(template_counts.items(), key=lambda x: x[1])[0] if template_counts else "None"

    conn.close()
    return {
        "total_shares": total_shares,
        "total_contacts": total_contacts,
        "total_templates": total_templates,
        "top_campaign": top_campaign,
        "top_user": top_user,
        "top_template": top_template,
        "campaign_counts": campaign_counts,
        "user_counts": user_counts,
        "daily_counts": daily_counts,
        "template_counts": template_counts
    }

# --- SETTINGS ---
def get_settings():
    if IS_SUPABASE:
        res = supabase_client.table("settings").select("*").execute()
        return {row["key"]: row["value"] for row in res.data} if res.data else {}
    conn = get_db_connection()
    settings = conn.execute("SELECT * FROM settings").fetchall()
    conn.close()
    return {s["key"]: s["value"] for s in settings}

def update_setting(key, value):
    if IS_SUPABASE:
        res = supabase_client.table("settings").upsert({"key": key, "value": value}).execute()
        return True
    conn = get_db_connection()
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))
    conn.commit()
    conn.close()
    return True
