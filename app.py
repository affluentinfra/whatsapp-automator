import os
import base64
import uuid
import csv
import io
from datetime import datetime
from flask import Flask, request, jsonify, render_template, send_from_directory, session
from flask_cors import CORS
from dotenv import load_dotenv
from werkzeug.security import check_password_hash, generate_password_hash
from itsdangerous import URLSafeTimedSerializer
import requests

import database
import storage

load_dotenv()

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "cap_secret_key_change_me_in_production")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024 # 16MB max upload

CORS(app)

# Initialize serializer for custom JWT tokens
serializer = URLSafeTimedSerializer(app.config["SECRET_KEY"])

# Initialize Database and Storage
database.init_db()
storage.init_storage()

def normalize_phone(phone_str):
    if not phone_str:
        return ""
    # Remove all non-digit characters
    cleaned = "".join(c for c in str(phone_str) if c.isdigit())
    
    # Standard normalization rules
    if len(cleaned) == 10:
        cleaned = "91" + cleaned
    elif len(cleaned) == 11 and cleaned.startswith("0"):
        cleaned = "91" + cleaned[1:]
    elif len(cleaned) == 12 and cleaned.startswith("91"):
        pass
    
    return cleaned

def token_required(f):
    """Decorator to enforce cookie-based session verification."""
    def decorator(*args, **kwargs):
        if "user" not in session:
            return jsonify({"error": "Session expired or not logged in"}), 401
        request.user = session["user"]
        return f(*args, **kwargs)
    decorator.__name__ = f.__name__
    return decorator

# --- STATIC ROUTING ---
@app.route("/")
def index():
    return render_template("index.html")

# --- AUTH API ---
@app.route("/api/auth/me", methods=["GET"])
def get_current_user():
    if "user" in session:
        return jsonify({"user": session["user"]})
    return jsonify({"user": None}), 401

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")
    
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
        
    user = database.get_user_by_email(email)
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid email or password"}), 401
        
    # Store user in Flask secure session cookie
    session["user"] = {
        "id": user["id"],
        "email": user["email"],
        "role": user["role"],
        "name": user["name"]
    }
    # Set session permanent (valid for 31 days by default in Flask)
    session.permanent = True
    
    return jsonify({
        "user": session["user"]
    })

@app.route("/api/auth/signup", methods=["POST"])
def signup():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")
    name = data.get("name")
    role = data.get("role", "user") # Custom selectable role for dev/testing
    
    if not email or not password or not name:
        return jsonify({"error": "Email, password, and name are required"}), 400
        
    # Standardize roles
    if role not in ["super_admin", "admin", "user"]:
        role = "user"
        
    existing = database.get_user_by_email(email)
    if existing:
        return jsonify({"error": "A user with this email already exists"}), 409
        
    # Hash password
    pass_hash = generate_password_hash(password)
    
    # Create user in database
    new_user = database.create_user(email, pass_hash, role, name)
    
    # Auto log in
    session["user"] = {
        "id": new_user["id"],
        "email": new_user["email"],
        "role": new_user["role"],
        "name": new_user["name"]
    }
    session.permanent = True
    
    return jsonify({
        "user": session["user"]
    }), 201

@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.pop("user", None)
    return jsonify({"success": True})

# --- TEMPLATES API ---
@app.route("/api/templates", methods=["GET"])
@token_required
def get_templates():
    include_archived = request.args.get("include_archived", "false").lower() == "true"
    templates = database.get_templates(include_archived=include_archived)
    return jsonify(templates)

@app.route("/api/templates/<int:template_id>", methods=["GET"])
@token_required
def get_template(template_id):
    template = database.get_template_by_id(template_id)
    if not template:
        return jsonify({"error": "Template not found"}), 404
    return jsonify(template)

@app.route("/api/templates", methods=["POST"])
@token_required
def create_template():
    if request.user["role"] not in ["super_admin", "admin"]:
        return jsonify({"error": "Unauthorized"}), 403
        
    name = request.form.get("name")
    category = request.form.get("category")
    bg_file = request.files.get("background")
    
    if not name or not category or not bg_file:
        return jsonify({"error": "Name, category, and background image are required"}), 400
        
    # Save the background image
    filename = f"bg_{uuid.uuid4().hex}_{bg_file.filename}"
    file_bytes = bg_file.read()
    try:
        bg_url = storage.save_file(file_bytes, filename, folder="templates", force_supabase=False)
    except Exception as e:
        print(f"Graceful template background fallback: {e}")
        # Force local saving
        dest_path = os.path.join(storage.UPLOAD_FOLDER, "templates", filename)
        with open(dest_path, "wb") as f:
            f.write(file_bytes)
        bg_url = f"/static/uploads/templates/{filename}"
    
    template = database.create_template(name, category, bg_url)
    
    # Save default fields (Name and Mobile)
    default_fields = [
        {
            "name": "Name",
            "type": "text",
            "position_x": 50,
            "position_y": 50,
            "width": 200,
            "height": 40,
            "is_default": 1,
            "font_family": "Inter",
            "font_size": 24,
            "font_weight": "bold",
            "text_color": "#000000"
        },
        {
            "name": "Mobile",
            "type": "text",
            "position_x": 50,
            "position_y": 100,
            "width": 200,
            "height": 40,
            "is_default": 1,
            "font_family": "Inter",
            "font_size": 20,
            "font_weight": "normal",
            "text_color": "#555555"
        }
    ]
    database.save_template_fields(template["id"], default_fields)
    
    # Fetch template with fields
    full_template = database.get_template_by_id(template["id"])
    return jsonify(full_template), 21

@app.route("/api/templates/<int:template_id>/fields", methods=["POST"])
@token_required
def save_template_fields(template_id):
    if request.user["role"] not in ["super_admin", "admin"]:
        return jsonify({"error": "Unauthorized"}), 403
        
    fields = request.get_json()
    if not isinstance(fields, list):
        return jsonify({"error": "Fields must be a JSON array"}), 400
        
    database.save_template_fields(template_id, fields)
    return jsonify({"success": True})

@app.route("/api/templates/<int:template_id>/status", methods=["PUT"])
@token_required
def update_template_status(template_id):
    if request.user["role"] not in ["super_admin", "admin"]:
        return jsonify({"error": "Unauthorized"}), 403
        
    data = request.get_json() or {}
    status = data.get("status")
    if status not in ["active", "archived"]:
        return jsonify({"error": "Invalid status value"}), 400
        
    database.update_template_status(template_id, status)
    return jsonify({"success": True})

# --- CONTACTS API ---
@app.route("/api/contacts", methods=["GET"])
@token_required
def get_contacts():
    contacts = database.get_contacts()
    return jsonify(contacts)

@app.route("/api/contacts", methods=["POST"])
@token_required
def create_contact():
    data = request.get_json() or {}
    name = data.get("name")
    mobile = data.get("mobile")
    company = data.get("company", "")
    designation = data.get("designation", "")
    notes = data.get("notes", "")
    
    if not name or not mobile:
        return jsonify({"error": "Name and mobile number are required"}), 400
        
    norm_mobile = normalize_phone(mobile)
    if not norm_mobile:
        return jsonify({"error": "Invalid mobile number"}), 400
        
    # Check duplicate
    existing = database.get_contact_by_mobile(norm_mobile)
    if existing:
        return jsonify({"error": "Duplicate contact", "contact": existing}), 409
        
    contact = database.create_contact(name, norm_mobile, company, designation, notes)
    return jsonify(contact), 201

@app.route("/api/contacts/<int:contact_id>", methods=["PUT"])
@token_required
def update_contact(contact_id):
    data = request.get_json() or {}
    name = data.get("name")
    mobile = data.get("mobile")
    company = data.get("company", "")
    designation = data.get("designation", "")
    notes = data.get("notes", "")
    
    if not name or not mobile:
        return jsonify({"error": "Name and mobile number are required"}), 400
        
    norm_mobile = normalize_phone(mobile)
    if not norm_mobile:
        return jsonify({"error": "Invalid mobile number"}), 400
        
    contact = database.update_contact(contact_id, name, norm_mobile, company, designation, notes)
    return jsonify(contact)

@app.route("/api/contacts/<int:contact_id>", methods=["DELETE"])
@token_required
def delete_contact(contact_id):
    database.delete_contact(contact_id)
    return jsonify({"success": True})

# --- BULK UPLOAD ---
@app.route("/api/contacts/import", methods=["POST"])
@token_required
def import_contacts():
    file = request.files.get("file")
    resolve_mode = request.form.get("resolve_mode") # "ask", "update", "skip", "overwrite"
    
    if not file:
        return jsonify({"error": "No file uploaded"}), 400
        
    filename = file.filename
    records = []
    
    if filename.endswith(".csv"):
        stream = io.StringIO(file.read().decode("utf-8-sig"), newline="")
        reader = csv.DictReader(stream)
        for row in reader:
            records.append({
                "name": row.get("name", "").strip(),
                "mobile": row.get("mobile", "").strip(),
                "company": row.get("company", "").strip(),
                "designation": row.get("designation", "").strip(),
                "notes": row.get("notes", "").strip()
            })
    elif filename.endswith(".xlsx"):
        try:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(file.read()))
            sheet = wb.active
            # Assume row 1 is header
            headers = [cell.value for cell in sheet[1]]
            
            # Map header names to keys
            h_map = {
                "name": -1,
                "mobile": -1,
                "company": -1,
                "designation": -1,
                "notes": -1
            }
            for i, h in enumerate(headers):
                if not h:
                    continue
                hl = h.lower()
                for key in h_map.keys():
                    if key in hl:
                        h_map[key] = i
            
            for row_idx in range(2, sheet.max_row + 1):
                row = [cell.value for cell in sheet[row_idx]]
                if not any(row):
                    continue # Skip empty row
                
                name_val = str(row[h_map["name"]]) if h_map["name"] != -1 and row[h_map["name"]] else ""
                mob_val = str(row[h_map["mobile"]]) if h_map["mobile"] != -1 and row[h_map["mobile"]] else ""
                comp_val = str(row[h_map["company"]]) if h_map["company"] != -1 and row[h_map["company"]] else ""
                desg_val = str(row[h_map["designation"]]) if h_map["designation"] != -1 and row[h_map["designation"]] else ""
                notes_val = str(row[h_map["notes"]]) if h_map["notes"] != -1 and row[h_map["notes"]] else ""
                
                records.append({
                    "name": name_val.strip(),
                    "mobile": mob_val.strip(),
                    "company": comp_val.strip(),
                    "designation": desg_val.strip(),
                    "notes": notes_val.strip()
                })
        except ImportError:
            return jsonify({"error": "Openpyxl package is missing. Please convert your file to CSV."}), 400
        except Exception as e:
            return jsonify({"error": f"Failed to parse Excel file: {e}"}), 400
    else:
        return jsonify({"error": "Unsupported file format. Upload .csv or .xlsx"}), 400

    results = {
        "imported": 0,
        "updated": 0,
        "skipped": 0,
        "duplicates": [] # Holds records that need resolution
    }
    
    for r in records:
        name = r["name"]
        mobile = r["mobile"]
        if not name or not mobile:
            results["skipped"] += 1
            continue
            
        norm_mobile = normalize_phone(mobile)
        if not norm_mobile:
            results["skipped"] += 1
            continue
            
        existing = database.get_contact_by_mobile(norm_mobile)
        if existing:
            if resolve_mode == "update":
                database.update_contact(existing["id"], name, norm_mobile, r["company"], r["designation"], r["notes"])
                results["updated"] += 1
            elif resolve_mode == "overwrite":
                database.delete_contact(existing["id"])
                database.create_contact(name, norm_mobile, r["company"], r["designation"], r["notes"])
                results["imported"] += 1
            elif resolve_mode == "skip":
                results["skipped"] += 1
            else: # "ask"
                results["duplicates"].append({
                    "imported_data": r,
                    "existing_data": existing
                })
        else:
            database.create_contact(name, norm_mobile, r["company"], r["designation"], r["notes"])
            results["imported"] += 1
            
    return jsonify(results)

# --- CAMPAIGNS API ---
@app.route("/api/campaigns", methods=["GET"])
@token_required
def get_campaigns():
    campaigns = database.get_campaigns()
    # Filter out inactive campaigns if role is 'user'
    if request.user["role"] == "user":
        campaigns = [c for c in campaigns if c["status"] == "active"]
    return jsonify(campaigns)

@app.route("/api/campaigns", methods=["POST"])
@token_required
def create_campaign():
    if request.user["role"] not in ["super_admin", "admin"]:
        return jsonify({"error": "Unauthorized"}), 403
        
    data = request.get_json() or {}
    name = data.get("name")
    start_date = data.get("start_date")
    end_date = data.get("end_date")
    status = data.get("status", "active")
    template_ids = data.get("template_ids", [])
    
    if not name or not start_date or not end_date:
        return jsonify({"error": "Name, start_date, and end_date are required"}), 400
        
    campaign = database.create_campaign(name, start_date, end_date, status, template_ids)
    return jsonify(campaign), 201

@app.route("/api/campaigns/<int:campaign_id>", methods=["PUT"])
@token_required
def update_campaign(campaign_id):
    if request.user["role"] not in ["super_admin", "admin"]:
        return jsonify({"error": "Unauthorized"}), 403
        
    data = request.get_json() or {}
    name = data.get("name")
    start_date = data.get("start_date")
    end_date = data.get("end_date")
    status = data.get("status")
    template_ids = data.get("template_ids", [])
    
    if not name or not start_date or not end_date or not status:
        return jsonify({"error": "Name, start_date, end_date, and status are required"}), 400
        
    database.update_campaign(campaign_id, name, start_date, end_date, status, template_ids)
    return jsonify({"success": True})

@app.route("/api/campaigns/<int:campaign_id>", methods=["DELETE"])
@token_required
def delete_campaign(campaign_id):
    if request.user["role"] not in ["super_admin", "admin"]:
        return jsonify({"error": "Unauthorized"}), 403
    # Soft delete the campaign using database helper
    from database import soft_delete_campaign
    soft_delete_campaign(campaign_id)
    return jsonify({"success": True})

@app.route("/templates/<int:template_id>/editor", methods=["GET"])
@token_required
def edit_template(template_id):
    template = database.get_template_by_id(template_id)
    if not template:
        return jsonify({"error": "Template not found"}), 404
    # Render the template editor HTML, passing template data
    return render_template("template_editor.html", template_id=template_id, background_url=template["background_url"])


# --- SHARING API ---
@app.route("/api/share", methods=["POST"])
@token_required
def share_creative():
    data = request.get_json() or {}
    contact_id = data.get("contact_id")
    template_id = data.get("template_id")
    campaign_id = data.get("campaign_id") # Can be null for direct sharing
    image_base64 = data.get("image_base64") # Image generated on canvas
    
    if not contact_id or not image_base64:
        return jsonify({"error": "Contact ID and generated image data are required"}), 400
        
    # Load contact
    contacts = database.get_contacts()
    contact = next((c for c in contacts if c["id"] == int(contact_id)), None)
    if not contact:
        return jsonify({"error": "Contact not found"}), 404
        
    # Save Generated Image to storage
    img_data = image_base64.split(",")[1] if "," in image_base64 else image_base64
    img_bytes = base64.b64decode(img_data)
    filename = f"creative_{uuid.uuid4().hex}.png"
    try:
        image_url = storage.save_file(img_bytes, filename, folder="creatives", force_supabase=False)
    except Exception as e:
        print(f"Graceful fallback to local saving on Supabase error: {e}")
        # Force SQLite style local path
        dest_path = os.path.join(storage.UPLOAD_FOLDER, "creatives", filename)
        with open(dest_path, "wb") as f:
            f.write(img_bytes)
        image_url = f"/static/uploads/creatives/{filename}"
    
    # Retrieve active sharing mode setting
    settings = database.get_settings()
    sharing_mode = settings.get("sharing_mode", "manual")
    
    delivery_status = "sent"
    whatsapp_url = ""
    message_id = None
    
    # Mode 1: Manual Sharing URL
    if sharing_mode == "manual":
        # Check text details
        message = f"Hello {contact['name']}, check out this personalized creative: {request.host_url.rstrip('/')}{image_url}"
        whatsapp_url = f"https://wa.me/{contact['mobile']}?text={requests.utils.quote(message)}"
    
    # Mode 2: Meta API integration (Preferred)
    else:
        phone_id = settings.get("meta_phone_id")
        access_token = settings.get("meta_access_token")
        
        if not phone_id or not access_token:
            # Fallback to manual share link but flag API failed
            delivery_status = "failed"
            message = f"Hello {contact['name']}, check out this personalized creative: {request.host_url.rstrip('/')}{image_url}"
            whatsapp_url = f"https://api.whatsapp.com/send?phone={contact['mobile']}&text={requests.utils.quote(message)}"
            print("API configuration missing. Reverted to Manual sharing.")
        else:
            # Dispatch real request to Meta API
            url = f"https://graph.facebook.com/v19.0/{phone_id}/messages"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            # Using Meta template or direct media messaging depending on Meta policy.
            # Here we structure a standard interactive/image message.
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": contact["mobile"],
                "type": "image",
                "image": {
                    "link": f"{request.host_url.rstrip('/')}{image_url}",
                    "caption": f"Hello {contact['name']}, thank you for connecting with us!"
                }
            }
            try:
                response = requests.post(url, json=payload, headers=headers, timeout=10)
                if response.status_code in [200, 201]:
                    delivery_status = "sent"
                    res_data = response.json()
                    if "messages" in res_data and len(res_data["messages"]) > 0:
                        message_id = res_data["messages"][0].get("id")
                else:
                    delivery_status = "failed"
                    print(f"Meta API error response: {response.text}")
            except Exception as e:
                delivery_status = "failed"
                print(f"Meta API call failed: {e}")
                
    # Log the share
    database.log_share(
        contact_id=contact_id,
        user_id=request.user["id"],
        template_id=template_id,
        campaign_id=campaign_id,
        generated_image_url=image_url,
        channel=sharing_mode,
        status=delivery_status,
        message_id=message_id
    )
    
    return jsonify({
        "success": True,
        "channel": sharing_mode,
        "status": delivery_status,
        "whatsapp_url": whatsapp_url,
        "image_url": image_url
    })

# --- ANALYTICS API ---
@app.route("/api/analytics", methods=["GET"])
@token_required
def get_analytics():
    summary = database.get_analytics_summary()
    return jsonify(summary)

# --- SETTINGS API ---
@app.route("/api/settings", methods=["GET"])
@token_required
def get_settings():
    settings = database.get_settings()
    # Mask access token for security
    if settings.get("meta_access_token"):
        settings["meta_access_token"] = "************" + settings["meta_access_token"][-4:]
    return jsonify(settings)

@app.route("/api/settings", methods=["POST"])
@token_required
def save_settings():
    if request.user["role"] not in ["super_admin", "admin"]:
        return jsonify({"error": "Unauthorized"}), 403
        
    data = request.get_json() or {}
    
    if "sharing_mode" in data:
        database.update_setting("sharing_mode", data["sharing_mode"])
    if "meta_phone_id" in data:
        database.update_setting("meta_phone_id", data["meta_phone_id"])
    if "meta_access_token" in data and not data["meta_access_token"].startswith("************"):
        database.update_setting("meta_access_token", data["meta_access_token"])
        
    return jsonify({"success": True})

# --- WHATSAPP BUSINESS API WEBHOOKS ---
@app.route("/api/webhook", methods=["GET"])
def verify_webhook():
    """Handles verification challenge from Meta Console."""
    mode = request.args.get("hub.mode")
    token = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")
    
    settings = database.get_settings()
    verify_token = settings.get("meta_verify_token") or os.getenv("META_VERIFY_TOKEN", "cap_webhook_verify_token")
    
    if mode == "subscribe" and token == verify_token:
        print("Webhook verified successfully!")
        return challenge, 200
    return "Forbidden", 403

@app.route("/api/webhook", methods=["POST"])
def receive_webhook():
    """Receives event callbacks from Meta and updates share history delivery status."""
    data = request.get_json() or {}
    
    if "entry" in data:
        for entry in data["entry"]:
            for change in entry.get("changes", []):
                val = change.get("value", {})
                statuses = val.get("statuses", [])
                for status_item in statuses:
                    wamid = status_item.get("id")
                    status_val = status_item.get("status") # e.g. "sent", "delivered", "read", "failed"
                    
                    if wamid and status_val:
                        print(f"Webhook Update: Message {wamid} changed status to {status_val}")
                        database.update_share_status_by_message_id(wamid, status_val)
                        
    return jsonify({"status": "ok"}), 200

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
