try:
    import reportlab
    print("reportlab:", reportlab.Version)
except ImportError:
    print("NOT_INSTALLED")
    import subprocess
    subprocess.check_call(["pip", "install", "reportlab"])
    print("INSTALLED")
