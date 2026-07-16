import os
from dotenv import load_dotenv
from database import IS_SUPABASE, supabase_client

load_dotenv()

UPLOAD_FOLDER = os.path.join("static", "uploads")

def init_storage():
    """No-op. Local storage directories are disabled for security/deployment requirements."""
    pass

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

def save_file(file_bytes, filename, folder="templates", force_supabase=True):
    """
    Saves a file strictly to Supabase Storage.
    
    :param file_bytes: bytes of the file to save
    :param filename: string filename
    :param folder: string subfolder/bucket-path ('templates', 'creatives', 'assets')
    :param force_supabase: ignored (strictly True now)
    :return: public URL of the saved file on Supabase
    """
    content_type = get_mime_type(filename)
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
        raise RuntimeError(
            f"Failed to upload to Supabase Storage. Details: {str(e)}. "
            f"Please verify that the bucket '{bucket_name}' exists and has public read/write access policies."
        )

