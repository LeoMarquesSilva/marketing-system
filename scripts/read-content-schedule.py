"""Read the supplied workbook without changing it. Emit 2026 source rows as JSON."""
import datetime
import json
import sys
import openpyxl

sys.stdout.reconfigure(encoding="utf-8")
book = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
result = []
for sheet in book.worksheets:
    for row_number, values in enumerate(sheet.iter_rows(min_row=5, max_col=7, values_only=True), start=5):
        month, due, kind, person, theme, status, scheduled = values
        if not isinstance(due, (datetime.datetime, datetime.date)) or due.year != 2026:
            continue
        if str(kind).strip() not in ("Reels", "Post / Artigo"):
            raise ValueError(f"Unknown format at {sheet.title}:{row_number}: {kind}")
        result.append({"sheet": sheet.title, "row": row_number, "date": due.strftime("%Y-%m-%d"), "format": "reel" if str(kind).strip() == "Reels" else "post", "name": str(person or "").strip(), "status": str(status or "").strip(), "theme": str(theme or "").strip(), "scheduled": str(scheduled or "").strip()})
print(json.dumps(result, ensure_ascii=False))
book.close()
