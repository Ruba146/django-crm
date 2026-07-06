import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'crm_project.settings')
django.setup()
from django.test import Client
from django.contrib.auth import get_user_model

user = get_user_model().objects.filter(username='admin').first()
client = Client()
client.force_login(user)
response = client.get('/tasks/')
html = response.content.decode('utf-8', 'ignore')
print('dayModal2026-07-01 present:', 'id="dayModal2026-07-01"' in html)
print('data-open-task-modal count:', html.count('data-open-task-modal'))
print('taskModal128 present:', 'id="taskModal128"' in html)
