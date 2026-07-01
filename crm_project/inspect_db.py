import sqlite3
conn = sqlite3.connect('crm.db')
cur = conn.cursor()
print('TABLES')
for row in cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"):
    print(row[0])

for table in ['contacts', 'activities', 'deals', 'tasks', 'leads', 'establishments', 'stages', 'tickets']:
    print(f'\n{table.upper()} SCHEMA')
    for row in cur.execute(f'PRAGMA table_info({table})'):
        print(row)

print('\nSAMPLE CONTACT')
for row in cur.execute('SELECT * FROM contacts ORDER BY rowid DESC LIMIT 2'):
    print(row)

print('\nSAMPLE LEADS')
for row in cur.execute('SELECT * FROM leads ORDER BY rowid DESC LIMIT 3'):
    print(row)

print('\nSAMPLE DEALS')
for row in cur.execute('SELECT * FROM deals ORDER BY rowid DESC LIMIT 3'):
    print(row)

print('\nSAMPLE ACTIVITIES')
for row in cur.execute('SELECT * FROM activities ORDER BY rowid DESC LIMIT 5'):
    print(row)

print('\nSAMPLE TASKS')
for row in cur.execute('SELECT * FROM tasks ORDER BY rowid DESC LIMIT 5'):
    print(row)

conn.close()
