import openpyxl, json, re

wb = openpyxl.load_workbook('HH.xlsx')
ws = wb.active
rows = [row for row in ws.iter_rows(values_only=True)]

classes = [str(c).strip() for c in rows[0] if c]

def parse_soll_entry(val):
    """Parse '1 x BR, 4 h (1.HJ)' → {subject, hours, ?note}"""
    if not val:
        return None
    m = re.match(r'\d+\s*x\s*([^,]+),\s*([\d,.]+)\s*h\s*(.*)$', str(val).strip())
    if not m:
        return None
    entry = {"subject": m.group(1).strip(), "hours": float(m.group(2).replace(',', '.'))}
    note = m.group(3).strip().strip('()')
    if note:
        entry["note"] = note
    return entry

def parse_ist_entry(val):
    """Parse 'BR, 4 h SPI' or 'STUBO - 0,5h NAU' → {subject, hours, ?teacher}"""
    if not val:
        return None
    s = str(val).strip()
    m = re.match(r'([^,]+),\s*([\d,.]+)\s*h\s*(.*)$', s) or \
        re.match(r'([^-]+)\s*-\s*([\d,.]+)\s*h\s*(.*)$', s)
    if not m:
        return None
    entry = {"subject": m.group(1).strip(), "hours": float(m.group(2).replace(',', '.'))}
    teacher = m.group(3).strip() or None
    if teacher:
        entry["teacher"] = teacher
    return entry

result = {cls: {"soll": [], "ist": []} for cls in classes}

for row in rows[1:21]:
    for col_idx, cls in enumerate(classes):
        entry = parse_soll_entry(row[col_idx] if col_idx < len(row) else None)
        if entry:
            result[cls]["soll"].append(entry)

for row in rows[23:]:
    for col_idx, cls in enumerate(classes):
        entry = parse_ist_entry(row[col_idx] if col_idx < len(row) else None)
        if entry:
            result[cls]["ist"].append(entry)

with open('hh_klassen.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print("Gespeichert: hh_klassen.json")
for cls, data in result.items():
    print(f"  {cls}: {len(data['soll'])} Soll, {len(data['ist'])} Ist")