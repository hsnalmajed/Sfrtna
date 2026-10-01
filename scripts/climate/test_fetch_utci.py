# Offline check of fetch_utci.py's reading code on an already-downloaded year
# (raw/utci_scale_oneYear.zip, Riyadh 2020): no request is sent.
import json, shutil, sys, types
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.argv = ["x", "--worker=0/1"]
zip_path = HERE / "raw" / "utci_scale_oneYear.zip"
class FakeResult:
    def download(self, target): shutil.copy(zip_path, target)
class FakeClient:
    def __init__(self, **kw): pass
    def retrieve(self, ds, req): return FakeResult()
sys.modules["cdsapi"] = types.SimpleNamespace(Client=FakeClient)
import fetch_utci
fetch_utci.YEARS = range(2020, 2021)
fetch_utci.OUT = HERE / "raw" / "utci_test"
orig = json.loads((HERE / "utci_boxes.json").read_text(encoding="utf-8"))
box = {"box": "test", "area": [24.8, 46.6, 24.6, 46.8], "members": [{"id": "riyadh", "latitude": 24.71, "longitude": 46.72}]}
fetch_utci.credentials_file = lambda: {"url": "x", "key": "y"}
import builtins
real_read = Path.read_text
def fake_read(self, *a, **k):
    if self.name == "utci_boxes.json": return json.dumps({"boxes": [box]})
    return real_read(self, *a, **k)
Path.read_text = fake_read
fetch_utci.main()
out = (HERE / "raw" / "utci_test" / "riyadh" / "2020.csv").read_text().splitlines()
print(out[:4], len(out))
