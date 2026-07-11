import unittest
import json
from app import app, normalize_phone
import database

class TestCAPStudio(unittest.TestCase):
    
    def setUp(self):
        # Configure app for testing
        app.config["TESTING"] = True
        self.client = app.test_client()
        
        # Ensure database is initialized
        database.init_db()
        
        # We can clean/create a specific user for testing
        self.test_email = "test_user@cap.com"
        self.test_password = "password123"
        self.test_name = "Test User"
        self.test_role = "admin"
        
        # Ensure test user doesn't already exist, then insert
        existing = database.get_user_by_email(self.test_email)
        if not existing:
            from werkzeug.security import generate_password_hash
            database.create_user(
                email=self.test_email,
                password_hash=generate_password_hash(self.test_password),
                role=self.test_role,
                name=self.test_name
            )

    def test_normalize_phone(self):
        """Assert phone numbers are normalized to '91<10_digits>' correctly."""
        test_cases = [
            ("9876543210", "919876543210"),
            ("+919876543210", "919876543210"),
            ("91-9876543210", "919876543210"),
            ("09876543210", "919876543210"),
            ("919876543210", "919876543210"),
            ("  98765 43210  ", "919876543210")
        ]
        for raw, expected in test_cases:
            with self.subTest(raw=raw):
                self.assertEqual(normalize_phone(raw), expected)

    def test_login_api(self):
        """Assert auth login endpoint functions and sets session."""
        response = self.client.post("/api/auth/login", json={
            "email": self.test_email,
            "password": self.test_password
        })
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data["user"]["email"], self.test_email)
        self.assertEqual(data["user"]["role"], self.test_role)

    def test_contacts_api_duplicate_detection(self):
        """Assert API blocks duplicates with a 409 status code."""
        # 1. Login to establish session cookie
        self.client.post("/api/auth/login", json={
            "email": self.test_email,
            "password": self.test_password
        })
        
        # 2. Add first contact (make sure it's unique by generating a phone number)
        unique_phone = "917777777777"
        # Clean potential leftovers
        c = database.get_contact_by_mobile(unique_phone)
        if c:
            database.delete_contact(c["id"])

        res1 = self.client.post("/api/contacts", json={
            "name": "Jane Tester",
            "mobile": unique_phone,
            "company": "Test LLC"
        })
        self.assertEqual(res1.status_code, 201)
        
        # 3. Add duplicate phone contact and expect 409 conflict
        res2 = self.client.post("/api/contacts", json={
            "name": "Duplicate Jane",
            "mobile": unique_phone,
            "company": "Other Corp"
        })
        self.assertEqual(res2.status_code, 409)
        data = json.loads(res2.data)
        self.assertEqual(data["error"], "Duplicate contact")
        
        # Cleanup
        created_id = json.loads(res1.data)["id"]
        database.delete_contact(created_id)

    def test_analytics_api_format(self):
        """Assert analytics API provides expected key layout."""
        # Login to establish session cookie
        self.client.post("/api/auth/login", json={
            "email": self.test_email,
            "password": self.test_password
        })

        response = self.client.get("/api/analytics")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        expected_keys = [
            "total_shares", "total_contacts", "total_templates", 
            "top_campaign", "top_user", "top_template",
            "campaign_counts", "user_counts", "daily_counts", "template_counts"
        ]
        for key in expected_keys:
            self.assertIn(key, data)

if __name__ == "__main__":
    unittest.main()
