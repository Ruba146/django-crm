import sqlite3
conn = sqlite3.connect('database/crm.db')
cur = conn.cursor()

print('=== TABLES AND CREATE STATEMENTS ===')
cur.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
tables = cur.fetchall()
for name, sql in tables:
    print('TABLE:', name)
    print(sql if sql else '(no create statement)')
    print()

print('=== INDEXES ===')
cur.execute("SELECT sql, name, tbl_name, type FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY tbl_name, name")
indexes = cur.fetchall()
for sql, name, tbl, typ in indexes:
    print('INDEX:', name, 'on', tbl)
    print('  Type:', typ)
    print('  SQL:', sql)

print()
print('=== FOREIGN KEYS ===')
for name, _ in tables:
    cur.execute(f'PRAGMA foreign_key_list({name})')
    fks = cur.fetchall()
    if fks:
        print('Table', name + ':')
        for fk in fks:
            print('  FK: column=' + fk[3] + ' -> ' + fk[2] + '.' + fk[4] + ' (on_update=' + fk[5] + ', on_delete=' + fk[6] + ')')

print()
print('=== COLUMNS ===')
for name, _ in tables:
    cur.execute(f'PRAGMA table_info({name})')
    cols = cur.fetchall()
    print('Table', name + ':')
    for col in cols:
        print('  ' + col[1] + ' (' + col[2] + ') notnull=' + str(col[3]) + ' default=' + str(col[4]) + ' pk=' + str(col[5]))

conn.close()