import json, urllib.request

headers = {
    "Authorization": "Bearer napi_qate4vcrtvx535ygv9dsen4cmxgvci9ciffpc5271m98p6yvdadmw43i89sou2n9",
    "Content-Type": "application/json",
}

project_branches = [
    ("late-wave-08620201", "br-sparkling-wave-aqgfv2lu"),
    ("small-dust-85408093", "br-solitary-field-ankr4w9i"),
    ("summer-wind-42271359", "br-nameless-fog-ane7d16y"),
    ("soft-hat-08904153", "br-dry-wildflower-am8ku8pp"),
    ("solitary-mountain-37926780", "br-jolly-forest-ai7m6lf8"),
]

for pid, bid in project_branches:
    try:
        body = json.dumps({"query": "SELECT name FROM ops.chapters LIMIT 1"}).encode()
        req = urllib.request.Request(
            f"https://console.neon.tech/api/v2/projects/{pid}/branches/{bid}/sql",
            data=body, headers=headers, method="POST"
        )
        resp = json.loads(urllib.request.urlopen(req).read())
        print(f"{pid}: {resp}")
    except Exception as e:
        err = str(e)[:80]
        print(f"{pid}: {err}")
