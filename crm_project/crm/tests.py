from django.test import SimpleTestCase


class CRMPageTests(SimpleTestCase):
    def test_lead_create_via_post_redirects(self):
        response = self.client.post(
            "/leads/",
            {
                "action": "create",
                "full_name": "Ava Carter",
                "normalized_phone": "+1-555-1234",
                "normalized_email": "ava@example.com",
                "notes": "Warm lead",
            },
            HTTP_HOST="127.0.0.1",
        )
        self.assertEqual(response.status_code, 302)

    def test_contacts_page_renders(self):
        response = self.client.get("/contacts/", HTTP_HOST="127.0.0.1")
        self.assertEqual(response.status_code, 200)

    def test_leads_page_renders(self):
        response = self.client.get("/leads/", HTTP_HOST="127.0.0.1")
        self.assertEqual(response.status_code, 200)

    def test_deals_page_renders(self):
        response = self.client.get("/deals/", HTTP_HOST="127.0.0.1")
        self.assertEqual(response.status_code, 200)

    def test_activities_page_renders(self):
        response = self.client.get("/activities/", HTTP_HOST="127.0.0.1")
        self.assertEqual(response.status_code, 200)

    def test_tasks_page_renders(self):
        response = self.client.get("/tasks/", HTTP_HOST="127.0.0.1")
        self.assertEqual(response.status_code, 200)

    def test_tickets_page_renders(self):
        response = self.client.get("/tickets/", HTTP_HOST="127.0.0.1")
        self.assertEqual(response.status_code, 200)
