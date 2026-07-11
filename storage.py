import os
from dotenv import load_dotenv
from database import IS_SUPABASE, supabase_client

load_dotenv()

UPLOAD_FOLDER = os.path.join("static", "uploads")

def init_storage():
    """Create local directories if using local storage fallback."""
    if not IS_SUPABASE:
        os.makedirs(os.path.join(UPLOAD_FOLDER, "templates"), exist_ok=True)
        os.makedirs(os.path.join(UPLOAD_FOLDER, "creatives"), exist_ok=True)
        os.makedirs(os.path.join(UPLOAD_FOLDER, "assets"), exist_ok=True)
        print("Local storage directories initialized.")

def get_mime_type(filename):
    """Determine MIME type based on file extension to support multiple formats."""
    ext = os.path.splitext(filename)[1].lower()
    mime_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".gif": "image/gif",
        ".bmp": "image/bmp"
    }
    return mime_types.get(ext, "application/octet-stream")

def save_file(file_bytes, filename, folder="templates", force_supabase=False):
    """
    Saves a file to storage (either Supabase or Local).
    
    :param file_bytes: bytes of the file to save
    :param filename: string filename
    :param folder: string subfolder/bucket-path ('templates', 'creatives', 'assets')
    :param force_supabase: if True, raises errors on Supabase failure instead of local fallback
    :return: public URL or relative path to the saved file
    """
    content_type = get_mime_type(filename)
    
    if IS_SUPABASE:
        bucket_name = "cap-creatives"
        file_path = f"{folder}/{filename}"
        try:
            # Upload with dynamic Content-Type parameters
            res = supabase_client.storage.from_(bucket_name).upload(
                path=file_path,
                file=file_bytes,
                file_options={
                    "cache-control": "3600",
                    "upsert": "true",
                    "content-type": content_type
                }
            )
            public_url = supabase_client.storage.from_(bucket_name).get_public_url(file_path)
            return public_url
        except Exception as e:
            error_details = f"Supabase upload error for '{filename}': {str(e)}"
            print(error_details)
            
            # If we enforce Supabase, let them know why it failed
            if force_supabase:
                raise Exception(
                    f"Failed to upload to Supabase Storage. Details: {str(e)}. "
                    f"Please verify that the bucket '{bucket_name}' exists and has public read/write access policies."
                )
            # Otherwise log warning and fallback to local
            print("Falling back to local disk storage.")

    # Local Storage fallback
    init_storage() # Make sure directories exist
    dest_path = os.path.join(UPLOAD_FOLDER, folder, filename)
    with open(dest_path, "wb") as f:
        f.write(file_bytes)
    
    # Return path relative to web server root
    return f"/static/uploads/{folder}/{filename}"
