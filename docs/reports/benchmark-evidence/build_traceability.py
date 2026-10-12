"""Build the 121-TC traceability matrix + TC-level pass rate from saved evidence.

Inputs (same folder): unit-*.tap, newman-*.summary.json, docs/spec/parsed_tc.txt.
Rule: a TC is COVERED if >=1 automated test is tagged with it; it PASSES only if
every executed test tagged with it passed. Aux requests (driver login) are ignored.
Run: python docs/reports/benchmark-evidence/build_traceability.py
"""
import glob, json, os, re
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
TOTAL = 121

titles = {}
for line in open(os.path.join(ROOT, "docs/spec/parsed_tc.txt"), encoding="utf8"):
    m = re.match(r"(\d+):\s*(.*)", line)
    if m:
        titles[int(m.group(1))] = m.group(2).strip()[:60]

results = defaultdict(list)  # tc -> [(source, passed)]

def tcs(text):
    return {int(n) for n in re.findall(r"TC(\d{1,3})", text)}

for tap in glob.glob(os.path.join(HERE, "unit-*.tap")):
    svc = os.path.basename(tap)[5:-4]
    for line in open(tap, encoding="utf8"):
        m = re.match(r"(not )?ok \d+ - (.*)", line)
        if m:
            for tc in tcs(m.group(2)):
                results[tc].append((f"unit:{svc}", m.group(1) is None))

for rep in glob.glob(os.path.join(HERE, "newman-*.summary.json")):
    name = os.path.basename(rep)[:-13]
    run = json.load(open(rep, encoding="utf8"))["run"]
    for ex in run["executions"]:
        item = ex["item"]["name"]
        if "(phu)" in item or not item.startswith("TC"):
            continue  # auxiliary / setup requests
        ok = all(not a.get("error") for a in ex.get("assertions", []))
        for tc in tcs(item.split(" ")[0]):
            results[tc].append((f"postman:{name}", ok))

# k6 scripts exist and were executed with measured summaries (see benchmark_report.md 1.x)
# TC61 target 1000 req/s vs measured 111 req/s -> FAIL; TC68 p95<300ms vs booking 679.9ms -> FAIL.
for tc, script, ok in [(61, "booking-load.js", False), (62, "eta-load.js", True),
                       (63, "spike-pricing.js", True), (68, "booking-load.js", False),
                       (69, "booking-load.js", True)]:
    results[tc].append((f"k6:{script}", ok))

rows, passed = [], 0
for tc in range(1, TOTAL + 1):
    r = results.get(tc, [])
    if r:
        ok = all(p for _, p in r)
        passed += ok
        status = "PASS" if ok else "FAIL"
    else:
        status = "NOT COVERED"
    srcs = ", ".join(sorted({s for s, _ in r})) or "-"
    rows.append(f"| TC{tc} | {titles.get(tc, '')} | {srcs} | {status} |")

covered = len(results)
out = os.path.join(HERE, "traceability_matrix.md")
with open(out, "w", encoding="utf8") as f:
    f.write("# Traceability Matrix — 121 TC (sinh tự động)\n\n")
    f.write(f"- Covered: **{covered}/{TOTAL} = {covered/TOTAL:.1%}**\n")
    f.write(f"- Pass (trên TC đã cover): **{passed}/{covered} = {passed/covered:.1%}**\n\n")
    f.write("| TC | Tiêu đề (rút gọn) | Nguồn test | Trạng thái |\n|---|---|---|---|\n")
    f.write("\n".join(rows) + "\n")
print(f"covered {covered}/{TOTAL} = {covered/TOTAL:.1%}; pass {passed}/{covered} = {passed/covered:.1%}")
print("FAIL:", [tc for tc in sorted(results) if not all(p for _, p in results[tc])])
