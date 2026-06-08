import json
import os

path = r"C:\Users\a-6600\.gemini\antigravity\brain\defefd3d-03a6-48cc-ab0b-1fbc66f83de5\.system_generated\logs\transcript.jsonl"
with open(path, "r", encoding="utf-8") as f:
    for idx, line in enumerate(f):
        if idx == 243:
            obj = json.loads(line)
            content = obj.get("content", "")
            print("Line 243 content length:", len(content))
            with open("dump_view_243.txt", "w", encoding="utf-8") as outf:
                outf.write(content)
            print("Wrote dump_view_243.txt")
