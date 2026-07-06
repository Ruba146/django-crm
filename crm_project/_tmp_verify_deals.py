import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'crm_project.settings')
import django
django.setup()
from django.test import Client
from django.contrib.auth.models import User

User.objects.filter(username='deal_workspace_user').delete()
User.objects.create_user(username='deal_workspace_user', password='Pass1234!')
client = Client()
assert client.login(username='deal_workspace_user', password='Pass1234!')
response = client.get('/deals/')
print('/deals/ ->', response.status_code)
html = response.content.decode('utf-8', 'ignore')
print('activity form:', 'data-related-kind="activity"' in html)
print('task form:', 'data-related-kind="task"' in html)
print('note form:', 'data-related-kind="note"' in html)
print('activity options present:', 'Activity Type' in html)
print('save note present:', 'Save Note' in html)
