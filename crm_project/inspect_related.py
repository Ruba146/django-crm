import sqlite3
conn = sqlite3.connect('crm.db')
cur = conn.cursor()

for table in ['notes', 'activity_types', 'task_types', 'task_type_options', 'pipeline_stages', 'sources', 'lost_reasons']:
    print(f'\n{table.upper()}')
    try:
        rows = cur.execute(f'SELECT * FROM {table} ORDER BY rowid DESC LIMIT 10').fetchall()
        for row in rows:
            print(row)
    except Exception as exc:
        print('ERROR', exc)

print('\nCONTACT-RELATED NOTE SAMPLE')
for row in cur.execute("SELECT * FROM notes ORDER BY rowid DESC LIMIT 10"):
    print(row)

conn.close()
